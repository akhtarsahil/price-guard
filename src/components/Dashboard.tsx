import { PendingCreditMemo } from "@/lib/notifications";
import { CheckCircle, XCircle, Send, FileText } from "lucide-react";

interface DashboardProps {
  drafts: PendingCreditMemo[];
  onApproveAndSend: (draftId: string) => void;
  onDismiss: (draftId: string) => void;
}

export function NotificationDashboard({ drafts, onApproveAndSend, onDismiss }: DashboardProps) {
  if (drafts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-zinc-50 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
        <CheckCircle className="w-12 h-12 text-emerald-500 mb-4" />
        <h3 className="text-lg font-medium">All Clear</h3>
        <p className="text-zinc-500 dark:text-zinc-400">No pending credit memos require approval.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Pending Actions</h2>
        <span className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 text-xs font-medium px-2.5 py-1 rounded-full">
          {drafts.length} Require Approval
        </span>
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {drafts.map((draft) => (
          <div 
            key={draft.id} 
            className="flex flex-col bg-white dark:bg-black rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden transition-all hover:shadow-md"
          >
            {/* Header */}
            <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-medium text-sm text-zinc-900 dark:text-zinc-100">{draft.vendorName}</h3>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">Invoice #{draft.invoiceNumber}</p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 flex-grow">
              <div className="text-sm space-y-3">
                <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
                  <span>Flagged Items:</span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100">{draft.flaggedItems.length}</span>
                </div>
                <div className="flex justify-between items-center text-zinc-600 dark:text-zinc-400">
                  <span>Total Leakage:</span>
                  <span className="font-semibold text-red-600 dark:text-red-400">
                    \${draft.flaggedItems.reduce((acc, item) => acc + item.leakage, 0).toFixed(2)}
                  </span>
                </div>
                
                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 font-medium uppercase tracking-wider">Preview Email</p>
                  <div className="relative">
                    <div className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg overflow-hidden line-clamp-4 leading-relaxed">
                      {draft.compiledEmailBody}
                    </div>
                    {/* Fade out effect string */}
                    <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-zinc-50 dark:from-zinc-900 to-transparent"></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex gap-3">
              <button 
                onClick={() => onDismiss(draft.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-white dark:bg-black border border-zinc-200 dark:border-zinc-700 text-sm font-medium rounded-lg text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors focus:ring-2 focus:ring-zinc-200 outline-none"
              >
                <XCircle className="w-4 h-4" />
                Dismiss
              </button>
              <button 
                onClick={() => onApproveAndSend(draft.id)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white border border-transparent text-sm font-medium rounded-lg transition-colors focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-black outline-none shadow-sm"
              >
                <Send className="w-4 h-4" />
                Approve & Send
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
