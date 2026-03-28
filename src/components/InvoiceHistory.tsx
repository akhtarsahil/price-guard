"use client";
import { useState, useEffect } from "react";
import { FileText, AlertTriangle, CheckCircle2, Clock } from "lucide-react";

interface InvoiceRecord {
  id: string;
  vendorId: string;
  vendorName: string;
  invoiceNumber: string;
  date: string;
  totalAmount: number;
  itemCount: number;
  flaggedCount: number;
}

interface InvoiceHistoryProps {
  refreshKey: number;
}

export function InvoiceHistory({ refreshKey }: InvoiceHistoryProps) {
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/invoices")
      .then((r) => r.json())
      .then((data) => setInvoices(data))
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-400 dark:text-zinc-500">
        <Clock className="w-5 h-5 animate-spin mr-2" />
        Loading...
      </div>
    );
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-400 dark:text-zinc-500 select-none">
        <FileText className="w-10 h-10 mb-3 opacity-30" />
        <p className="text-base font-medium text-zinc-600 dark:text-zinc-400">No Invoices Yet</p>
        <p className="text-sm mt-1">
          Uploaded invoices will appear here after processing.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {invoices.map((inv) => (
        <div
          key={inv.id}
          className="flex items-center justify-between p-4 bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
        >
          <div className="flex items-start gap-3 min-w-0">
            <div className={`p-2 rounded-lg shrink-0 ${
              inv.flaggedCount > 0
                ? "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400"
                : "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400"
            }`}>
              {inv.flaggedCount > 0 ? (
                <AlertTriangle className="w-4 h-4" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                {inv.vendorName || "Unknown Vendor"}
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                {inv.invoiceNumber} · {new Date(inv.date).toLocaleDateString()} · {inv.itemCount} items
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {inv.flaggedCount > 0 && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                {inv.flaggedCount} flagged
              </span>
            )}
            <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              ${inv.totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
