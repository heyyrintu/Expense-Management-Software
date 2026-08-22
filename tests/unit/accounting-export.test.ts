// The accounting export layer (FINAL-AUDIT §4).
//
// Four things are worth locking down, and they are the four ways an
// accounting export goes wrong without erroring:
//   1. a row silently dropped because its category has no GL code
//   2. a placeholder account quietly substituted for a missing one
//   3. the same journal entry posted twice
//   4. an entry whose debits do not equal its credits
import { describe, expect, it } from "vitest";

import {
  exportStatusFor,
  isExportableStatus,
  periodContains,
  planExport,
  type PriorExport,
} from "@/lib/domain/accounting-export";
import {
  adapterFor,
  buildMappingIndex,
  emptyMappingIndex,
  findUnmapped,
  genericAdapter,
  isExportable,
  quickbooksAdapter,
  requireCode,
  tallyAdapter,
  UNIMPLEMENTED_TARGETS,
  type AdapterConfig,
  type ExportableReport,
  type MappingRow,
} from "@/lib/exports/accounting";

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const CONFIG: AdapterConfig = {
  currency: "INR",
  expenseLedger: "Expense Reimbursements",
  bankLedger: "Bank",
  payableAccount: "2100",
};

const CAT_TRAVEL = "11111111-1111-7111-8111-111111111111";
const CAT_MEALS = "22222222-2222-7222-8222-222222222222";
const DEPT = "33333333-3333-7333-8333-333333333333";
const PROJ = "44444444-4444-7444-8444-444444444444";
const USER = "55555555-5555-7555-8555-555555555555";

function report(over: Partial<ExportableReport> = {}): ExportableReport {
  const lines = over.lines ?? [
    {
      expenseId: "e1",
      date: d("2026-04-03"),
      merchant: "Indigo",
      amountMinor: 500_000,
      categoryId: CAT_TRAVEL,
      categoryName: "Travel",
      departmentId: DEPT,
      projectId: PROJ,
      taxMinor: 25_000,
      purpose: "Client visit",
    },
    {
      expenseId: "e2",
      date: d("2026-04-04"),
      merchant: "Taj",
      amountMinor: 200_000,
      categoryId: CAT_MEALS,
      categoryName: "Meals",
      departmentId: null,
      projectId: null,
      taxMinor: null,
      purpose: "",
    },
  ];
  return {
    id: "aaaaaaaa-aaaa-7aaa-8aaa-aaaaaaaaaaaa",
    title: "April travel",
    submittedAt: d("2026-04-30"),
    totalMinor: lines.reduce((s, l) => s + l.amountMinor, 0),
    userId: USER,
    userName: "Asha Rao",
    userEmail: "asha@acme.test",
    lines,
    ...over,
  };
}

const FULL_MAPPING: MappingRow[] = [
  { entityType: "category", localId: CAT_TRAVEL, remoteCode: "6100", remoteName: "Travel" },
  { entityType: "category", localId: CAT_MEALS, remoteCode: "6200", remoteName: "Meals" },
  { entityType: "user", localId: USER, remoteCode: "2100", remoteName: "Employee payable" },
  { entityType: "department", localId: DEPT, remoteCode: "OPS", remoteName: "Operations" },
  { entityType: "project", localId: PROJ, remoteCode: "P-9", remoteName: "Rollout" },
];

const LABELS = {
  category: new Map([
    [CAT_TRAVEL, "Travel"],
    [CAT_MEALS, "Meals"],
  ]),
  department: new Map([[DEPT, "Operations"]]),
  project: new Map([[PROJ, "Rollout"]]),
  user: new Map([[USER, "Asha Rao"]]),
};

// ---------------------------------------------------------------------------
describe("mapping resolution", () => {
  it("resolves a mapped entity to its code", () => {
    const index = buildMappingIndex(FULL_MAPPING);
    expect(index.get("category", CAT_TRAVEL)?.remoteCode).toBe("6100");
    expect(index.has("category", CAT_TRAVEL)).toBe(true);
  });

  it("returns null for an unmapped entity — never a fallback", () => {
    const index = buildMappingIndex(FULL_MAPPING);
    expect(index.get("category", "nope")).toBeNull();
    expect(index.has("category", "nope")).toBe(false);
  });

  it("keeps entity types separate", () => {
    // A category and a user could share an id across tables; the index must
    // not let one satisfy the other.
    const index = buildMappingIndex([
      { entityType: "category", localId: "x", remoteCode: "6100", remoteName: null },
    ]);
    expect(index.get("user", "x")).toBeNull();
  });

  it("requireCode throws rather than inventing an account", () => {
    const index = emptyMappingIndex();
    expect(() => requireCode(index, "category", CAT_TRAVEL, "Travel")).toThrow(
      /no account code mapped/i
    );
  });
});

// ---------------------------------------------------------------------------
describe("unmapped detection", () => {
  it("finds nothing when everything required is mapped", () => {
    const unmapped = findUnmapped(
      [report()],
      buildMappingIndex(FULL_MAPPING),
      quickbooksAdapter.requiredEntities,
      LABELS
    );
    expect(unmapped).toEqual([]);
    expect(isExportable(unmapped)).toBe(true);
  });

  it("names the category that has no code, with its label not its uuid", () => {
    const partial = FULL_MAPPING.filter((m) => m.localId !== CAT_MEALS);
    const unmapped = findUnmapped(
      [report()],
      buildMappingIndex(partial),
      quickbooksAdapter.requiredEntities,
      LABELS
    );
    expect(unmapped).toHaveLength(1);
    expect(unmapped[0]).toMatchObject({
      entityType: "category",
      localId: CAT_MEALS,
      label: "Meals",
      affectedLines: 1,
    });
    expect(isExportable(unmapped)).toBe(false);
  });

  it("counts affected lines and sorts the worst blocker first", () => {
    const many = report({
      lines: Array.from({ length: 4 }, (_, i) => ({
        expenseId: `e${i}`,
        date: d("2026-04-03"),
        merchant: "M",
        amountMinor: 100,
        categoryId: CAT_TRAVEL,
        categoryName: "Travel",
        departmentId: null,
        projectId: null,
        taxMinor: null,
        purpose: "",
      })).concat([
        {
          expenseId: "e9",
          date: d("2026-04-03"),
          merchant: "M",
          amountMinor: 100,
          categoryId: CAT_MEALS,
          categoryName: "Meals",
          departmentId: null,
          projectId: null,
          taxMinor: null,
          purpose: "",
        },
      ]),
    });
    const unmapped = findUnmapped(
      [many],
      emptyMappingIndex(),
      ["category"],
      LABELS
    );
    expect(unmapped[0].label).toBe("Travel");
    expect(unmapped[0].affectedLines).toBe(4);
    expect(unmapped[1].affectedLines).toBe(1);
  });

  it("ignores entity types the adapter does not require", () => {
    // Tally posts against ledger NAMES, so nothing is required and the
    // warning must stay silent — a warning that fires when nothing is wrong
    // is one people learn to click past.
    const unmapped = findUnmapped(
      [report()],
      emptyMappingIndex(),
      tallyAdapter.requiredEntities,
      LABELS
    );
    expect(unmapped).toEqual([]);
  });

  it("does not warn about a line that simply has no department", () => {
    // null departmentId is "not applicable", not "unmapped". Warning here
    // would make an optional dimension look broken on every export.
    const noDims = report({
      lines: [
        {
          expenseId: "e1",
          date: d("2026-04-03"),
          merchant: "M",
          amountMinor: 100,
          categoryId: CAT_TRAVEL,
          categoryName: "Travel",
          departmentId: null,
          projectId: null,
          taxMinor: null,
          purpose: "",
        },
      ],
    });
    const unmapped = findUnmapped(
      [noDims],
      buildMappingIndex(FULL_MAPPING),
      ["category", "department", "project"],
      LABELS
    );
    expect(unmapped).toEqual([]);
  });

  it("flags an unmapped employee once per report, not once per line", () => {
    const unmapped = findUnmapped(
      [report()],
      buildMappingIndex(FULL_MAPPING.filter((m) => m.entityType !== "user")),
      ["user"],
      LABELS
    );
    expect(unmapped).toHaveLength(1);
    expect(unmapped[0].affectedLines).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe("QuickBooks adapter output shape", () => {
  const index = buildMappingIndex(FULL_MAPPING);

  it("emits one debit row per expense plus one credit row per report", () => {
    const art = quickbooksAdapter.buildExport([report()], index, CONFIG);
    const rows = art.content.trim().split("\r\n");
    expect(rows[0]).toBe(
      "JournalNo,JournalDate,Currency,AccountName,Debits,Credits,Description,Name,Location,Class"
    );
    // header + 2 debits + 1 credit
    expect(rows).toHaveLength(4);
    expect(art.lineCount).toBe(3); // excludes the header
  });

  it("balances: debits equal the credit", () => {
    const art = quickbooksAdapter.buildExport([report()], index, CONFIG);
    const rows = art.content.trim().split("\r\n").slice(1);
    let debits = 0;
    let credits = 0;
    for (const r of rows) {
      const cells = r.split(",");
      debits += Number(cells[4] || 0);
      credits += Number(cells[5] || 0);
    }
    expect(debits).toBeCloseTo(credits, 2);
    expect(art.totalMinor).toBe(700_000);
  });

  it("uses the MAPPED account code, not the category name", () => {
    const art = quickbooksAdapter.buildExport([report()], index, CONFIG);
    expect(art.content).toContain("6100");
    expect(art.content).toContain("6200");
  });

  it("shares one JournalNo across a report's rows, stable across runs", () => {
    const a = quickbooksAdapter.buildExport([report()], index, CONFIG);
    const b = quickbooksAdapter.buildExport([report()], index, CONFIG);
    const noA = a.content.trim().split("\r\n")[1].split(",")[0];
    const noB = b.content.trim().split("\r\n")[1].split(",")[0];
    // Same report → same journal number, so a re-import replaces one entry
    // rather than adding a second that doubles the expense.
    expect(noA).toBe(noB);
    for (const row of a.content.trim().split("\r\n").slice(1)) {
      expect(row.split(",")[0]).toBe(noA);
    }
  });

  it("REFUSES an entry whose lines do not sum to the report total", () => {
    // QBO would reject the file with a row number and no explanation. Better
    // to fail here, naming the report.
    const broken = report({ totalMinor: 999_999 });
    expect(() => quickbooksAdapter.buildExport([broken], index, CONFIG)).toThrow(
      /would not balance/i
    );
  });

  it("refuses rather than substituting a code when a category is unmapped", () => {
    const partial = buildMappingIndex(
      FULL_MAPPING.filter((m) => m.localId !== CAT_MEALS)
    );
    expect(() => quickbooksAdapter.buildExport([report()], partial, CONFIG)).toThrow(
      /no account code mapped/i
    );
  });

  it("writes optional dimensions blank when unmapped, without blocking", () => {
    const noDims = buildMappingIndex(
      FULL_MAPPING.filter((m) => !["department", "project"].includes(m.entityType))
    );
    const art = quickbooksAdapter.buildExport([report()], noDims, CONFIG);
    expect(art.lineCount).toBe(3);
  });

  it("neutralises a formula-injection merchant via the shared CSV writer", () => {
    const evil = report({
      lines: [
        {
          expenseId: "e1",
          date: d("2026-04-03"),
          merchant: "=cmd|'/c calc'!A1",
          amountMinor: 700_000,
          categoryId: CAT_TRAVEL,
          categoryName: "Travel",
          departmentId: null,
          projectId: null,
          taxMinor: null,
          purpose: "",
        },
      ],
    });
    const art = quickbooksAdapter.buildExport([evil], index, CONFIG);
    // Whatever the escape is, the cell must not begin a bare formula.
    expect(art.content).not.toMatch(/,=cmd/);
  });
});

// ---------------------------------------------------------------------------
describe("Tally adapter", () => {
  it("produces ONE envelope even for several employees", () => {
    const a = report({ id: "r1", userName: "Asha Rao" });
    const b = report({ id: "r2", userName: "Bala N" });
    const art = tallyAdapter.buildExport([a, b], emptyMappingIndex(), CONFIG);
    // Tally rejects trailing content after the first envelope.
    expect(art.content.match(/<ENVELOPE>/g)).toHaveLength(1);
    expect(art.content.match(/<\/ENVELOPE>/g)).toHaveLength(1);
    expect(art.lineCount).toBe(2);
    expect(art.totalMinor).toBe(1_400_000);
  });

  it("carries a voucher per report", () => {
    const art = tallyAdapter.buildExport(
      [report({ id: "r1" }), report({ id: "r2" })],
      emptyMappingIndex(),
      CONFIG
    );
    expect(art.content.match(/<VOUCHER /g)).toHaveLength(2);
  });

  it("needs no mapping at all", () => {
    expect(tallyAdapter.requiredEntities).toEqual([]);
    expect(() =>
      tallyAdapter.buildExport([report()], emptyMappingIndex(), CONFIG)
    ).not.toThrow();
  });
});

describe("generic adapter", () => {
  it("emits one flat row per expense", () => {
    const art = genericAdapter.buildExport(
      [report()],
      buildMappingIndex(FULL_MAPPING),
      CONFIG
    );
    expect(art.lineCount).toBe(2);
    expect(art.totalMinor).toBe(700_000);
  });
});

describe("adapter registry", () => {
  it("resolves the implemented targets", () => {
    expect(adapterFor("quickbooks")?.target).toBe("quickbooks");
    expect(adapterFor("tally")?.target).toBe("tally");
    expect(adapterFor("generic")?.target).toBe("generic");
  });

  it("returns null for a target with no adapter, rather than a stand-in", () => {
    // A file labelled "NetSuite export" that is really a generic CSV is worse
    // than an honest refusal.
    for (const t of UNIMPLEMENTED_TARGETS) expect(adapterFor(t)).toBeNull();
  });

  it("every adapter declares what it needs mapped", () => {
    for (const a of [quickbooksAdapter, tallyAdapter, genericAdapter]) {
      expect(Array.isArray(a.requiredEntities)).toBe(true);
      expect(a.label.length).toBeGreaterThan(0);
      expect(a.description.length).toBeGreaterThan(0);
    }
  });

  it("leaves `deliver` unimplemented — this session builds no API calls", () => {
    for (const a of [quickbooksAdapter, tallyAdapter, genericAdapter]) {
      expect(a.deliver).toBeUndefined();
    }
  });
});

// ---------------------------------------------------------------------------
describe("double-export guard", () => {
  const prior: PriorExport[] = [
    { reportId: "r1", target: "quickbooks", exportedAt: d("2026-05-01"), exportId: "x1" },
  ];

  it("includes a report that has never been exported", () => {
    const plan = planExport({ reportIds: ["r2"], target: "quickbooks" }, prior);
    expect(plan.included).toEqual(["r2"]);
    expect(plan.alreadyExported).toEqual([]);
    expect(plan.empty).toBe(false);
  });

  it("EXCLUDES a report already sent to this target", () => {
    const plan = planExport({ reportIds: ["r1"], target: "quickbooks" }, prior);
    expect(plan.included).toEqual([]);
    expect(plan.alreadyExported[0]).toMatchObject({ reportId: "r1", exportId: "x1" });
    expect(plan.empty).toBe(true);
  });

  it("includes it when a re-export is explicitly confirmed", () => {
    const plan = planExport({ reportIds: ["r1"], target: "quickbooks" }, prior, true);
    expect(plan.included).toEqual(["r1"]);
    // Still reported, so the confirmation can name what it is re-sending.
    expect(plan.alreadyExported).toHaveLength(1);
  });

  it("is PER TARGET — QuickBooks history does not block a Tally export", () => {
    const plan = planExport({ reportIds: ["r1"], target: "tally" }, prior);
    expect(plan.included).toEqual(["r1"]);
    expect(plan.alreadyExported).toEqual([]);
  });

  it("dedupes a report picked twice inside one run", () => {
    // The prior-run guard would never catch this: it would post the entry
    // twice inside a single file.
    const plan = planExport({ reportIds: ["r2", "r2"], target: "quickbooks" }, prior);
    expect(plan.included).toEqual(["r2"]);
  });

  it("uses the NEWEST prior export when there are several", () => {
    const many: PriorExport[] = [
      { reportId: "r1", target: "quickbooks", exportedAt: d("2026-05-01"), exportId: "old" },
      { reportId: "r1", target: "quickbooks", exportedAt: d("2026-06-01"), exportId: "new" },
    ];
    const plan = planExport({ reportIds: ["r1"], target: "quickbooks" }, many);
    expect(plan.alreadyExported[0].exportId).toBe("new");
  });

  it("splits a mixed selection", () => {
    const plan = planExport(
      { reportIds: ["r1", "r2", "r3"], target: "quickbooks" },
      prior
    );
    expect(plan.included).toEqual(["r2", "r3"]);
    expect(plan.alreadyExported.map((a) => a.reportId)).toEqual(["r1"]);
  });
});

describe("export status on a report", () => {
  const prior: PriorExport[] = [
    { reportId: "r1", target: "quickbooks", exportedAt: d("2026-05-01"), exportId: "x1" },
    { reportId: "r1", target: "quickbooks", exportedAt: d("2026-06-01"), exportId: "x2" },
    { reportId: "r1", target: "tally", exportedAt: d("2026-05-02"), exportId: "x3" },
    { reportId: "r2", target: "tally", exportedAt: d("2026-05-03"), exportId: "x4" },
  ];

  it("lists one entry per target, newest run", () => {
    const status = exportStatusFor("r1", prior);
    expect(status).toHaveLength(2);
    expect(status.find((s) => s.target === "quickbooks")?.exportId).toBe("x2");
    expect(status.find((s) => s.target === "tally")?.exportId).toBe("x3");
  });

  it("is empty for a report never exported", () => {
    expect(exportStatusFor("r9", prior)).toEqual([]);
  });
});

describe("eligibility and period", () => {
  it("allows only approved-and-beyond reports", () => {
    // Posting an unapproved cost to the GL is a statement the org has not made.
    expect(isExportableStatus("approved")).toBe(true);
    expect(isExportableStatus("partially_reimbursed")).toBe(true);
    expect(isExportableStatus("reimbursed")).toBe(true);
    expect(isExportableStatus("draft")).toBe(false);
    expect(isExportableStatus("submitted")).toBe(false);
    expect(isExportableStatus("rejected")).toBe(false);
  });

  it("treats the period end as INCLUSIVE of the whole day", () => {
    // An exclusive end drops everything filed on the last day of the quarter
    // — the day a quarter-end export is run for.
    expect(periodContains(d("2026-06-30"), d("2026-04-01"), d("2026-06-30"))).toBe(true);
    expect(periodContains(d("2026-04-01"), d("2026-04-01"), d("2026-06-30"))).toBe(true);
    expect(periodContains(d("2026-07-01"), d("2026-04-01"), d("2026-06-30"))).toBe(false);
    expect(periodContains(d("2026-03-31"), d("2026-04-01"), d("2026-06-30"))).toBe(false);
  });
});
