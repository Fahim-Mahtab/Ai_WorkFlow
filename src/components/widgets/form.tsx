"use client";
import { toast } from "sonner";
import type { WidgetOf } from "@/lib/config/types";
import { useEnv } from "@/components/dashboard/env";
import { RecordForm } from "@/components/fields/record-form";
import { useWorkspaceActions } from "@/lib/workspace/store";
import { EmptyState } from "@/components/ui/primitives";

export function FormWidget({ widget }: { widget: WidgetOf<"form"> }) {
  const { workspace, config, readOnly, t } = useEnv();
  const actions = useWorkspaceActions(workspace.id);
  const collection = config.collections.find((c) => c.id === widget.collectionId);
  if (!collection) return <EmptyState title="This form's collection no longer exists" description="Edit the widget to pick another collection." />;
  const count = workspace.data.records[collection.id]?.length ?? 0;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {collection.name} · {count} {t("rows")}
      </p>
      <RecordForm
        fields={collection.fields}
        members={config.team.members}
        lang={config.language}
        submitLabel={widget.submitLabel}
        disabled={readOnly}
        askCreatedBy
        compact={widget.width <= 1}
        onSubmit={(values, createdBy) => {
          actions.addRecord(collection.id, values, createdBy);
          toast.success(widget.successMessage ?? t("submitted"));
        }}
      />
    </div>
  );
}
