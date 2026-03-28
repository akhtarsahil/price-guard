import { NextResponse } from "next/server";
import { getInvoiceRepo } from "@/lib/services";

export async function GET() {
  const repo = getInvoiceRepo();
  const invoices = await repo.getAllInvoices();
  return NextResponse.json(invoices);
}
