"use client";

import Decimal from "decimal.js";
import {
  CheckCircle,
  XCircle,
  Send,
  FileText,
  Clock,
  Server,
  Download,
} from "lucide-react";
import { useMemoHistory } from "@/hooks/queries";

export function MemoHistory() {
  const { data: memos = [], isLoading } = useMemoHistory();

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-black rounded-xl border border-zinc-200 dark:border-zinc-800 animate-pulse">
        <Server className="w-8 h-8 text-zinc-400 mb-4" />
        <p className="text-zinc-500">Loading memo history...</p>
      </div>
    );
  }

  if (memos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <Clock className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mb-4" />
        <h3 className="text-lg font-medium">No History Yet</h3>
        <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-1">
          Approved and dismissed memos will appear here.
        </p>
      </div>
    );
  }

  const statusConfig = {
    DRAFT: {
      icon: Clock,
      label: "Draft",
      color:
        "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    },
    APPROVED: {
      icon: CheckCircle,
      label: "Approved",
      color:
        "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800",
    },
    SENT: {
      icon: Send,
      label: "Sent",
      color:
        "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800",
    },
    DISMISSED: {
      icon: XCircle,
      label: "Dismissed",
      color:
        "text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700",
    },
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Memo History</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full">
            {memos.length} resolved
          </span>
          <a
            href="/api/export/memos"
            download
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </a>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-1">
        {memos.map((memo) => {
          const config = statusConfig[memo.status] || statusConfig.APPROVED;
          const StatusIcon = config.icon;
          const totalLeakage = memo.flaggedItems
            .reduce((acc, item) => acc.plus(item.leakage), new Decimal(0))
            .toFixed(2);
          const date = new Date(memo.createdAt);

          return (
            <div
              key={memo.id}
              className="flex items-center gap-4 bg-white dark:bg-black rounded-xl border border-zinc-200 dark:border-zinc-800 px-5 py-4 shadow-sm transition-all hover:shadow-md"
            >
              {/* Status badge */}
              <div
                className={`shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${config.color}`}
              >
                <StatusIcon className="w-3.5 h-3.5" />
                {config.label}
              </div>

              {/* Vendor + Invoice */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <FileText className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                    {memo.vendorName}
                  </span>
                </div>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Invoice #{memo.invoiceNumber}
                </span>
              </div>

              {/* Amount */}
              <div className="shrink-0 text-right">
                <span className="text-sm font-mono font-semibold text-zinc-900 dark:text-zinc-100">
                  ${totalLeakage}
                </span>
                <div className="text-[10px] text-zinc-400 mt-0.5">
                  {date.toLocaleDateString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
