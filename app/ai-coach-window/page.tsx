"use client";

import { AiCoachProvider, useAiCoach } from "@/contexts/AiCoachContext";
import { AiCoachHeader } from "@/components/ai-coach/AiCoachHeader";
import { AiCoachQuickActions } from "@/components/ai-coach/AiCoachQuickActions";
import { AiCoachChatArea } from "@/components/ai-coach/AiCoachChatArea";
import { AiCoachInput } from "@/components/ai-coach/AiCoachInput";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

// Force dynamic rendering (prevent prerendering errors)
export const dynamic = 'force-dynamic';

/**
 * Inner component that uses the coach context
 */
function AiCoachWindow() {
  const { openCoach, setCurrentCustomer } = useAiCoach();
  const searchParams = useSearchParams();
  const supabase = createClient();

  useEffect(() => {
    const loadCustomerAndOpen = async () => {
      const customerId = searchParams.get('customerId');
      
      if (customerId) {
        // Load customer from database
        const { data: customer } = await supabase
          .from('customers')
          .select('*')
          .eq('id', customerId)
          .single();
        
        if (customer) {
          console.log("🪟 [Pop-out] Loaded customer:", customer.customer_id);
          setCurrentCustomer(customer);
          openCoach(customer);
        } else {
          console.log("⚠️ [Pop-out] Customer not found, opening without context");
          openCoach(null);
        }
      } else {
        console.log("ℹ️ [Pop-out] No customer ID in URL, opening general coach");
        openCoach(null);
      }
    };

    loadCustomerAndOpen();
  }, [searchParams, openCoach, setCurrentCustomer, supabase]);

  return (
    <div className="flex h-screen flex-col bg-white overflow-hidden">
      <div className="shrink-0">
        <AiCoachHeader isPopout={true} />
      </div>
      <div className="shrink-0">
        <AiCoachQuickActions />
      </div>
      <div className="grow overflow-y-auto">
        <AiCoachChatArea />
      </div>
      <div className="shrink-0">
        <AiCoachInput />
      </div>
    </div>
  );
}

/**
 * Standalone AI Coach page for pop-out window
 * Minimal layout with just the coach interface
 */
export default function AiCoachWindowPage() {
  return (
    <AiCoachProvider>
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center bg-white">
          <div className="text-center">
            <div className="mb-4 text-4xl">🧠</div>
            <p className="text-slate-600">Loading AI Coach...</p>
          </div>
        </div>
      }>
        <AiCoachWindow />
      </Suspense>
    </AiCoachProvider>
  );
}
