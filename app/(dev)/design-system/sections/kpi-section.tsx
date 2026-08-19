"use client";

// StatCard and the chart theme (D1.4) — DESIGN-PRD §6.2.
import * as React from "react";

import { BreakdownBarChart } from "@/components/charts/breakdown-bar";
import { MonthlyBarChart } from "@/components/charts/monthly-bar";
import { TrendAreaChart } from "@/components/charts/trend-area";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui/stat-card";
import { CHART_SERIES } from "@/lib/charts/theme";
import { Block, Group, Panel, Row } from "./shared";

const MONTHLY = [
  { month: "Mar", total: 412_000 },
  { month: "Apr", total: 388_500 },
  { month: "May", total: 501_200 },
  { month: "Jun", total: 447_800 },
  { month: "Jul", total: 623_400 },
  { month: "Aug", total: 512_900 },
];

const BREAKDOWN = [
  { label: "Travel", total: 288_400 },
  { label: "Meals", total: 121_900 },
  { label: "Software", total: 96_500 },
  { label: "Lodging", total: 74_300 },
  { label: "Other", total: 31_800 },
];

const TREND = MONTHLY.map((m, i) => ({
  month: m.month,
  Travel: Math.round(m.total * (0.55 + i * 0.01)),
  Meals: Math.round(m.total * 0.25),
  Software: Math.round(m.total * (0.2 - i * 0.01)),
}));

const SPARK = MONTHLY.map((m) => m.total);

type Variant = "loaded" | "loading" | "empty";

export function KpiSection() {
  const [variant, setVariant] = React.useState<Variant>("loaded");
  // Remounting replays the count-up, which otherwise runs once and is gone.
  const [replayKey, setReplayKey] = React.useState(0);

  const loading = variant === "loading";
  const empty = variant === "empty";

  return (
    <Group
      id="kpi"
      eyebrow="§6.2 · §7.4"
      title="StatCard and charts"
      description="A KPI is a claim about the data. Every card here links to the list behind its number, and the two are built from one query — the figure and the rows it opens cannot drift apart."
    >
      <Block
        title="Variants"
        description="Loading holds the card's shape so the strip doesn't reflow when figures arrive. Empty is a real zero, not a dash — nothing spent is a fact, not a missing value."
      >
        <Row label="State">
          {(["loaded", "loading", "empty"] as const).map((v) => (
            <Button
              key={v}
              size="sm"
              variant={variant === v ? "primary" : "secondary"}
              onClick={() => setVariant(v)}
            >
              {v[0].toUpperCase() + v.slice(1)}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setReplayKey((k) => k + 1)}>
            Replay count-up
          </Button>
        </Row>

        <div key={replayKey} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total in view"
            value={empty ? 0 : 2_486_000}
            currency="INR"
            hint={empty ? "0 expenses" : "62 expenses"}
            loading={loading}
          />
          <StatCard
            label="Awaiting approval"
            value={empty ? 0 : 412_500}
            currency="INR"
            hint={empty ? "0 expenses" : "9 expenses"}
            href="/expenses?status=submitted"
            delta={{ percent: 12.4, label: "vs last month", goodDirection: "down" }}
            loading={loading}
          />
          <StatCard
            label="Reimbursed"
            value={empty ? 0 : 1_845_200}
            currency="INR"
            hint={empty ? "0 expenses" : "41 expenses"}
            href="/expenses?status=reimbursed"
            delta={{ percent: -3.2, label: "vs last month", goodDirection: "up" }}
            trend={empty ? undefined : SPARK}
            loading={loading}
          />
          <StatCard
            label="Policy violations"
            value={empty ? 0 : 7}
            hint="not money — a plain count"
            delta={{ percent: 0 }}
            loading={loading}
          />
        </div>

        <Panel>
          <ul className="text-meta text-text-secondary grid gap-2">
            <li>
              <strong className="text-text-primary">The delta knows which way is good.</strong>{" "}
              Spend rising is not a win and reimbursements rising is; without
              <code> goodDirection</code> the component would guess, and it
              would guess wrong half the time on a finance screen.
            </li>
            <li>
              <strong className="text-text-primary">Direction is a shape, not just a colour.</strong>{" "}
              The arrow carries it too, so the chip survives greyscale printing
              and colour-vision deficiency (§5.1).
            </li>
            <li>
              <strong className="text-text-primary">The count-up runs once.</strong> 300ms —
              §6.2 allows 400 but the project&apos;s motion ceiling is 300 and
              300 satisfies both. It does not re-run when the value changes: a
              KPI that re-counts on every filter is a number you wait for
              repeatedly. Reduced motion skips it entirely.
            </li>
            <li>
              <strong className="text-text-primary">The sparkline is aria-hidden.</strong> It
              shows shape, not values; the numbers a screen reader needs are
              the value and delta above it.
            </li>
          </ul>
        </Panel>
      </Block>

      <Block
        title="Chart theme"
        description="Grid at --line 50%, axes in --text-tertiary at 12px, tooltips styled as a Card with money through <Amount>, and a 300ms draw-in on mount only — never on update, because a bar re-growing from zero on every filter change makes the number unreadable exactly when you want to read it."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Single series — the accent">
            <MonthlyBarChart data={empty ? [] : MONTHLY} currency="INR" loading={loading} />
          </Panel>
          <Panel title="Secondary series">
            <BreakdownBarChart data={empty ? [] : BREAKDOWN} currency="INR" loading={loading} />
          </Panel>
          <Panel title="Stacked categorical" className="lg:col-span-2">
            <TrendAreaChart
              series={empty ? [] : TREND}
              labels={["Travel", "Meals", "Software"]}
              currency="INR"
              loading={loading}
            />
          </Panel>
        </div>

        <Panel title="Palette">
          <div className="flex flex-wrap gap-3">
            {CHART_SERIES.map((color, i) => (
              <div key={color} className="grid gap-1">
                <span
                  className="border-line block size-12 rounded-md border"
                  style={{ background: color }}
                />
                <code className="text-meta text-text-tertiary tabular">
                  {i === 0 ? "accent" : i === CHART_SERIES.length - 1 ? "other" : `series ${i + 1}`}
                </code>
              </div>
            ))}
          </div>
          <p className="text-meta text-text-tertiary">
            The accent leads and the rest sit at roughly half its chroma, so it
            stays the colour your eye lands on. Never a rainbow: fully
            saturated palettes make every series shout equally, which is the
            opposite of what a chart is for.
          </p>
        </Panel>

        <Panel title="Accessible fallback">
          <p className="text-meta text-text-secondary">
            Every chart carries an aria-label summarising its series — range,
            endpoints and peak — and a <em>Show data</em> toggle that reveals
            the same numbers as a real table. §8 asks for patterns or direct
            labels; for a data chart the honest equivalent is the data itself.
            Open one above and press it.
          </p>
        </Panel>
      </Block>
    </Group>
  );
}
