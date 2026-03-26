import { getAuditLogRepo } from "@/lib/services";

export async function GET() {
  try {
    const auditLogRepo = getAuditLogRepo();
    const entries = await auditLogRepo.getRecentEntries(100000);

    // CSV header
    const headers = [
      "ID",
      "Invoice ID",
      "Line Item",
      "Vendor ID",
      "Item SKU",
      "Billed Price",
      "Reference Price",
      "Reference Type",
      "Variance %",
      "Overcharge",
      "Flag Type",
      "Threshold Applied",
      "Logged At",
    ];

    const rows = entries.map((e) => [
      e.id,
      e.invoiceId,
      e.lineItemIndex,
      e.vendorId,
      e.itemSku,
      e.billedPrice.toFixed(2),
      e.referencePrice.toFixed(2),
      e.referenceType,
      e.variancePct.toFixed(1),
      e.overcharge.toFixed(2),
      e.flagType || "",
      `"${(e.thresholdApplied || "").replace(/"/g, '""')}"`,
      e.loggedAt,
    ]);

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=audit-log-${new Date().toISOString().slice(0, 10)}.csv`,
      },
    });
  } catch (error) {
    console.error("Failed to export audit log:", error);
    return new Response("Export failed", { status: 500 });
  }
}
