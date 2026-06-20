"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { usePathname } from "next/navigation";
import type { Customer, Task } from "@/lib/types";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ResponseTag = "SCRIPT" | "REBUTTAL" | "TIP" | "ANSWER" | "CLARIFY";
export type CoachMode = "sales" | "help" | "admin";

export interface CoachMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  tag?: ResponseTag;
  confidence?: "high" | "medium" | "low";
  webSearchUsed?: boolean;
}

interface AiCoachState {
  isOpen: boolean;
  messages: CoachMessage[];
  isLoading: boolean;
  currentCustomer: Customer | null;
  callState: string;
  conversationHistory: Record<string, CoachMessage[]>; // Deprecated - now using DB
  mode: CoachMode; // "sales", "help", or "admin"
  currentPage: string; // pathname for context-aware help
  conversationId: string | null; // Current conversation session ID
  isAdmin: boolean; // Whether the current broker is an admin (enables Admin Assistant)
}

interface AiCoachActions {
  openCoach: (customer?: Customer | null, callState?: string, mode?: CoachMode) => void;
  closeCoach: () => void;
  sendMessage: (content: string) => Promise<void>;
  clearConversation: () => void;
  updateCallState: (state: string) => void;
  setMode: (mode: CoachMode) => void;
  setCurrentPage: (page: string) => void;
  setCurrentCustomer: (customer: Customer | null) => void; // Added for external customer setting
}

type AiCoachContextType = AiCoachState & AiCoachActions;

// ─── Context ─────────────────────────────────────────────────────────────────

const AiCoachContext = createContext<AiCoachContextType | undefined>(undefined);

// ─── Provider ────────────────────────────────────────────────────────────────

export function AiCoachProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [callState, setCallState] = useState<string>("idle");
  const [mode, setMode] = useState<CoachMode>("sales");
  const [currentPage, setCurrentPage] = useState<string>("/dashboard");
  const [conversationHistory, setConversationHistory] = useState<Record<string, CoachMessage[]>>({});
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [brokerId, setBrokerId] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Get broker ID + admin status on mount
  useEffect(() => {
    const fetchBrokerId = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setBrokerId(user.id);
        const { data: broker } = await supabase
          .from("brokers")
          .select("is_admin")
          .eq("id", user.id)
          .single();
        setIsAdmin(Boolean(broker?.is_admin));
      }
    };
    fetchBrokerId();
  }, [supabase]);

  // Auto-detect customer from URL path when page changes
  useEffect(() => {
    const detectCustomerFromUrl = async () => {
      console.log("🔍 [AiCoachContext] Auto-detect triggered:", { pathname, brokerId: brokerId ? "present" : "missing" });
      
      if (!pathname || !brokerId) {
        console.log("⚠️ [AiCoachContext] Skipping detection: missing pathname or brokerId");
        return;
      }

      // Extract customer_id from path like /dashboard/customers/NS-8709
      const customerMatch = pathname.match(/\/dashboard\/customers\/([A-Z]+-\d+)/);
      
      if (customerMatch && customerMatch[1]) {
        const customerId = customerMatch[1];
        console.log(`🔎 [AiCoachContext] Matched customer ID from URL: ${customerId}`);
        
        try {
          const { data, error } = await supabase
            .from("customers")
            .select("*")
            .eq("customer_id", customerId)
            .single();

          if (data && !error) {
            console.log(`✅ [AiCoachContext] Customer loaded:`, {
              id: data.id,
              customer_id: data.customer_id,
              name: data.business_name || data.contact_name
            });
            setCurrentCustomer(data);
          } else {
            console.log("❌ [AiCoachContext] Customer not found or error:", error);
            // Not on a customer page or customer not found
            if (!pathname.includes("/customers/")) {
              setCurrentCustomer(null);
            }
          }
        } catch (error) {
          console.error("💥 [AiCoachContext] Error auto-detecting customer:", error);
        }
      } else {
        console.log("📍 [AiCoachContext] Not on customer page, clearing customer");
        if (!pathname.includes("/customers/")) {
          // Clear customer if not on customer page
          setCurrentCustomer(null);
        }
      }
    };

    detectCustomerFromUrl();
  }, [pathname, brokerId, supabase]);

  // Save message to database
  const saveMessageToDb = useCallback(async (message: CoachMessage) => {
    if (!brokerId) return;

    try {
      const { error } = await supabase.from("ai_chat_history").insert({
        broker_id: brokerId,
        customer_id: currentCustomer?.id || null,
        conversation_id: conversationId,
        mode,
        page_path: currentPage,
        role: message.role,
        content: message.content,
        tag: message.tag || null,
        confidence: message.confidence || null,
        web_search_used: message.webSearchUsed || false,
      });

      if (error) {
        console.error("Error saving message to DB:", error);
      }
    } catch (error) {
      console.error("Failed to save message:", error);
    }
  }, [brokerId, currentCustomer, conversationId, mode, currentPage, supabase]);

  const openCoach = useCallback(
    async (customer: Customer | null = null, initialCallState: string = "idle", providedMode?: CoachMode) => {
      // Only override currentCustomer if explicitly provided
      // Otherwise, preserve auto-detected customer from URL
      if (customer !== null) {
        console.log("🔄 [AiCoachContext] Setting customer from openCoach parameter:", customer.customer_id);
        setCurrentCustomer(customer);
      } else {
        console.log("ℹ️ [AiCoachContext] No customer provided to openCoach, keeping existing:", currentCustomer?.customer_id || "none");
      }
      setCallState(initialCallState);
      setIsOpen(true);

      // Always use sales mode for the floating AI Coach
      // (HelpModal has its own separate AI implementation for technical support)
      const selectedMode: CoachMode = "sales";
      setMode(selectedMode);

      // Use the customer parameter if provided, otherwise use currentCustomer from state
      const customerToUse = customer || currentCustomer;
      const customerId = customerToUse?.id || null;
      
      console.log("📊 [AiCoachContext] Opening coach with customer:", customerId ? customerToUse?.customer_id : "none");
      
      // Try to load existing conversation history from database
      // This will set conversationId from the database if history exists
      if (brokerId) {
        try {
          let query = supabase
            .from("ai_chat_history")
            .select("*")
            .eq("broker_id", brokerId)
            .eq("mode", selectedMode)
            .eq("is_archived", false)
            .order("created_at", { ascending: true })
            .limit(100);

          if (customerId) {
            query = query.eq("customer_id", customerId);
          } else {
            query = query.is("customer_id", null);
          }

          const { data, error } = await query;

          if (error) {
            console.error("Error loading chat history:", error);
          } else if (data && data.length > 0) {
            // Load existing conversation
            const loadedMessages: CoachMessage[] = data.map((msg: any) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: new Date(msg.created_at),
              tag: msg.tag || undefined,
              confidence: msg.confidence || undefined,
              webSearchUsed: msg.web_search_used || false,
            }));

            setMessages(loadedMessages);
            setConversationId(data[0].conversation_id); // Use existing conversation ID
            console.log(`✅ Loaded ${data.length} messages from existing conversation`);
            return; // Exit early - we loaded existing history
          }
        } catch (error) {
          console.error("Failed to load conversation history:", error);
        }
      }

      // No existing history found - create new conversation
      const newConversationId = crypto.randomUUID();
      setConversationId(newConversationId);
      setMessages([]); // Start fresh
      console.log("✅ Starting new conversation");
    },
    [currentPage, brokerId, supabase, currentCustomer]
  );

  const closeCoach = useCallback(() => {
    // No need to save to memory - already in database
    setIsOpen(false);
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || isLoading) return;

      console.log("📤 [AiCoachContext] Sending message:", {
        content,
        currentCustomer: currentCustomer ? {
          id: currentCustomer.id,
          customer_id: currentCustomer.customer_id,
          name: currentCustomer.business_name || currentCustomer.contact_name
        } : "null",
        mode,
        currentPage
      });

      const userMessage: CoachMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      
      // Save user message to database
      await saveMessageToDb(userMessage);
      
      setIsLoading(true);

      try {
        const response = await fetch("/api/ai/sales-coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: currentCustomer?.id || null,
            message: content,
            history: messages.map((m) => ({ role: m.role, content: m.content })),
            callState,
            mode, // "sales" or "help"
            currentPage, // For page-specific help
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error("AI Coach API error:", response.status, errorData);
          throw new Error(`Failed to get coach response: ${errorData.error || response.statusText}`);
        }

        const data = await response.json();

        const assistantMessage: CoachMessage = {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: data.reply,
          timestamp: new Date(),
          tag: data.tag,
          confidence: data.confidence,
          webSearchUsed: data.webSearchUsed || false,
        };

        setMessages((prev) => [...prev, assistantMessage]);
        
        // Save assistant message to database
        await saveMessageToDb(assistantMessage);
      } catch (error) {
        console.error("Coach error:", error);

        // Show error message
        const errorMessage: CoachMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content:
            "Sorry, I couldn't generate a response. Please try again or contact dispatch for immediate help.",
          timestamp: new Date(),
          tag: "CLARIFY",
          confidence: "low",
        };

        setMessages((prev) => [...prev, errorMessage]);
        await saveMessageToDb(errorMessage);
      } finally {
        setIsLoading(false);
      }
    },
    [currentCustomer, messages, callState, isLoading, mode, currentPage, saveMessageToDb]
  );

  const clearConversation = useCallback(async () => {
    if (!brokerId || !conversationId) return;

    try {
      // Archive current conversation instead of deleting
      const { error } = await supabase
        .from("ai_chat_history")
        .update({ is_archived: true })
        .eq("conversation_id", conversationId)
        .eq("broker_id", brokerId);

      if (error) {
        console.error("Error archiving conversation:", error);
        return;
      }

      // Clear UI state
      setMessages([]);
      
      // Generate new conversation ID for next messages
      const newConversationId = crypto.randomUUID();
      setConversationId(newConversationId);
      
      console.log("✅ Conversation archived successfully");
    } catch (error) {
      console.error("Failed to archive conversation:", error);
    }
  }, [brokerId, conversationId, supabase]);

  // Handle mode switching without closing the chat
  const handleModeChange = useCallback(async (newMode: CoachMode) => {
    try {
      setMode(newMode);
      
      console.log(`🔄 Switching to ${newMode} mode...`);
      
      const customerId = currentCustomer?.id || null;
      
      // Try to load existing conversation for this mode
      if (brokerId) {
        let query = supabase
          .from("ai_chat_history")
          .select("*")
          .eq("broker_id", brokerId)
          .eq("mode", newMode)
          .eq("is_archived", false)
          .order("created_at", { ascending: true })
          .limit(100);

        if (customerId) {
          query = query.eq("customer_id", customerId);
        } else {
          query = query.is("customer_id", null);
          if (newMode === "help") {
            query = query.eq("page_path", currentPage);
          }
        }

        const { data, error } = await query;

        if (error) {
          console.error("Error loading chat history for mode switch:", error);
        } else if (data && data.length > 0) {
          // Load existing conversation for this mode
          const loadedMessages: CoachMessage[] = data.map((msg: any) => ({
            id: msg.id,
            role: msg.role,
            content: msg.content,
            timestamp: new Date(msg.created_at),
            tag: msg.tag || undefined,
            confidence: msg.confidence || undefined,
            webSearchUsed: msg.web_search_used || false,
          }));

          setMessages(loadedMessages);
          setConversationId(data[0].conversation_id);
          console.log(`✅ Loaded ${data.length} messages for ${newMode} mode`);
          return;
        }
      }
      
      // No existing history for this mode - start fresh
      const newConversationId = crypto.randomUUID();
      setConversationId(newConversationId);
      setMessages([]);
      console.log(`✅ Starting new ${newMode} conversation`);
    } catch (error) {
      console.error("Error in handleModeChange:", error);
      // Don't crash - just start fresh
      const newConversationId = crypto.randomUUID();
      setConversationId(newConversationId);
      setMessages([]);
    }
  }, [currentCustomer, currentPage, brokerId, supabase]);

  const updateCallState = useCallback((state: string) => {
    setCallState(state);
  }, []);

  const updateCurrentCustomer = useCallback((customer: Customer | null) => {
    setCurrentCustomer(customer);
  }, []);

  const value: AiCoachContextType = {
    isOpen,
    messages,
    isLoading,
    currentCustomer,
    callState,
    conversationHistory,
    mode,
    currentPage,
    conversationId,
    isAdmin,
    openCoach,
    closeCoach,
    sendMessage,
    clearConversation,
    updateCallState,
    setMode: handleModeChange,
    setCurrentPage,
    setCurrentCustomer: updateCurrentCustomer,
  };

  return (
    <AiCoachContext.Provider value={value}>{children}</AiCoachContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAiCoach() {
  const context = useContext(AiCoachContext);
  if (!context) {
    throw new Error("useAiCoach must be used within AiCoachProvider");
  }
  return context;
}
