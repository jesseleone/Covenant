"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext, DragOverlay, KeyboardSensor, PointerSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from "@dnd-kit/core";
import { ChevronLeft, ChevronRight, Lock } from "lucide-react";
import { subMonths, parseISO } from "date-fns";
import { STAGES, STAGE_LABELS, PASS_REASON_LABELS, type DB, type Deal, type Stage } from "@/lib/schema";
import { evaluateGate } from "@/lib/gates";
import { canMoveStage } from "@/lib/permissions";
import { useCurrentUser, useDB } from "@/lib/store";
import { companyById, daysInStage, dealMetrics, sectionIsStale, userById } from "@/lib/selectors";
import { fmtUsdM } from "@/lib/format";
import { Avatar, Chip, cn } from "@/components/ui/primitives";
import { useStageMover } from "./stage-move";

const OUT = "out";
type ColumnId = Stage | typeof OUT;
type DropState = "ok" | "override" | "blocked" | "same";

export function PipelineBoard({ deals }: { deals: Deal[] }) {
  const db = useDB();
  const user = useCurrentUser();
  const router = useRouter();
  const mover = useStageMover();
  const [dragging, setDragging] = useState<Deal | null>(null);
  const [outOpen, setOutOpen] = useState(false);
  const [allClosed, setAllClosed] = useState(false);
  const justDragged = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const cutoff = subMonths(parseISO(db.settings.today), 12).toISOString().slice(0, 10);
  const columns = useMemo(() => {
    const byStage = new Map<ColumnId, Deal[]>(STAGES.map((s) => [s, []]));
    byStage.set(OUT, []);
    for (const d of deals) {
      if (d.status === "passed" || d.status === "lost" || d.status === "on_hold") byStage.get(OUT)!.push(d);
      else if (d.status === "closed") { if (allClosed || (d.closedAt ?? "") >= cutoff) byStage.get("closed")!.push(d); }
      else byStage.get(d.stage)!.push(d);
    }
    for (const list of byStage.values()) list.sort((a, b) => a.stageEnteredAt.localeCompare(b.stageEnteredAt));
    return byStage;
  }, [deals, allClosed, cutoff]);
  const hiddenClosed = deals.filter((d) => d.status === "closed").length - columns.get("closed")!.length;

  /** What would happen if the dragged deal were dropped on a column. */
  const dropState = (col: ColumnId): DropState => {
    if (!dragging || !user) return "ok";
    const out = dragging.status !== "active";
    if (col === OUT) return out ? "same" : canMoveStage(user.role, "screening") ? "ok" : "blocked";
    if (col === dragging.stage && !out) return "same";
    if (!canMoveStage(user.role, col)) return "blocked";
    const g = evaluateGate(db, dragging, col);
    return g.ok ? "ok" : g.hard ? "blocked" : "override";
  };

  const onDragStart = (e: DragStartEvent) => setDragging(deals.find((d) => d.id === e.active.id) ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    const deal = dragging;
    setDragging(null);
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 50);
    if (!deal || !e.over) return;
    const col = e.over.id as ColumnId;
    if (col === OUT) { if (deal.status === "active") mover.requestOutcome(deal); return; }
    mover.request(deal, col);
  };

  const open = (d: Deal) => { if (!justDragged.current) router.push(`/deals/${d.id}/overview`); };

  return (
    <>
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
        <div className="flex gap-2 overflow-x-auto pb-4">
          {STAGES.map((s) => {
            const list = columns.get(s)!;
            return (
              <Column key={s} id={s} title={STAGE_LABELS[s]} deals={list} state={dropState(s)}
                footer={s === "closed" && (hiddenClosed > 0 || allClosed) ? (
                  <button onClick={() => setAllClosed((v) => !v)} className="w-full rounded-[8px] py-1.5 text-[12px] text-text-3 hover:bg-surface-2 hover:text-text">
                    {allClosed ? "Last 12 months only" : `Show ${hiddenClosed} older`}
                  </button>
                ) : null}
              >
                {list.map((d) => <DraggableCard key={d.id} db={db} deal={d} onOpen={open} disabled={d.status === "closed"} />)}
              </Column>
            );
          })}
          {outOpen ? (
            <Column id={OUT} title="Passed / Lost" deals={columns.get(OUT)!} state={dropState(OUT)} muted
              action={<button onClick={() => setOutOpen(false)} aria-label="Collapse lane" className="rounded p-0.5 text-text-3 hover:text-text"><ChevronRight size={15} /></button>}>
              {columns.get(OUT)!.map((d) => <DraggableCard key={d.id} db={db} deal={d} onOpen={open} />)}
            </Column>
          ) : (
            <CollapsedLane count={columns.get(OUT)!.length} state={dropState(OUT)} onOpen={() => setOutOpen(true)} />
          )}
        </div>
        <DragOverlay dropAnimation={null}>{dragging && <CardBody db={db} deal={dragging} lifted />}</DragOverlay>
      </DndContext>
      {mover.ui}
    </>
  );
}

/** The collapsed Passed / Lost lane is still a drop target. */
function CollapsedLane({ count, state, onOpen }: { count: number; state: DropState; onOpen: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: OUT });
  return (
    <button
      ref={setNodeRef}
      onClick={onOpen}
      aria-label="Show passed and lost deals"
      className={cn(
        "flex w-11 shrink-0 flex-col items-center gap-3 rounded-[12px] bg-surface-2/50 py-3 text-[12px] text-text-3 transition-colors hover:text-text",
        state === "blocked" && "opacity-45",
        isOver && state === "ok" && "bg-danger-soft text-danger ring-2 ring-danger ring-inset",
      )}
    >
      <ChevronLeft size={15} />
      <span className="rotate-180 whitespace-nowrap [writing-mode:vertical-rl]">{isOver ? "Drop to pass" : `Passed / Lost · ${count}`}</span>
    </button>
  );
}

function Column({ id, title, deals, state, muted, children, footer, action }: {
  id: ColumnId; title: string; deals: Deal[]; state: DropState; muted?: boolean; children: React.ReactNode; footer?: React.ReactNode; action?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const total = deals.reduce((s, d) => s + d.requestedSize, 0);
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-w-[140px] flex-1 flex-col rounded-[12px] p-2 transition-[background-color,box-shadow,opacity] duration-150",
        muted ? "bg-surface-2/50" : "bg-sidebar",
        state === "blocked" && "opacity-45",
        state === "override" && "ring-1 ring-warn/50 ring-inset",
        isOver && state === "ok" && "bg-accent-soft ring-2 ring-accent ring-inset",
        isOver && state === "override" && "bg-warn-soft ring-2 ring-warn ring-inset",
      )}
    >
      <div className="flex items-baseline justify-between gap-2 px-1.5 pt-1 pb-2">
        <span className="flex items-center gap-1 text-[13px] font-medium whitespace-nowrap">
          {title} <span className="font-normal text-text-3">{deals.length}</span>
          {state === "blocked" && <Lock size={12} className="text-text-3" />}
        </span>
        <span className="flex items-center gap-1 text-[12px] text-text-3 tabular-nums">{fmtUsdM(total, 0)}{action}</span>
      </div>
      {state === "override" && <div className="mb-2 px-1.5 text-[11px] text-warn">Needs an override</div>}
      <div className="flex min-h-16 flex-col gap-2">{children}</div>
      {footer && <div className="mt-2">{footer}</div>}
    </div>
  );
}

function DraggableCard({ db, deal, onOpen, disabled }: { db: DB; deal: Deal; onOpen: (d: Deal) => void; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: deal.id, disabled });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(deal)}
      onKeyDown={(e) => { listeners?.onKeyDown?.(e); if (e.key === "Enter") onOpen(deal); }}
      className={cn("rounded-[12px] outline-none focus-visible:ring-2 focus-visible:ring-focus", isDragging && "opacity-30", disabled ? "cursor-pointer" : "cursor-grab active:cursor-grabbing")}
      aria-label={`${deal.name}.${disabled ? "" : " Press space to pick up and move."}`}
    >
      <CardBody db={db} deal={deal} />
    </div>
  );
}

function CardBody({ db, deal: d, lifted }: { db: DB; deal: Deal; lifted?: boolean }) {
  const m = dealMetrics(db, d.id);
  const lead = userById(db, d.leadUserId);
  const days = daysInStage(db, d);
  const redFlags = db.ddItems.filter((x) => x.dealId === d.id && x.severity === "red_flag" && !x.mitigant && !x.icConditionId).length;
  const memoIds = new Set(db.memos.filter((x) => x.dealId === d.id).map((x) => x.id));
  const stale = db.memoSections.some((s) => memoIds.has(s.memoId) && sectionIsStale(db, s));
  const out = d.status === "passed" || d.status === "lost" || d.status === "on_hold";
  return (
    <div className={cn("rounded-[12px] border border-border bg-surface p-2.5 transition-colors hover:border-border-strong", lifted && "rotate-[1.5deg] shadow-pop")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 truncate font-medium">
            {d.codename}
            {stale && <span title="A memo section is stale" className="size-1.5 shrink-0 rounded-full bg-warn" />}
          </div>
          <div className="truncate text-[12px] text-text-3">{companyById(db, d.borrowerCompanyId)?.name}</div>
        </div>
        {lead && <Avatar initials={lead.initials} title={lead.name} size={22} />}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-[13px] tabular-nums">{fmtUsdM(m.facilitySize)}</span>
        {d.status === "active" && <Chip tone={days > 30 ? "warn" : "neutral"} title="Days in stage">{days}d</Chip>}
        {redFlags > 0 && <Chip tone="danger">{redFlags} red flag</Chip>}
        {out && <Chip tone="outline">{d.status === "on_hold" ? "On hold" : d.passReason ? PASS_REASON_LABELS[d.passReason] : d.status}</Chip>}
        {out && <span className="text-[11px] text-text-3">at {STAGE_LABELS[d.stage]}</span>}
      </div>
    </div>
  );
}
