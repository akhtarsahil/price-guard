import { NextRequest, NextResponse } from "next/server";
import { getCreditMemoRepo, getNotificationService } from "@/lib/services";
import { COOKIE_NAME, decodeSessionToken } from "@/lib/auth";

/**
 * POST /api/memos/[id]/approve
 * Approves a credit memo and sends it via the notification service.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionCookie = request.cookies.get(COOKIE_NAME);
    const { valid, role } = await decodeSessionToken(sessionCookie?.value || "");
    if (!valid || role === "AP_CLERK") {
      return NextResponse.json(
        { error: "Forbidden: AP Clerk role is read-only for approvals." },
        { status: 403 }
      );
    }

    let reasonCode: string | undefined;
    try {
      const body = await request.json();
      reasonCode = body?.reasonCode || body?.reason || body?.resolution_reason;
    } catch {
      // Body may be empty or not JSON
    }

    const { id } = await params;
    const creditMemoRepo = getCreditMemoRepo();
    const notificationService = getNotificationService();

    const memo = await creditMemoRepo.getMemoById(id);
    if (!memo) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }

    const success = await notificationService.sendCreditMemo(memo);

    if (success) {
      await creditMemoRepo.updateMemoStatus(id, "SENT", reasonCode);
      return NextResponse.json({ success: true, message: "Credit memo approved and sent." });
    }

    return NextResponse.json({ error: "Failed to send credit memo" }, { status: 500 });
  } catch (error: any) {
    console.error("API Error approving memo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
