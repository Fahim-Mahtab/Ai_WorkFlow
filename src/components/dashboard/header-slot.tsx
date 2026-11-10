"use client";
/** A spot in a widget card's header where the widget can put its own small buttons (e.g. chart ⇄ table). */
import { createContext, useContext, type ReactNode } from "react";
import { createPortal } from "react-dom";

export const WidgetHeaderSlot = createContext<HTMLElement | null>(null);

/** Renders children in the card header when there is one, otherwise right here. */
export function HeaderAction({ children, fallbackClassName }: { children: ReactNode; fallbackClassName?: string }) {
  const slot = useContext(WidgetHeaderSlot);
  if (slot) return createPortal(children, slot);
  return <div className={fallbackClassName}>{children}</div>;
}
