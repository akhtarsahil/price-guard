import { NextResponse } from "next/server";
import { getCreditMemoRepo } from "@/lib/services";

/**
 * GET /api/memos
 * Returns all pending (DRAFT) credit memos for the dashboard.
 */
export async function GET() {
  try {
    const creditMemoRepo = getCreditMemoRepo();
    const pending = await creditMemoRepo.getPendingMemos();
    
    // Sort newest first
    pending.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ memos: pending });
  } catch (error: any) {
    console.error("API Error fetching memos:", error);
    return NextResponse.json({ error: "Failed to load memos" }, { status: 500 });
  }
}
