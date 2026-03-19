import { NextRequest, NextResponse } from "next/server";
import { getCreditMemoRepo, getNotificationService } from "@/lib/services";

/**
 * POST /api/memos/[id]/approve
 * Approves a credit memo and sends it via the notification service.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const creditMemoRepo = getCreditMemoRepo();
    const notificationService = getNotificationService();

    const memo = await creditMemoRepo.getMemoById(id);
    if (!memo) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }

    const success = await notificationService.sendCreditMemo(memo);

    if (success) {
      await creditMemoRepo.updateMemoStatus(id, "SENT");
      return NextResponse.json({ success: true, message: "Credit memo approved and sent." });
    }

    return NextResponse.json({ error: "Failed to send credit memo" }, { status: 500 });
  } catch (error: any) {
    console.error("API Error approving memo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
