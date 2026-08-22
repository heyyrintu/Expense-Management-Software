// KPI strip (D3.3) — DESIGN-PRD §7.4.
//
// StatCards plus the thing that usually gets left out: the footnotes.
//
// §7.4 says the number and the list must always agree. Most cards keep that
// by construction (same query, same href). A dashboard also carries figures
// that genuinely can't — "outstanding to employees" is report totals minus
// payments, which no expense filter reproduces. The choice is to hide that,
// or to say it.
//
// Hiding it is how a reader learns not to trust the strip: they click a
// figure once, get a list that doesn't add up to it, and from then on every
// card is suspect — including the ten that were exact. So a card computed
// differently prints its reason underneath, and the other cards keep their
// credibility.
//
// The notes come from `kpiNotes`, which reads the same `agreement` field the
// href came from. There is no way to link a card without declaring how its
// number relates to the list.
import { StatCard } from "@/components/ui/stat-card";
import { kpiNotes, type DashboardKpi } from "@/lib/domain/dashboard-kpi";
import { cn } from "@/lib/utils";

/**
 * Large-screen columns for a strip of `n` cards.
 *
 * Four was hard-coded until G2 gave finance a fifth (open complaints), which
 * under `lg:grid-cols-4` wrapped to a second row holding one card — a full-
 * width-looking orphan that reads as a different section rather than the
 * fifth member of a strip.
 *
 * Literal class strings, never `lg:grid-cols-${n}`: Tailwind scans source
 * text, so an interpolated class generates no CSS and the grid would silently
 * fall back to one column. Capped at five because a sixth card at 1/6 of the
 * content width can no longer hold a 32px display amount without wrapping —
 * a strip that wide wants to become two sections, not smaller type.
 */
function columnsFor(n: number): string {
  if (n <= 2) return "lg:grid-cols-2";
  if (n === 3) return "lg:grid-cols-3";
  if (n === 4) return "lg:grid-cols-4";
  return "lg:grid-cols-5";
}

export function KpiStrip({
  kpis,
  className,
  loading = false,
}: {
  kpis: DashboardKpi[];
  className?: string;
  loading?: boolean;
}) {
  const notes = kpiNotes(kpis);

  return (
    <div className="grid gap-3">
      <div className={cn("grid gap-4 sm:grid-cols-2", columnsFor(kpis.length), className)}>
        {kpis.map((kpi) => (
          <StatCard
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            currency={kpi.currency}
            hint={kpi.hint}
            delta={kpi.delta}
            trend={kpi.trend}
            href={kpi.agreement.href}
            loading={loading}
          />
        ))}
      </div>

      {!loading && notes.length > 0 ? (
        // Meta size and tertiary text: present for the reader who is
        // reconciling a figure, quiet for the reader who is not.
        <ul className="text-meta text-text-tertiary grid gap-1">
          {notes.map((note) => (
            <li key={note.label}>
              <span className="text-text-secondary">{note.label}:</span> {note.note}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
