"use client";
/** Task board grouped by the workspace's custom statuses; drag cards between columns (dnd-kit). */
import { useMemo, useState } from "react";
import { DndContext, DragOverlay, PointerSensor, KeyboardSensor, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { CheckSquare, MessageSquare, Paperclip, Plus } from "lucide-react";
import type { Task, WidgetOf } from "@/lib/config/types";
import { useEnv } from "@/components/dashboard/env";
import { applyFilter } from "@/lib/engine/query";
import { getRows } from "@/lib/engine/sources";
import { useWorkspaceActions } from "@/lib/workspace/store";
import { AssigneeStack, DueDate, PriorityBadge } from "@/components/tasks/task-bits";
import { DOT_COLORS } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

export function KanbanWidget({ widget }: { widget: WidgetOf<"kanban"> }) {
  const { workspace, config, readOnly, openTask, newTask, t } = useEnv();
  const actions = useWorkspaceActions(workspace.id);
  const [dragging, setDragging] = useState<Task | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor));

  const tasks = useMemo(() => {
    const allowed = new Set(applyFilter(getRows(workspace, "tasks"), widget.filter).map((r) => r.id));
    return workspace.data.tasks.filter((t) => allowed.has(t.id));
  }, [workspace, widget.filter]);

  const statusIds = new Set(config.taskStatuses.map((s) => s.id));
  const byStatus = (sid: string, isFirst: boolean) => tasks.filter((t) => t.status === sid || (isFirst && !statusIds.has(t.status)));

  const onDragEnd = (e: DragEndEvent) => {
    setDragging(null);
    const taskId = String(e.active.id);
    const to = e.over?.id ? String(e.over.id) : null;
    if (!to) return;
    const task = workspace.data.tasks.find((x) => x.id === taskId);
    if (task && task.status !== to) actions.updateTask(taskId, { status: to });
  };

  return (
    <DndContext sensors={sensors} onDragStart={(e) => setDragging(workspace.data.tasks.find((x) => x.id === e.active.id) ?? null)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2 scrollbar-thin">
        {config.taskStatuses.map((s, i) => {
          const items = byStatus(s.id, i === 0);
          return (
            <Column key={s.id} id={s.id} disabled={readOnly}>
              <div className="flex items-center justify-between px-1 pb-2">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <span className={cn("size-2 rounded-full", DOT_COLORS[s.color])} />
                  {s.label}
                  <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">{items.length}</span>
                </div>
                {!readOnly && (
                  <button className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => newTask({ status: s.id })} aria-label={t("addTask")}>
                    <Plus className="size-3.5" />
                  </button>
                )}
              </div>
              <div className="flex min-h-16 flex-col gap-2">
                {items.map((task) => (
                  <DraggableCard key={task.id} task={task} disabled={readOnly} onOpen={() => openTask(task.id)} />
                ))}
              </div>
            </Column>
          );
        })}
      </div>
      <DragOverlay>{dragging ? <CardBody task={dragging} overlay /> : null}</DragOverlay>
    </DndContext>
  );
}

function Column({ id, disabled, children }: { id: string; disabled?: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id, disabled });
  return (
    <div ref={setNodeRef} className={cn("flex w-64 shrink-0 flex-col rounded-lg bg-muted/50 p-2 transition-colors", isOver && "bg-accent ring-2 ring-primary/30")}>
      {children}
    </div>
  );
}

function DraggableCard({ task, disabled, onOpen }: { task: Task; disabled?: boolean; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled });
  return (
    <div ref={setNodeRef} {...attributes} {...listeners} onClick={onOpen} className={cn("cursor-grab touch-none active:cursor-grabbing", isDragging && "opacity-30")}>
      <CardBody task={task} />
    </div>
  );
}

function CardBody({ task, overlay }: { task: Task; overlay?: boolean }) {
  const { config } = useEnv();
  const done = config.taskStatuses.find((s) => s.id === task.status)?.isDone;
  const subDone = task.subtasks.filter((s) => s.done).length;
  return (
    <div className={cn("space-y-2 rounded-lg border bg-card p-2.5 text-left shadow-xs transition-shadow hover:shadow-sm", overlay && "rotate-2 shadow-lg")}>
      <p className={cn("text-sm leading-snug font-medium", done && "text-muted-foreground line-through")}>{task.title}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <PriorityBadge config={config} priority={task.priority} />
        {task.kind === "self" && <span className="text-[10px] text-violet-600 dark:text-violet-400">self</span>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          {task.subtasks.length > 0 && (
            <span className="inline-flex items-center gap-0.5"><CheckSquare className="size-3" />{subDone}/{task.subtasks.length}</span>
          )}
          {task.comments.length > 0 && (
            <span className="inline-flex items-center gap-0.5"><MessageSquare className="size-3" />{task.comments.length}</span>
          )}
          {task.links.length > 0 && (
            <span className="inline-flex items-center gap-0.5"><Paperclip className="size-3" />{task.links.length}</span>
          )}
          <DueDate date={task.dueDate} done={done} />
        </div>
        <AssigneeStack config={config} ids={task.assigneeIds} />
      </div>
    </div>
  );
}
