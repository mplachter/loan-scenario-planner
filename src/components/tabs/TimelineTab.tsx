import { useMemo, useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Explain, ExplainerNote } from "@/components/ui/explainer";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/ui/number-input";
import { SectionTitle } from "@/components/ui/section-title";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  dateToMonthISO,
  formatMonthYear,
  monthToDateISO,
  parseISO,
} from "@/lib/dates";
import {
  TERMS,
  type ClosedLoanInputs,
  type LoanInputs,
  type LoanTerm,
} from "@/lib/defaults";
import {
  createEscrowChangeEvent,
  createLumpSumEvent,
  createRecastEvent,
  createRecurringExtraEvent,
  createRefinanceEvent,
  EVENT_COLORS,
  EVENT_LABELS,
  type LumpSumEvent,
  type MortgageEvent,
  type RecurringExtraEvent,
  type TimelineVariant,
} from "@/lib/events";
import type { ExplainerKey } from "@/lib/explainers";
import type { Household } from "@/lib/household";
import { usd0 } from "@/lib/mortgage";
import {
  attributeEvents,
  type ServicingContext,
  type ServicingResult,
} from "@/lib/servicing";

interface TimelineTabProps {
  inputs: ClosedLoanInputs;
  onChange: (patch: Partial<LoanInputs>) => void;
  ctx: ServicingContext;
  result: ServicingResult;
  baseline: ServicingResult;
  currentMonth: number;
  household: Household;
}

function summarizeEvent(
  ev: MortgageEvent,
  firstPaymentDate: string,
  result: ServicingResult,
): string {
  const dateLabel = formatMonthYear(monthToDateISO(firstPaymentDate, ev.month));
  switch (ev.kind) {
    case "refinance": {
      const summary = result.refinances.find((r) => r.eventId === ev.id);
      const costsLabel = summary
        ? `${usd0(summary.costs)} costs ${ev.rollCostsIn ? "rolled in" : "out of pocket"}`
        : `${ev.closingCostPct}% + ${usd0(ev.closingCostFlat)} costs`;
      return `Refinance to ${ev.rate.toFixed(2)}% / ${ev.termYears}yr — ${dateLabel} · ${costsLabel}`;
    }
    case "extra": {
      const endLabel =
        ev.endMonth !== null
          ? ` through ${formatMonthYear(monthToDateISO(firstPaymentDate, ev.endMonth))}`
          : "";
      return `${ev.cadence === "monthly" ? "Monthly" : "Annual"} extra ${usd0(ev.amount)} from ${dateLabel}${endLabel}`;
    }
    case "lump":
      return `Lump sum ${usd0(ev.amount)} — ${dateLabel}`;
    case "recast":
      return `Recast with ${usd0(ev.lumpSum)} lump — ${dateLabel} · ${usd0(ev.fee)} fee`;
    case "escrow": {
      const parts: string[] = [];
      if (ev.taxAnnual !== null) parts.push(`tax ${usd0(ev.taxAnnual)}/yr`);
      if (ev.insuranceAnnual !== null)
        parts.push(`insurance ${usd0(ev.insuranceAnnual)}/yr`);
      return `Escrow change — ${dateLabel}${parts.length ? ` · ${parts.join(" · ")}` : ""}`;
    }
  }
}

function paymentImpact(
  ev: MortgageEvent,
  result: ServicingResult,
): { label: string; before: number; after: number } | null {
  if (ev.kind === "refinance") {
    const summary = result.refinances.find((r) => r.eventId === ev.id);
    if (!summary) return null;
    return {
      label: "Payment",
      before: summary.oldPayment,
      after: summary.newPayment,
    };
  }
  const afterRow = result.rows[ev.month - 1];
  if (!afterRow) return null;
  const beforeRow = result.rows[ev.month - 2];
  if (ev.kind === "recast") {
    return {
      label: "Payment",
      before: beforeRow?.scheduledPI ?? afterRow.scheduledPI,
      after: afterRow.scheduledPI,
    };
  }
  if (ev.kind === "escrow") {
    return {
      label: "Escrow",
      before: beforeRow?.escrow ?? afterRow.escrow,
      after: afterRow.escrow,
    };
  }
  if (ev.kind === "extra" || ev.kind === "lump") {
    return {
      label: "Total monthly outflow",
      before: beforeRow?.totalOutflow ?? afterRow.totalOutflow,
      after: afterRow.totalOutflow,
    };
  }
  return null;
}

// Month index of the next occurrence of a 1-indexed calendar month, at or after
// `notBefore`. Bonuses are pinned to a calendar month ("every March"), while
// timeline events are indexed off the first payment date.
function nextCalendarMonthIndex(
  firstPaymentDate: string,
  calendarMonth: number,
  notBefore: number,
): number {
  const { m } = parseISO(monthToDateISO(firstPaymentDate, notBefore));
  return notBefore + ((calendarMonth - m + 12) % 12);
}

interface AddEventContext {
  defaultMonth: number;
  currentMonth: number;
  firstPaymentDate: string;
  household: Household;
}

const ADD_EVENT_DEFS: {
  key: string;
  label: string;
  explainKey: ExplainerKey;
  create: (ctx: AddEventContext) => MortgageEvent;
}[] = [
  {
    key: "refinance",
    label: "+ Refinance",
    explainKey: "refinance",
    create: ({ defaultMonth }) => createRefinanceEvent(defaultMonth),
  },
  {
    key: "extra-monthly",
    label: "+ Monthly extra",
    explainKey: "recurringExtra",
    create: ({ defaultMonth }) =>
      createRecurringExtraEvent(defaultMonth, { cadence: "monthly" }),
  },
  {
    key: "extra-annual",
    label: "+ Annual bonus",
    explainKey: "recurringExtra",
    // Pre-filled from the Budget tab's bonus: its amount, landing in its
    // calendar month. That's the whole point of the bonus living outside
    // monthly income — it shows up here as principal instead.
    create: ({ currentMonth, firstPaymentDate, household }) =>
      createRecurringExtraEvent(
        nextCalendarMonthIndex(
          firstPaymentDate,
          household.bonusMonth,
          currentMonth + 1,
        ),
        {
          cadence: "annual",
          amount:
            household.annualBonusNet > 0 ? household.annualBonusNet : 10000,
          endMonth: null,
        },
      ),
  },
  {
    key: "lump",
    label: "+ Lump sum",
    explainKey: "lumpSum",
    create: ({ defaultMonth }) => createLumpSumEvent(defaultMonth),
  },
  {
    key: "recast",
    label: "+ Recast",
    explainKey: "recast",
    create: ({ defaultMonth }) => createRecastEvent(defaultMonth),
  },
  {
    key: "escrow",
    label: "+ Escrow change",
    explainKey: "escrow",
    create: ({ defaultMonth }) => createEscrowChangeEvent(defaultMonth),
  },
];

export function TimelineTab({
  inputs,
  onChange,
  ctx,
  result,
  baseline,
  currentMonth,
  household,
}: TimelineTabProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const firstPaymentDate = inputs.firstPaymentDate;

  const sortedEvents = useMemo(
    () => [...inputs.events].sort((a, b) => a.month - b.month),
    [inputs.events],
  );
  const pastEvents = sortedEvents.filter((e) => e.month <= currentMonth);
  const upcomingEvents = sortedEvents.filter((e) => e.month > currentMonth);

  function addEvent(create: (ctx: AddEventContext) => MortgageEvent) {
    const ev = create({
      defaultMonth: currentMonth + 12,
      currentMonth,
      firstPaymentDate,
      household,
    });
    onChange({ events: [...inputs.events, ev] });
    setEditingId(ev.id);
  }

  function updateEvent(id: string, patch: Partial<MortgageEvent>) {
    onChange({
      events: inputs.events.map((e) =>
        e.id === id ? ({ ...e, ...patch } as MortgageEvent) : e,
      ),
    });
  }

  function deleteEvent(id: string) {
    onChange({ events: inputs.events.filter((e) => e.id !== id) });
    if (editingId === id) setEditingId(null);
  }

  function saveVariant(name: string) {
    const variant: TimelineVariant = {
      id: crypto.randomUUID(),
      name,
      events: structuredClone(inputs.events),
    };
    onChange({ variants: [...inputs.variants, variant] });
  }

  function loadVariant(variant: TimelineVariant) {
    onChange({ events: structuredClone(variant.events) });
    setEditingId(null);
  }

  function updateVariant(id: string) {
    onChange({
      variants: inputs.variants.map((v) =>
        v.id === id ? { ...v, events: structuredClone(inputs.events) } : v,
      ),
    });
  }

  function deleteVariant(id: string) {
    onChange({ variants: inputs.variants.filter((v) => v.id !== id) });
  }

  const attributions = useMemo(
    () => attributeEvents(ctx, inputs.events),
    [ctx, inputs.events],
  );
  const sortedAttributions = [...attributions].sort(
    (a, b) => b.interestSaved - a.interestSaved,
  );

  const stacked = useMemo(() => {
    for (const row of result.rows) {
      if (row.month < currentMonth) continue;
      const contributing = row.eventIds
        .map((id) => inputs.events.find((e) => e.id === id))
        .filter(
          (e): e is RecurringExtraEvent | LumpSumEvent =>
            !!e && (e.kind === "extra" || e.kind === "lump"),
        );
      if (contributing.length >= 2) return { row, contributing };
    }
    return null;
  }, [result.rows, inputs.events, currentMonth]);

  const chartData = useMemo(() => {
    const maxYear = Math.max(result.yearly.length, baseline.yearly.length) - 1;
    const arr: { year: number; baseline: number; plan: number }[] = [];
    for (let y = 0; y <= maxYear; y++) {
      arr.push({
        year: y,
        baseline: baseline.yearly[y]?.balance ?? 0,
        plan: result.yearly[y]?.balance ?? 0,
      });
    }
    return arr;
  }, [result.yearly, baseline.yearly]);

  const currentYear = Math.round(currentMonth / 12);
  const refiYears = result.refinances
    .filter((r) => inputs.events.find((e) => e.id === r.eventId)?.enabled)
    .map((r) => Math.round(r.month / 12));

  const serialRefiWarning =
    result.refinances.length >= 2 &&
    result.balanceAt(currentMonth + 24) > baseline.balanceAt(currentMonth + 24);
  const clockResetRefis = result.refinances.filter(
    (r) => r.termResetMonths > 0,
  );

  return (
    <>
      <SectionTitle
        title="Your timeline"
        note="Every event you add here compounds with every other one — nothing here overrides anything else."
      />

      <div className="mb-4">
        <SaveVariantDialog onSave={saveVariant} />
        <VariantList
          variants={inputs.variants}
          hasCurrentEvents={inputs.events.length > 0}
          onLoad={loadVariant}
          onUpdate={updateVariant}
          onDelete={deleteVariant}
        />
      </div>

      <Card className="mb-4">
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-4">
            {ADD_EVENT_DEFS.map((def) => (
              <span
                key={def.key}
                className="inline-flex items-center gap-1 rounded border border-slate-300 hover:border-slate-400 pr-1.5"
              >
                <button
                  type="button"
                  onClick={() => addEvent(def.create)}
                  className="text-xs pl-2 pr-1 py-1 text-slate-600"
                >
                  {def.label}
                </button>
                <Explain k={def.explainKey} />
              </span>
            ))}
          </div>

          {sortedEvents.length === 0 && (
            <div className="text-sm text-slate-500">
              No events yet — add a refinance, extra payment, lump sum, recast,
              or escrow change above to start modeling your mortgage's future.
            </div>
          )}

          {upcomingEvents.length > 0 && (
            <div className="space-y-2 mb-3">
              {upcomingEvents.map((ev) => (
                <EventRow
                  key={ev.id}
                  ev={ev}
                  firstPaymentDate={firstPaymentDate}
                  result={result}
                  editing={editingId === ev.id}
                  onToggleEdit={() =>
                    setEditingId(editingId === ev.id ? null : ev.id)
                  }
                  onToggleEnabled={() =>
                    updateEvent(ev.id, { enabled: !ev.enabled })
                  }
                  onDelete={() => deleteEvent(ev.id)}
                  onUpdate={(patch) => updateEvent(ev.id, patch)}
                  currentScheduledPI={
                    result.rows[Math.max(currentMonth, 1) - 1]?.scheduledPI ?? 0
                  }
                />
              ))}
            </div>
          )}

          {pastEvents.length > 0 && (
            <>
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 pt-2 pb-1 border-t border-slate-100">
                Already happened
              </div>
              <div className="space-y-2 opacity-60">
                {pastEvents.map((ev) => (
                  <EventRow
                    key={ev.id}
                    ev={ev}
                    firstPaymentDate={firstPaymentDate}
                    result={result}
                    editing={editingId === ev.id}
                    onToggleEdit={() =>
                      setEditingId(editingId === ev.id ? null : ev.id)
                    }
                    onToggleEnabled={() =>
                      updateEvent(ev.id, { enabled: !ev.enabled })
                    }
                    onDelete={() => deleteEvent(ev.id)}
                    onUpdate={(patch) => updateEvent(ev.id, patch)}
                    currentScheduledPI={
                      result.rows[Math.max(currentMonth, 1) - 1]?.scheduledPI ??
                      0
                    }
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {stacked && (
        <div className="mb-4 bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-900">
          In {formatMonthYear(stacked.row.date)} you're sending{" "}
          <span className="font-semibold">{usd0(stacked.row.extra)}</span> extra
          —{" "}
          {stacked.contributing
            .map((e) =>
              e.kind === "extra"
                ? `${usd0(e.amount)} ${e.cadence}`
                : `${usd0(e.amount)} lump`,
            )
            .join(" plus ")}
          .
        </div>
      )}

      <Card className="mb-4">
        <CardContent>
          <div className="text-sm font-medium text-slate-700 mb-3">
            Payoff summary
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
            <div>
              <div className="text-xs text-slate-500 mb-1">Payoff date</div>
              <div className="text-lg font-bold tabular-nums text-slate-900">
                {formatMonthYear(result.payoffDate)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">Total interest</div>
              <div className="text-lg font-bold tabular-nums text-slate-900">
                {usd0(result.totalInterest)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">
                Interest saved vs. doing nothing
              </div>
              <div
                className={`text-lg font-bold tabular-nums ${
                  baseline.totalInterest - result.totalInterest >= 0
                    ? "text-teal-700"
                    : "text-red-600"
                }`}
              >
                {usd0(Math.abs(baseline.totalInterest - result.totalInterest))}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-1">
                Total extra paid
              </div>
              <div className="text-lg font-bold tabular-nums text-slate-900">
                {usd0(result.totalExtraPaid)}
              </div>
            </div>
          </div>
          {result.totalFees > 0 && (
            <div className="text-xs text-slate-500">
              {usd0(result.totalFees)} in refinance/recast costs across the
              whole timeline.
            </div>
          )}
        </CardContent>
      </Card>

      {sortedAttributions.length > 0 && (
        <Card className="mb-4">
          <CardContent>
            <div className="text-sm font-medium text-slate-700 mb-1">
              What each lever is doing
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Each figure is what changes if you remove that one item; because
              they interact, they won't add up to the total exactly.
            </p>
            <div className="space-y-2">
              {sortedAttributions.map((a) => {
                const ev = inputs.events.find((e) => e.id === a.eventId);
                if (!ev) return null;
                return (
                  <div
                    key={a.eventId}
                    className="flex flex-wrap items-baseline justify-between gap-2 text-sm border-b border-slate-100 pb-2 last:border-0"
                  >
                    <span className="text-slate-600">
                      {summarizeEvent(ev, firstPaymentDate, result)}
                    </span>
                    <span className="text-xs text-slate-500 whitespace-nowrap">
                      Drop this and you'd pay{" "}
                      <span
                        className={
                          a.interestSaved >= 0
                            ? "text-red-600 font-medium"
                            : "text-teal-700 font-medium"
                        }
                      >
                        {usd0(Math.abs(a.interestSaved))}{" "}
                        {a.interestSaved >= 0 ? "more" : "less"}
                      </span>{" "}
                      and finish {Math.abs(a.monthsSaved)} month
                      {Math.abs(a.monthsSaved) === 1 ? "" : "s"}{" "}
                      {a.monthsSaved >= 0 ? "later" : "earlier"}.
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="mb-4">
        <CardContent>
          <div className="text-sm font-medium text-slate-700 mb-3">
            Balance over time
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 10, right: 20, left: 10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="year"
                  tick={{ fontSize: 12 }}
                  label={{
                    value: "Year",
                    position: "insideBottom",
                    offset: -2,
                    fontSize: 12,
                  }}
                />
                <YAxis
                  tickFormatter={(v) => `$${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 12 }}
                  width={55}
                />
                <RechartsTooltip
                  formatter={(v: number) => usd0(v)}
                  labelFormatter={(l) => `Year ${l}`}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine
                  x={currentYear}
                  stroke="#0f766e"
                  strokeDasharray="3 3"
                  label={{
                    value: "Today",
                    position: "top",
                    fontSize: 12,
                    fill: "#0f766e",
                  }}
                />
                {refiYears.map((y, i) => (
                  <ReferenceLine
                    key={i}
                    x={y}
                    stroke="#c026d3"
                    strokeDasharray="3 3"
                    label={{
                      value: "Refi",
                      position: "top",
                      fontSize: 12,
                      fill: "#c026d3",
                    }}
                  />
                ))}
                <Line
                  type="monotone"
                  dataKey="baseline"
                  name="Do nothing"
                  stroke="#94a3b8"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="plan"
                  name="Your timeline"
                  stroke="#0f766e"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {serialRefiWarning && (
        <div className="mb-4">
          <ExplainerNote k="serialRefiTrap" />
          <div className="mt-1 text-xs text-amber-700">
            Total refinance/recast costs across your timeline:{" "}
            {usd0(result.totalFees)}.
          </div>
        </div>
      )}

      {clockResetRefis.map((r) => (
        <div
          key={r.eventId}
          className="mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800 flex items-start gap-1"
        >
          <span>
            Your {formatMonthYear(r.date)} refinance adds{" "}
            {Math.round(r.termResetMonths / 12)} year
            {Math.round(r.termResetMonths / 12) === 1 ? "" : "s"} to the clock
            versus continuing your original term.
          </span>
          <Explain k="clockReset" />
        </div>
      ))}
    </>
  );
}

function SaveVariantDialog({ onSave }: { onSave: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) setName("");
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className="text-xs px-2 py-1 rounded border border-slate-300 hover:border-slate-400 text-slate-600"
          />
        }
      >
        Save as variant…
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save this timeline as a variant</DialogTitle>
        </DialogHeader>
        <Field label="Name">
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder='e.g. "Refi @3+5"'
          />
        </Field>
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <DialogClose
            variant="default"
            disabled={!name.trim()}
            onClick={() => onSave(name.trim())}
          >
            Save
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function VariantList({
  variants,
  hasCurrentEvents,
  onLoad,
  onUpdate,
  onDelete,
}: {
  variants: TimelineVariant[];
  hasCurrentEvents: boolean;
  onLoad: (v: TimelineVariant) => void;
  onUpdate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (variants.length === 0) return null;
  return (
    <div className="space-y-2 mb-4">
      {variants.map((v) => {
        const kinds = [...new Set(v.events.map((e) => e.kind))];
        return (
          <Card key={v.id} size="sm">
            <CardHeader>
              <CardTitle>{v.name}</CardTitle>
              <CardDescription>
                {v.events.length} event{v.events.length === 1 ? "" : "s"}
                {kinds.length > 0 &&
                  ` · ${kinds.map((k) => EVENT_LABELS[k]).join(", ")}`}
              </CardDescription>
              <CardAction className="flex items-center gap-1">
                {hasCurrentEvents ? (
                  <AlertDialog>
                    <AlertDialogTrigger
                      render={<Button variant="outline" size="sm" />}
                    >
                      Load
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          Replace your current timeline with "{v.name}"?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          Any edits you've made since your last save will be
                          lost unless they're saved as a variant.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onLoad(v)}>
                          Load
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => onLoad(v)}>
                    Load
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onUpdate(v.id)}
                >
                  Update
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger
                    render={<Button variant="ghost" size="icon-xs" />}
                  >
                    <Trash2 />
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete "{v.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This can't be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(v.id)}>
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardAction>
            </CardHeader>
          </Card>
        );
      })}
    </div>
  );
}

interface EventRowProps {
  ev: MortgageEvent;
  firstPaymentDate: string;
  result: ServicingResult;
  editing: boolean;
  onToggleEdit: () => void;
  onToggleEnabled: () => void;
  onDelete: () => void;
  onUpdate: (patch: Partial<MortgageEvent>) => void;
  currentScheduledPI: number;
}

function EventRow({
  ev,
  firstPaymentDate,
  result,
  editing,
  onToggleEdit,
  onToggleEnabled,
  onDelete,
  onUpdate,
  currentScheduledPI,
}: EventRowProps) {
  const impact = paymentImpact(ev, result);
  return (
    <div className="rounded-lg border border-slate-200">
      <div className="flex items-center gap-2 p-2">
        <span
          className="text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0"
          style={{
            backgroundColor: `${EVENT_COLORS[ev.kind]}20`,
            color: EVENT_COLORS[ev.kind],
          }}
        >
          {EVENT_LABELS[ev.kind]}
        </span>
        <span className="text-sm text-slate-700 flex-1 min-w-0 truncate">
          {summarizeEvent(ev, firstPaymentDate, result)}
        </span>
        <Switch checked={ev.enabled} onCheckedChange={onToggleEnabled} />
        <Button variant="ghost" size="icon-xs" onClick={onToggleEdit}>
          <Pencil />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger
            render={<Button variant="ghost" size="icon-xs" />}
          >
            <Trash2 />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this event?</AlertDialogTitle>
              <AlertDialogDescription>
                This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {impact && Math.abs(impact.after - impact.before) >= 0.5 && (
        <div className="px-2 pb-2 -mt-1 text-xs text-slate-500">
          {impact.label}: {usd0(impact.before)} → {usd0(impact.after)}/mo
        </div>
      )}
      {editing && (
        <div className="border-t border-slate-100 p-3">
          <EventEditor
            ev={ev}
            firstPaymentDate={firstPaymentDate}
            onUpdate={onUpdate}
            currentScheduledPI={currentScheduledPI}
          />
        </div>
      )}
    </div>
  );
}

function MonthField({
  month,
  firstPaymentDate,
  onChange,
}: {
  month: number;
  firstPaymentDate: string;
  onChange: (month: number) => void;
}) {
  return (
    <Field label="Date" hint={`Year ${Math.max(Math.ceil(month / 12), 1)}`}>
      <input
        type="date"
        min={firstPaymentDate}
        value={monthToDateISO(firstPaymentDate, month)}
        onChange={(e) =>
          onChange(
            Math.max(dateToMonthISO(firstPaymentDate, e.target.value), 1),
          )
        }
        className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
      />
    </Field>
  );
}

function EventEditor({
  ev,
  firstPaymentDate,
  onUpdate,
  currentScheduledPI,
}: {
  ev: MortgageEvent;
  firstPaymentDate: string;
  onUpdate: (patch: Partial<MortgageEvent>) => void;
  currentScheduledPI: number;
}) {
  if (ev.kind === "refinance") {
    return (
      <div className="grid md:grid-cols-2 gap-3">
        <MonthField
          month={ev.month}
          firstPaymentDate={firstPaymentDate}
          onChange={(month) => onUpdate({ month })}
        />
        <Field label="New rate">
          <NumberInput
            value={ev.rate}
            onChange={(v) => onUpdate({ rate: v })}
            suffix="%"
            step={0.05}
          />
        </Field>
        <div>
          <div className="text-xs font-medium text-slate-600 mb-1">
            New term
          </div>
          <ToggleGroup
            variant="outline"
            value={[String(ev.termYears)]}
            onValueChange={(vals) => {
              const next = vals[0];
              if (next) onUpdate({ termYears: Number(next) as LoanTerm });
            }}
            className="flex-wrap"
          >
            {TERMS.map((t) => (
              <ToggleGroupItem key={t} value={String(t)}>
                {t}-year
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <Field label="Closing costs (% of payoff balance)">
          <NumberInput
            value={ev.closingCostPct}
            onChange={(v) => onUpdate({ closingCostPct: v })}
            suffix="%"
            step={0.25}
          />
        </Field>
        <Field label="Closing costs (flat $)">
          <NumberInput
            value={ev.closingCostFlat}
            onChange={(v) => onUpdate({ closingCostFlat: v })}
            prefix="$"
            step={100}
          />
        </Field>
        <Field label="Cash out">
          <NumberInput
            value={ev.cashOut}
            onChange={(v) => onUpdate({ cashOut: v })}
            prefix="$"
            step={1000}
          />
        </Field>
        <div className="flex items-center gap-2 pt-5">
          <Switch
            checked={ev.rollCostsIn}
            onCheckedChange={(checked) => onUpdate({ rollCostsIn: checked })}
          />
          <span className="text-sm text-slate-600">
            Roll closing costs into new balance
          </span>
        </div>
      </div>
    );
  }

  if (ev.kind === "extra") {
    return (
      <div className="grid md:grid-cols-2 gap-3">
        <MonthField
          month={ev.month}
          firstPaymentDate={firstPaymentDate}
          onChange={(month) => onUpdate({ month })}
        />
        <Field label="Amount">
          <NumberInput
            value={ev.amount}
            onChange={(v) => onUpdate({ amount: v })}
            prefix="$"
            step={25}
          />
        </Field>
        <div>
          <div className="text-xs font-medium text-slate-600 mb-1">Cadence</div>
          <ToggleGroup
            variant="outline"
            value={[ev.cadence]}
            onValueChange={(vals) => {
              const next = vals[0] as "monthly" | "annual" | undefined;
              if (next) onUpdate({ cadence: next });
            }}
          >
            <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
            <ToggleGroupItem value="annual">Annual</ToggleGroupItem>
          </ToggleGroup>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Switch
              checked={ev.endMonth !== null}
              onCheckedChange={(checked) =>
                onUpdate({ endMonth: checked ? ev.month : null })
              }
            />
            <span className="text-xs font-medium text-slate-600">
              Stop at a specific date
            </span>
          </div>
          {ev.endMonth !== null && (
            <input
              type="date"
              min={monthToDateISO(firstPaymentDate, ev.month)}
              value={monthToDateISO(firstPaymentDate, ev.endMonth)}
              onChange={(e) =>
                onUpdate({
                  endMonth: Math.max(
                    dateToMonthISO(firstPaymentDate, e.target.value),
                    ev.month,
                  ),
                })
              }
              className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
            />
          )}
        </div>
        {ev.cadence === "monthly" && (
          <div className="md:col-span-2 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onUpdate({ amount: currentScheduledPI / 12 })}
              className="text-xs px-2 py-1 rounded border border-slate-300 hover:border-slate-400 text-slate-600"
            >
              Biweekly equivalent
            </button>
            <Explain k="biweekly" />
          </div>
        )}
      </div>
    );
  }

  if (ev.kind === "lump") {
    return (
      <div className="grid md:grid-cols-2 gap-3">
        <MonthField
          month={ev.month}
          firstPaymentDate={firstPaymentDate}
          onChange={(month) => onUpdate({ month })}
        />
        <Field label="Amount">
          <NumberInput
            value={ev.amount}
            onChange={(v) => onUpdate({ amount: v })}
            prefix="$"
            step={500}
          />
        </Field>
      </div>
    );
  }

  if (ev.kind === "recast") {
    return (
      <div className="grid md:grid-cols-2 gap-3">
        <MonthField
          month={ev.month}
          firstPaymentDate={firstPaymentDate}
          onChange={(month) => onUpdate({ month })}
        />
        <Field label="Lump sum applied to principal">
          <NumberInput
            value={ev.lumpSum}
            onChange={(v) => onUpdate({ lumpSum: v })}
            prefix="$"
            step={500}
          />
        </Field>
        <Field label="Recast fee">
          <NumberInput
            value={ev.fee}
            onChange={(v) => onUpdate({ fee: v })}
            prefix="$"
            step={25}
          />
        </Field>
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-3">
      <MonthField
        month={ev.month}
        firstPaymentDate={firstPaymentDate}
        onChange={(month) => onUpdate({ month })}
      />
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Switch
            checked={ev.taxAnnual !== null}
            onCheckedChange={(checked) =>
              onUpdate({ taxAnnual: checked ? 0 : null })
            }
          />
          <span className="text-xs font-medium text-slate-600">
            Override annual property tax
          </span>
        </div>
        {ev.taxAnnual !== null && (
          <NumberInput
            value={ev.taxAnnual}
            onChange={(v) => onUpdate({ taxAnnual: v })}
            prefix="$"
            step={100}
          />
        )}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Switch
            checked={ev.insuranceAnnual !== null}
            onCheckedChange={(checked) =>
              onUpdate({ insuranceAnnual: checked ? 0 : null })
            }
          />
          <span className="text-xs font-medium text-slate-600">
            Override annual insurance
          </span>
        </div>
        {ev.insuranceAnnual !== null && (
          <NumberInput
            value={ev.insuranceAnnual}
            onChange={(v) => onUpdate({ insuranceAnnual: v })}
            prefix="$"
            step={100}
          />
        )}
      </div>
    </div>
  );
}
