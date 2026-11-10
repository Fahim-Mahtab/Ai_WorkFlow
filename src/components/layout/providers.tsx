"use client";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { WorkspaceProvider } from "@/lib/workspace/store";
import { ConfirmProvider } from "@/components/ui/dialog";
import { aiClient, type ProviderStatus } from "@/lib/ai/client";

interface AssistantState {
  open: boolean;
  setOpen: (o: boolean) => void;
  prefill: string;
  ask: (text: string) => void;
  status: ProviderStatus | null;
}

const AssistantCtx = createContext<AssistantState | null>(null);

export function useAssistant() {
  const c = useContext(AssistantCtx);
  if (!c) throw new Error("useAssistant outside provider");
  return c;
}

function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [prefill, setPrefill] = useState("");
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  useEffect(() => {
    aiClient.status().then(setStatus).catch(() => setStatus({ mode: "demo", provider: "mock", model: "unreachable" }));
    if (window.matchMedia("(min-width: 1280px)").matches) setOpen(true);
  }, []);
  const ask = useCallback((text: string) => {
    setPrefill(text);
    setOpen(true);
  }, []);
  return <AssistantCtx.Provider value={{ open, setOpen, prefill, ask, status }}>{children}</AssistantCtx.Provider>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
      <WorkspaceProvider>
        <ConfirmProvider>
          <AssistantProvider>
            {children}
            {/* top-center: bottom-right would cover the AI Assistant's input box */}
            <Toaster richColors position="top-center" closeButton />
          </AssistantProvider>
        </ConfirmProvider>
      </WorkspaceProvider>
    </ThemeProvider>
  );
}
