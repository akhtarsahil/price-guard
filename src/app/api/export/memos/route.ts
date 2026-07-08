import { getCreditMemoRepo } from "@/lib/services";

export async function GET() {
  try {
    const creditMemoRepo = getCreditMemoRepo();
    const memos = await creditMemoRepo.getAllMemos();

    const headers = [
      "ID",
      "Vendor Name",
      "Vendor Email",
      "Invoice Number",
      "Status",
      "Total Leakage",
      "Flagged Items Count",
      "Created At",
    ];

    const rows = memos.map((m) => {
      const totalLeakage = m.flaggedItems
        .reduce((acc, item) => acc + Number(item.leakage ?? item.overchargeAmount ?? 0), 0)
        .toFixed(2);

      return [
        m.id,
        `"${(m.vendorName || "").replace(/"/g, '""')}"`,
        m.vendorEmail || "",
        m.invoiceNumber || "",
        m.status,
        totalLeakage,
        m.flaggedItems.length,
        m.createdAt || "",
      ];
    });

    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename=credit-memos-${new Date().toISOString().slice(0, 10)}.csv`,
      },
    });
  } catch (error) {
    console.error("Failed to export memos:", error);
    return new Response("Export failed", { status: 500 });
  }
}
