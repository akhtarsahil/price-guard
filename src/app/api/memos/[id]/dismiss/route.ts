import { NextRequest, NextResponse } from "next/server";
import { getCreditMemoRepo } from "@/lib/services";

/**
 * POST /api/memos/[id]/dismiss
 * Dismisses a credit memo.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const creditMemoRepo = getCreditMemoRepo();

    const memo = await creditMemoRepo.getMemoById(id);
    if (!memo) {
      return NextResponse.json({ error: "Memo not found" }, { status: 404 });
    }

    await creditMemoRepo.updateMemoStatus(id, "DISMISSED");
    return NextResponse.json({ success: true, message: "Credit memo dismissed." });
  } catch (error: any) {
    console.error("API Error dismissing memo:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
