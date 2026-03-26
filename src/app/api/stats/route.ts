import { NextResponse } from "next/server";
import { getAuditLogRepo, getCreditMemoRepo } from "@/lib/services";

export async function GET() {
  try {
    const auditLogRepo = getAuditLogRepo();
    const creditMemoRepo = getCreditMemoRepo();

    // Fetch all recent audit entries and all memos in parallel
    const [auditEntries, allMemos] = await Promise.all([
      auditLogRepo.getRecentEntries(10000),
      creditMemoRepo.getAllMemos(),
    ]);

    // 1. Total Savings Recovered — sum of overcharge on APPROVED/SENT memos
    const resolvedMemos = allMemos.filter(
      (m) => m.status === "APPROVED" || m.status === "SENT"
    );
    const totalSavings = resolvedMemos.reduce((sum, memo) => {
      const memoLeakage = memo.flaggedItems.reduce(
        (acc, item) => acc + item.leakage,
        0
      );
      return sum + memoLeakage;
    }, 0);

    // 2. Pending Recovery — sum of overcharge on DRAFT memos
    const draftMemos = allMemos.filter((m) => m.status === "DRAFT");
    const pendingRecovery = draftMemos.reduce((sum, memo) => {
      const memoLeakage = memo.flaggedItems.reduce(
        (acc, item) => acc + item.leakage,
        0
      );
      return sum + memoLeakage;
    }, 0);

    // 3. Invoices Scanned — unique invoice IDs from audit log
    const uniqueInvoices = new Set(auditEntries.map((e) => e.invoiceId));
    const invoicesScanned = uniqueInvoices.size;

    // 4. Flag Rate — % of audit entries with a non-null flagType
    const flaggedCount = auditEntries.filter((e) => e.flagType !== null).length;
    const flagRate =
      auditEntries.length > 0
        ? Number(((flaggedCount / auditEntries.length) * 100).toFixed(1))
        : 0;

    return NextResponse.json({
      totalSavings: Number(totalSavings.toFixed(2)),
      pendingRecovery: Number(pendingRecovery.toFixed(2)),
      invoicesScanned,
      flagRate,
    });
  } catch (error) {
    console.error("Failed to compute stats:", error);
    return NextResponse.json(
      { error: "Failed to compute stats" },
      { status: 500 }
    );
  }
}
