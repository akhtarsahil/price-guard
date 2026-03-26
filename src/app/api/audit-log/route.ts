import { NextResponse } from "next/server";
import { getAuditLogRepo } from "@/lib/services";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100", 10);
    
    const auditLogRepo = getAuditLogRepo();
    const entries = await auditLogRepo.getRecentEntries(limit);
    
    return NextResponse.json({ entries });
  } catch (error: any) {
    console.error("API Error fetching audit log:", error);
    return NextResponse.json({ error: "Failed to load audit log entries" }, { status: 500 });
  }
}
