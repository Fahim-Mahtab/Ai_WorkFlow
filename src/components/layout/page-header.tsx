"use client";
import type { ReactNode } from "react";
import Link from "next/link";
import { Wand2 } from "lucide-react";
import { useStore } from "@/lib/workspace/store";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/primitives";
import type { Workspace } from "@/lib/config/types";

export function PageHeader({ title, description, actions }: { title: ReactNode; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Renders children only when a workspace is active; otherwise an empty state pointing to the generator. */
export function RequireWorkspace({ children }: { children: (ws: Workspace) => ReactNode }) {
  const { active } = useStore();
  if (!active)
    return (
      <EmptyState
        className="py-24"
        icon={<Wand2 />}
        title="No workspace selected"
        description="Describe your work on the home page to create a workspace."
        action={<Button asChild size="sm"><Link href="/">Open AI generator</Link></Button>}
      />
    );
  return <>{children(active)}</>;
}
