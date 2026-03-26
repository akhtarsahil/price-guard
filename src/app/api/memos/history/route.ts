import { NextResponse } from "next/server";
import { getCreditMemoRepo } from "@/lib/services";

export async function GET() {
  try {
    const memoRepo = getCreditMemoRepo();
    const allMemos = await memoRepo.getAllMemos();

    // Return non-DRAFT memos (approved, sent, dismissed)
    const history = allMemos.filter((m) => m.status !== "DRAFT");

    return NextResponse.json({ memos: history });
  } catch (error) {
    console.error("Failed to fetch memo history:", error);
    return NextResponse.json(
      { error: "Failed to fetch memo history" },
      { status: 500 }
    );
  }
}
