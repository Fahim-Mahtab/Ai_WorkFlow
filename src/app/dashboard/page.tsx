"use client";
import { useState } from "react";
import { Check, Pencil, Sparkles } from "lucide-react";
import { RequireWorkspace, PageHeader } from "@/components/layout/page-header";
import { DashboardCanvas } from "@/components/dashboard/dashboard-canvas";
import { WorkspaceEnv } from "@/components/tasks/task-dialog-host";
import { useWorkspaceActions } from "@/lib/workspace/store";
import { useAssistant } from "@/components/layout/providers";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import type { Workspace } from "@/lib/config/types";

function DashboardView({ workspace }: { workspace: Workspace }) {
  const [editing, setEditing] = useState(false);
  const [pageId, setPageId] = useState<string | undefined>(undefined);
  const actions = useWorkspaceActions(workspace.id);
  const { setOpen } = useAssistant();
  return (
    <div className="mx-auto max-w-[1600px] space-y-5 px-4 py-6 sm:px-6">
      <PageHeader
        title={
          <span className="flex flex-wrap items-center gap-2">
            {workspace.config.name}
            {workspace.isDemo && <Badge color="amber">demo</Badge>}
          </span>
        }
        description={workspace.config.description}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              <Sparkles /> Modify with AI
            </Button>
            <Button size="sm" variant={editing ? "default" : "outline"} onClick={() => setEditing((e) => !e)}>
              {editing ? <Check /> : <Pencil />} {editing ? "Done editing" : "Edit dashboard"}
            </Button>
          </>
        }
      />
      {editing && (
        <div className="rounded-lg border border-primary/30 bg-accent px-3 py-2 text-xs text-accent-foreground">
          Edit mode — drag widgets by the handle, use ⚙ to configure, resize or remove; double-click a page tab to rename; add pages and widgets. Changes save automatically.
        </div>
      )}
      <WorkspaceEnv workspace={workspace}>
        <DashboardCanvas
          workspace={workspace}
          pageId={pageId}
          onPageChange={setPageId}
          editing={editing}
          onConfigChange={(c, note) => actions.setConfig(c, note)}
        />
      </WorkspaceEnv>
    </div>
  );
}

export default function DashboardPage() {
  return <RequireWorkspace>{(ws) => <DashboardView key={ws.id} workspace={ws} />}</RequireWorkspace>;
}
