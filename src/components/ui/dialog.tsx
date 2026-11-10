"use client";
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as AlertPrimitive from "@radix-ui/react-alert-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  size = "md",
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & { size?: "sm" | "md" | "lg" | "xl" }) {
  const width = { sm: "max-w-md", md: "max-w-lg", lg: "max-w-2xl", xl: "max-w-4xl" }[size];
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] data-[state=open]:animate-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-hidden rounded-xl border bg-card p-5 shadow-xl",
          width,
          className,
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
          <X className="size-4" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogHeader({ title, description }: { title: React.ReactNode; description?: React.ReactNode }) {
  return (
    <div className="pr-6">
      <DialogPrimitive.Title className="text-base font-semibold">{title}</DialogPrimitive.Title>
      {description ? (
        <DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>
      ) : (
        <DialogPrimitive.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</DialogPrimitive.Description>
      )}
    </div>
  );
}

export function DialogBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("-mx-5 flex-1 overflow-y-auto px-5 scrollbar-thin", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap justify-end gap-2", className)} {...props} />;
}

/* ------------------------- Confirmation dialog ------------------------- */

interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  destructive?: boolean;
}

const ConfirmCtx = React.createContext<(o: ConfirmOptions) => Promise<boolean>>(async () => false);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
  const confirm = React.useCallback((o: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...o, resolve })), []);
  const close = (v: boolean) => {
    state?.resolve(v);
    setState(null);
  };
  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <AlertPrimitive.Root open={!!state} onOpenChange={(o) => !o && close(false)}>
        <AlertPrimitive.Portal>
          <AlertPrimitive.Overlay className="fixed inset-0 z-[60] bg-black/40" />
          <AlertPrimitive.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-5 shadow-xl">
            <AlertPrimitive.Title className="text-base font-semibold">{state?.title}</AlertPrimitive.Title>
            <AlertPrimitive.Description className="mt-1.5 text-sm text-muted-foreground">{state?.description ?? ""}</AlertPrimitive.Description>
            <div className="mt-5 flex justify-end gap-2">
              <AlertPrimitive.Cancel asChild>
                <Button variant="outline" size="sm">Cancel</Button>
              </AlertPrimitive.Cancel>
              <AlertPrimitive.Action asChild>
                <Button size="sm" variant={state?.destructive ? "destructive" : "default"} onClick={() => close(true)}>
                  {state?.confirmLabel ?? "Confirm"}
                </Button>
              </AlertPrimitive.Action>
            </div>
          </AlertPrimitive.Content>
        </AlertPrimitive.Portal>
      </AlertPrimitive.Root>
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  return React.useContext(ConfirmCtx);
}
