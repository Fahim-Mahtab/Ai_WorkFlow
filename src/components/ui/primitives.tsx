/** Small shadcn-style primitives: Input, Textarea, Label, Card, Badge, NativeSelect, Checkbox, Skeleton. */
import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[72px] w-full rounded-md border border-input bg-card px-3 py-2 text-sm shadow-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-xs font-medium text-muted-foreground", className)} {...props} />;
}

export function Card({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("rounded-2xl border bg-card text-card-foreground shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_16px_-8px_rgba(15,23,42,0.08)] dark:shadow-none", className)} {...props} />;
}

const BADGE_COLORS = {
  slate: "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-500/20",
  blue: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
  amber: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/25",
  violet: "bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20",
  green: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20",
  red: "bg-red-500/10 text-red-700 dark:text-red-300 border-red-500/20",
  pink: "bg-pink-500/10 text-pink-700 dark:text-pink-300 border-pink-500/20",
  cyan: "bg-cyan-500/10 text-cyan-800 dark:text-cyan-300 border-cyan-500/20",
  orange: "bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20",
} as const;

export const DOT_COLORS: Record<keyof typeof BADGE_COLORS, string> = {
  slate: "bg-slate-400",
  blue: "bg-blue-500",
  amber: "bg-amber-500",
  violet: "bg-violet-500",
  green: "bg-green-600",
  red: "bg-red-500",
  pink: "bg-pink-500",
  cyan: "bg-cyan-500",
  orange: "bg-orange-500",
};

export function Badge({ color = "slate", className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { color?: keyof typeof BADGE_COLORS }) {
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", BADGE_COLORS[color], className)} {...props} />;
}

export const NativeSelect = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "h-9 w-full rounded-md border border-input bg-card px-2.5 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
NativeSelect.displayName = "NativeSelect";

export function Checkbox({ className, ...props }: Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">) {
  return <input type="checkbox" className={cn("size-4 shrink-0 cursor-pointer rounded border-input accent-[var(--primary)]", className)} {...props} />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-md", className)} />;
}

export function EmptyState({ icon, title, description, action, className }: { icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-4 py-8 text-center", className)}>
      {icon && <div className="mb-1 rounded-full bg-muted p-3 text-muted-foreground [&_svg]:size-5">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
