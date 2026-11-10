"use client";
/** "Import workspace" file picker: brings in a workspace exported from another browser or from localhost. */
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { useStore } from "@/lib/workspace/store";
import { readWorkspaceFile } from "@/lib/workspace/transfer";
import { cn } from "@/lib/utils";

export function ImportWorkspaceButton({ className, label = "Import workspace" }: { className?: string; label?: string }) {
  const { workspaces, addWorkspace } = useStore();
  const router = useRouter();
  return (
    <label className={cn("inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border bg-card px-3 text-xs font-medium hover:bg-muted", className)}>
      <Upload className="size-4" /> {label}
      <input
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          try {
            const ws = readWorkspaceFile(await f.text(), workspaces.map((w) => w.id));
            addWorkspace(ws);
            toast.success(`Imported “${ws.config.name}” with ${ws.data.tasks.length} tasks`);
            router.push("/dashboard");
          } catch (err) {
            toast.error("Import failed: " + (err as Error).message);
          }
        }}
      />
    </label>
  );
}
