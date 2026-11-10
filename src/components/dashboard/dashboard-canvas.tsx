"use client";
/**
 * Dashboard renderer + layout editor. Renders any WorkspaceConfig page through
 * the component registry. In edit mode widgets can be dragged (dnd-kit),
 * resized, configured, switched to another view or removed; pages can be
 * added, renamed and deleted.
 */
import { useEffect, useMemo, useState } from "react";
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Activity, BarChart3, Bug, CalendarDays, ClipboardCheck, ClipboardList, FileInput, FileText, GripVertical, Inbox, KanbanSquare, LayoutDashboard, ListChecks, MoreHorizontal, Pencil, Plus, Rocket, Settings2, Target, Trash2, Users, Repeat2 } from "lucide-react";
import type { Page, PageIcon, Widget, Workspace, WorkspaceConfig } from "@/lib/config/types";
import { RenderWidget, WIDGET_ICONS } from "./widget-registry";
import { CATALOG, convertWidget } from "@/lib/registry/catalog";
import { Card, EmptyState, Input } from "@/components/ui/primitives";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown";
import { useConfirm } from "@/components/ui/dialog";
import { WidgetSettingsDialog } from "@/components/editor/widget-settings-dialog";
import { AddWidgetDialog } from "@/components/editor/add-widget-dialog";
import { cn, slugify } from "@/lib/utils";

export const PAGE_ICON_MAP: Record<PageIcon, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  form: FileInput,
  tasks: ListChecks,
  users: Users,
  chart: BarChart3,
  calendar: CalendarDays,
  bug: Bug,
  rocket: Rocket,
  clipboard: ClipboardList,
  kanban: KanbanSquare,
  activity: Activity,
  inbox: Inbox,
  target: Target,
  file: FileText,
  review: ClipboardCheck,
};

const SPAN: Record<number, string> = {
  1: "col-span-1",
  2: "col-span-1 md:col-span-2",
  3: "col-span-1 md:col-span-2 xl:col-span-3",
  4: "col-span-1 md:col-span-2 xl:col-span-4",
};

interface Props {
  workspace: Workspace;
  pageId?: string;
  onPageChange?: (id: string) => void;
  editing?: boolean;
  readOnly?: boolean;
  onConfigChange?: (config: WorkspaceConfig, note?: string) => void;
  initialPageId?: string;
}

export function DashboardCanvas({ workspace, pageId, onPageChange, editing = false, readOnly = false, onConfigChange, initialPageId }: Props) {
  const { config } = workspace;
  const [localPage, setLocalPage] = useState(initialPageId ?? config.pages[0]?.id);
  const activeId = pageId ?? localPage;
  const page = config.pages.find((p) => p.id === activeId) ?? config.pages[0];
  const setPage = (id: string) => (onPageChange ? onPageChange(id) : setLocalPage(id));
  const confirm = useConfirm();
  const [settingsFor, setSettingsFor] = useState<Widget | null>(null);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);

  useEffect(() => {
    if (!config.pages.some((p) => p.id === activeId) && config.pages[0]) setPage(config.pages[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.pages, activeId]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const updatePage = (fn: (p: Page) => Page, note?: string) => {
    if (!onConfigChange || !page) return;
    onConfigChange({ ...config, pages: config.pages.map((p) => (p.id === page.id ? fn(p) : p)) }, note);
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    updatePage((p) => {
      const from = p.widgets.findIndex((w) => w.id === e.active.id);
      const to = p.widgets.findIndex((w) => w.id === e.over!.id);
      return { ...p, widgets: arrayMove(p.widgets, from, to) };
    });
  };

  const addPage = () => {
    const used = new Set(config.pages.map((p) => p.id));
    let id = "page";
    let n = 2;
    while (used.has(id)) id = `page_${n++}`;
    onConfigChange?.({ ...config, pages: [...config.pages, { id, title: config.language === "bn" ? "নতুন পেজ" : "New page", icon: "dashboard", widgets: [] }] }, "Page added");
    setPage(id);
    setRenaming(id);
  };

  const widgetIds = useMemo(() => page?.widgets.map((w) => w.id) ?? [], [page]);

  if (!page) return <EmptyState title="This workspace has no pages" />;

  return (
    <div className="space-y-4">
      {/* Page tabs */}
      <div className="flex items-center gap-1 overflow-x-auto border-b pb-px scrollbar-thin">
        {config.pages.map((p) => {
          const Icon = PAGE_ICON_MAP[p.icon ?? "dashboard"] ?? LayoutDashboard;
          const active = p.id === page.id;
          return (
            <div key={p.id} className={cn("group relative flex shrink-0 items-center", active && "after:absolute after:inset-x-1 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary")}>
              {renaming === p.id ? (
                <Input
                  autoFocus
                  defaultValue={p.title}
                  className="h-8 w-40"
                  onBlur={(e) => {
                    const title = e.target.value.trim() || p.title;
                    onConfigChange?.({ ...config, pages: config.pages.map((x) => (x.id === p.id ? { ...x, title } : x)) });
                    setRenaming(null);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                />
              ) : (
                <button onClick={() => setPage(p.id)} onDoubleClick={() => editing && setRenaming(p.id)} className={cn("flex items-center gap-1.5 rounded-md px-3 py-2 text-sm transition-colors", active ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  <Icon className="size-4" />
                  {p.title}
                </button>
              )}
              {editing && active && renaming !== p.id && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="rounded p-0.5 text-muted-foreground hover:bg-muted" aria-label="Page options"><MoreHorizontal className="size-3.5" /></button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    <DropdownMenuItem onSelect={() => setRenaming(p.id)}><Pencil /> Rename</DropdownMenuItem>
                    <DropdownMenuLabel>Icon</DropdownMenuLabel>
                    <div className="grid grid-cols-5 gap-1 px-1 pb-1">
                      {(Object.keys(PAGE_ICON_MAP) as PageIcon[]).map((ic) => {
                        const I = PAGE_ICON_MAP[ic];
                        return (
                          <button key={ic} className={cn("flex items-center justify-center rounded p-1.5 hover:bg-muted", p.icon === ic && "bg-accent")} onClick={() => onConfigChange?.({ ...config, pages: config.pages.map((x) => (x.id === p.id ? { ...x, icon: ic } : x)) })} aria-label={ic}>
                            <I className="size-4" />
                          </button>
                        );
                      })}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      destructive
                      disabled={config.pages.length <= 1}
                      onSelect={async () => {
                        if (await confirm({ title: `Delete page “${p.title}”?`, description: `Its ${p.widgets.length} widgets are removed. Data (tasks, records) is kept.`, destructive: true, confirmLabel: "Delete page" })) {
                          onConfigChange?.({ ...config, pages: config.pages.filter((x) => x.id !== p.id) }, `Page “${p.title}” removed`);
                        }
                      }}
                    >
                      <Trash2 /> Delete page
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          );
        })}
        {editing && (
          <Button variant="ghost" size="sm" className="shrink-0 text-muted-foreground" onClick={addPage}>
            <Plus /> Page
          </Button>
        )}
      </div>

      {page.widgets.length === 0 ? (
        <Card className="border-dashed">
          <EmptyState
            icon={<LayoutDashboard />}
            title="This page is empty"
            description={readOnly ? undefined : "Add widgets manually or ask the AI assistant, e.g. “add a weekly report chart”."}
            action={!readOnly && onConfigChange ? <Button size="sm" onClick={() => setAdding(true)}><Plus /> Add widget</Button> : undefined}
          />
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={widgetIds} strategy={rectSortingStrategy}>
            <div className="grid grid-flow-row-dense grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {page.widgets.map((w) => (
                <WidgetFrame
                  key={w.id}
                  widget={w}
                  editing={editing}
                  canEdit={!readOnly && !!onConfigChange}
                  onSettings={() => setSettingsFor(w)}
                  onResize={(width) => updatePage((p) => ({ ...p, widgets: p.widgets.map((x) => (x.id === w.id ? ({ ...x, width } as Widget) : x)) }))}
                  onSwitch={(to) => updatePage((p) => ({ ...p, widgets: p.widgets.map((x) => (x.id === w.id ? convertWidget(x, to, config) : x)) }))}
                  onRemove={async () => {
                    if (await confirm({ title: `Remove “${w.title}”?`, description: "Only the widget is removed — its data stays in the workspace.", destructive: true, confirmLabel: "Remove" })) {
                      updatePage((p) => ({ ...p, widgets: p.widgets.filter((x) => x.id !== w.id) }), `Widget “${w.title}” removed`);
                    }
                  }}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {editing && page.widgets.length > 0 && (
        <button onClick={() => setAdding(true)} className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-4 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground">
          <Plus className="size-4" /> Add widget to “{page.title}”
        </button>
      )}

      {onConfigChange && (
        <>
          <WidgetSettingsDialog config={config} widget={settingsFor} open={!!settingsFor} onOpenChange={(o) => !o && setSettingsFor(null)} onSave={(c) => onConfigChange(c, "Widget settings updated")} />
          <AddWidgetDialog
            config={config}
            open={adding}
            onOpenChange={setAdding}
            onAdd={(w) => {
              const used = new Set(config.pages.flatMap((p) => p.widgets.map((x) => x.id)));
              let id = slugify(w.title, "widget");
              let n = 2;
              while (used.has(id)) id = `${slugify(w.title, "widget")}_${n++}`;
              updatePage((p) => ({ ...p, widgets: [...p.widgets, { ...w, id }] }), `Widget “${w.title}” added`);
            }}
          />
        </>
      )}
    </div>
  );
}

function WidgetFrame({ widget, editing, canEdit, onSettings, onResize, onSwitch, onRemove }: { widget: Widget; editing: boolean; canEdit: boolean; onSettings: () => void; onResize: (w: number) => void; onSwitch: (t: Widget["type"]) => void; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: widget.id, disabled: !editing });
  const style = { transform: CSS.Translate.toString(transform), transition };
  const alternates = CATALOG[widget.type].alternates ?? [];
  const Icon = WIDGET_ICONS[widget.type];

  return (
    <Card ref={setNodeRef} style={style} className={cn(SPAN[widget.width] ?? SPAN[2], "card-3d flex min-w-0 flex-col rounded-2xl border bg-card/90 backdrop-blur-md shadow-xs transition-all", editing && "ring-1 ring-primary/20", isDragging && "z-10 opacity-80 shadow-2xl scale-[1.02]")}>
      <div className="flex items-start gap-1.5 px-4 pt-3.5 pb-2">
        {editing && (
          <button ref={setActivatorNodeRef} {...attributes} {...listeners} className="-ml-1.5 mt-0.5 cursor-grab touch-none rounded p-0.5 text-muted-foreground hover:bg-muted active:cursor-grabbing" aria-label="Drag to reorder">
            <GripVertical className="size-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold">{widget.title}</h3>
          {widget.description && <p className="truncate text-xs text-muted-foreground">{widget.description}</p>}
        </div>
        {canEdit && (alternates.length > 0 || editing) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn("rounded p-1 text-muted-foreground hover:bg-muted", !editing && "opacity-60 hover:opacity-100")} aria-label="Widget options">
                {editing ? <Settings2 className="size-4" /> : <Repeat2 className="size-4" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {alternates.length > 0 && (
                <>
                  <DropdownMenuLabel>Switch view</DropdownMenuLabel>
                  {alternates.map((a) => {
                    const AIcon = WIDGET_ICONS[a];
                    return (
                      <DropdownMenuItem key={a} onSelect={() => onSwitch(a)}><AIcon /> {CATALOG[a].label}</DropdownMenuItem>
                    );
                  })}
                </>
              )}
              {editing && (
                <>
                  {alternates.length > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem onSelect={onSettings}><Pencil /> Edit settings</DropdownMenuItem>
                  <DropdownMenuLabel>Width</DropdownMenuLabel>
                  <div className="flex gap-1 px-2 pb-1.5">
                    {[1, 2, 3, 4].map((n) => (
                      <button key={n} onClick={() => onResize(n)} className={cn("flex-1 rounded border py-1 text-xs", widget.width === n ? "border-primary bg-accent" : "hover:bg-muted")}>{["¼", "½", "¾", "Full"][n - 1]}</button>
                    ))}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem destructive onSelect={onRemove}><Trash2 /> Remove widget</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {!editing && <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />}
      </div>
      <div className="min-w-0 flex-1 px-4 pb-4">
        <RenderWidget widget={widget} />
      </div>
    </Card>
  );
}
