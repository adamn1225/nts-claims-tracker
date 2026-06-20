"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import toast from "react-hot-toast";
import GoToConnectModal from "@/components/GoToConnectModal";
import GoToDeviceSetupModal from "@/components/GoToDeviceSetupModal";

interface ClickToCallContextType {
  makeCall: (phoneNumber: string, customerId?: string) => Promise<void>;
  gotoConnected: boolean | null;
  callingPhone: string | null;
}

const ClickToCallContext = createContext<ClickToCallContextType>({
  makeCall: async () => {},
  gotoConnected: null,
  callingPhone: null,
});

export function useClickToCall() {
  return useContext(ClickToCallContext);
}

export function ClickToCallProvider({ children }: { children: ReactNode }) {
  const [gotoConnected, setGotoConnected] = useState<boolean | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showDeviceSetupModal, setShowDeviceSetupModal] = useState(false);
  const [deviceErrorMessage, setDeviceErrorMessage] = useState<string>("");
  const [callingPhone, setCallingPhone] = useState<string | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: conn } = await supabase
        .from("goto_connections")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      setGotoConnected(!!conn);
    };

    checkConnection();
  }, []);

  const makeCall = useCallback(
    async (phoneNumber: string, customerId?: string) => {
      if (!phoneNumber) {
        toast.error("No phone number available");
        return;
      }

      // Still loading connection status
      if (gotoConnected === null) {
        toast.error("Checking GoTo connection...");
        return;
      }

      // Not connected — show modal
      if (!gotoConnected) {
        setShowConnectModal(true);
        return;
      }

      // Connected — initiate GoTo call
      setCallingPhone(phoneNumber);
      try {
        const res = await fetch("/api/goto/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phoneNumber, customerId }),
        });

        const data = await res.json();

        if (!res.ok) {
          const errorMsg = data.error || "Failed to initiate call";
          
          // Check if it's a device-related error
          const isDeviceError = 
            errorMsg.toLowerCase().includes("device") ||
            errorMsg.toLowerCase().includes("running") ||
            errorMsg.toLowerCase().includes("online") ||
            res.status === 502;

          if (isDeviceError) {
            setDeviceErrorMessage(errorMsg);
            setShowDeviceSetupModal(true);
          } else {
            toast.error(errorMsg);
          }
          return;
        }

        toast.success(`Calling ${phoneNumber}...`);
      } catch {
        toast.error("Network error. Please try again.");
      } finally {
        setCallingPhone(null);
      }
    },
    [gotoConnected],
  );

  return (
    <ClickToCallContext.Provider
      value={{ makeCall, gotoConnected, callingPhone }}
    >
      {children}
      <GoToConnectModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
      />
      <GoToDeviceSetupModal
        isOpen={showDeviceSetupModal}
        onClose={() => setShowDeviceSetupModal(false)}
        errorMessage={deviceErrorMessage}
      />
    </ClickToCallContext.Provider>
  );
}
