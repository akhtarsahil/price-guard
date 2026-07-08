"use client";

import { useState } from "react";
import { PendingCreditMemo } from "@/lib/notifications";
import {
  CheckCircle,
  XCircle,
  Send,
  FileText,
  Lock,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  ShieldAlert,
  HelpCircle,
} from "lucide-react";
import { useUserRole, useApproveMemo } from "@/hooks/queries";

interface DashboardProps {
  drafts: PendingCreditMemo[];
  onApproveAndSend: (draftId: string, reasonCode?: string) => void;
  onDismiss: (draftId: string) => void;
}

const REASON_CODES = [
  "Freight Inclusion",
  "Base Price Increase",
  "Emergency Spot Purchase",
  "Billing Error",
] as const;

export function NotificationDashboard({ drafts, onApproveAndSend, onDismiss }: DashboardProps) {
  const { data: authData } = useUserRole();
  const isApClerk = authData?.role === "AP_CLERK";
  const approveMutation = useApproveMemo();

  // Multi-step modal state
  const [selectedDraft, setSelectedDraft] = useState<PendingCreditMemo | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [reasonCode, setReasonCode] = useState<string>("");
  const [modalError, setModalError] = useState<string | null>(null);

  const handleOpenModal = (draft: PendingCreditMemo) => {
    setSelectedDraft(draft);
    setStep(1);
    setReasonCode("");
    setModalError(null);
  };

  const handleCloseModal = () => {
    setSelectedDraft(null);
    setStep(1);
    setReasonCode("");
    setModalError(null);
  };

  const handleDispatchMemo = async () => {
    if (!selectedDraft || !reasonCode) return;
    try {
      setModalError(null);
      await approveMutation.mutateAsync({
        id: selectedDraft.id,
        reasonCode,
      });
      onApproveAndSend(selectedDraft.id, reasonCode);
      handleCloseModal();
    } catch (err: any) {
      setModalError(err?.message || "Failed to dispatch credit memo.");
    }
  };

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
        <div className="flex items-center gap-3">
          {isApClerk && (
            <span className="bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 text-xs font-medium px-3 py-1 rounded-full border border-blue-200 dark:border-blue-800 flex items-center gap-1.5">
              <Lock className="w-3 h-3" />
              Role: AP Clerk (Read-Only)
            </span>
          )}
          <span className="bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300 text-xs font-medium px-2.5 py-1 rounded-full">
            {drafts.length} Require Approval
          </span>
        </div>
      </div>

      <div className="grid gap-6 grid-cols-1">
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
                    ${draft.flaggedItems.reduce((acc, item) => acc + Number(item.leakage ?? item.overchargeAmount ?? 0), 0).toFixed(2)}
                  </span>
                </div>

                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-2 font-medium uppercase tracking-wider">Preview Email</p>
                  <div className="text-xs font-mono text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 p-3 rounded-lg max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                    {draft.compiledEmailBody}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-zinc-50 dark:bg-zinc-900/50 border-t border-zinc-100 dark:border-zinc-800 flex gap-3">
              <button
                onClick={() => onDismiss(draft.id)}
                disabled={isApClerk}
                title={isApClerk ? "AP Clerk role is read-only for administrative approval actions" : "Dismiss"}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 border text-sm font-medium rounded-lg transition-colors outline-none ${
                  isApClerk
                    ? "bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                    : "bg-white dark:bg-black border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 focus:ring-2 focus:ring-zinc-200"
                }`}
              >
                <XCircle className="w-4 h-4" />
                Dismiss
              </button>
              <button
                onClick={() => handleOpenModal(draft)}
                disabled={isApClerk}
                title={isApClerk ? "Role: AP Clerk (Read-Only)" : "Review & Approve Workflow"}
                className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors outline-none shadow-sm ${
                  isApClerk
                    ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-black"
                }`}
              >
                <Send className="w-4 h-4" />
                Review & Resolve
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Multi-Step AP Review Workflow Modal */}
      {selectedDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/80">
              <div>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                  AP Review & Resolution Workflow
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {selectedDraft.vendorName} • Invoice #{selectedDraft.invoiceNumber}
                </p>
              </div>
              <button
                onClick={handleCloseModal}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 p-1 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Step Indicators */}
            <div className="px-6 py-3 bg-zinc-100/50 dark:bg-zinc-800/40 border-b border-zinc-200 dark:border-zinc-800">
              <div className="flex items-center justify-between text-xs font-semibold">
                <div className={`flex items-center gap-2 ${step >= 1 ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400"}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 1 ? "bg-indigo-600 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"}`}>
                    1
                  </span>
                  <span>Step 1: Variance Details</span>
                </div>
                <div className={`flex items-center gap-2 ${step >= 2 ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400"}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step >= 2 ? "bg-indigo-600 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"}`}>
                    2
                  </span>
                  <span>Step 2: Reason Code</span>
                </div>
                <div className={`flex items-center gap-2 ${step === 3 ? "text-indigo-600 dark:text-indigo-400" : "text-zinc-400"}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] ${step === 3 ? "bg-indigo-600 text-white" : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"}`}>
                    3
                  </span>
                  <span>Step 3: Dispatch</span>
                </div>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {modalError && (
                <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
                  {modalError}
                </div>
              )}

              {/* Step 1: Variance Details */}
              {step === 1 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                    <div className="flex items-center gap-2.5">
                      <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div>
                        <h4 className="text-xs font-semibold text-amber-900 dark:text-amber-300">Leakage Variance Detected</h4>
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          Inspect billed unit prices against historical/contract baselines below.
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-amber-800 dark:text-amber-300 block font-medium">Total Leakage</span>
                      <span className="text-base font-bold text-red-600 dark:text-red-400">
                        ${selectedDraft.flaggedItems.reduce((acc, item) => acc + Number(item.leakage ?? item.overchargeAmount ?? 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-zinc-50 dark:bg-zinc-800/50 text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800">
                          <th className="p-3">SKU / Item</th>
                          <th className="p-3">Billed Price</th>
                          <th className="p-3">Reference Price</th>
                          <th className="p-3 text-right">Leakage</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                        {selectedDraft.flaggedItems.map((item, idx) => {
                          const billed = Number(item.newUnitPrice ?? item.billedUnitPrice ?? 0);
                          const ref = Number(item.contractPrice || item.movingAveragePrice || item.oldMovingAverage || 0);
                          const leak = Number(item.leakage ?? item.overchargeAmount ?? 0);
                          return (
                            <tr key={idx} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30">
                              <td className="p-3 font-medium text-zinc-900 dark:text-zinc-100">
                                {item.productSku || item.itemNameOrSku}
                              </td>
                              <td className="p-3 font-mono text-zinc-700 dark:text-zinc-300">
                                ${billed.toFixed(2)}
                              </td>
                              <td className="p-3 font-mono text-zinc-500 dark:text-zinc-400">
                                ${ref.toFixed(2)}
                              </td>
                              <td className="p-3 font-mono font-semibold text-red-600 dark:text-red-400 text-right">
                                +${leak.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Step 2: Variance Reason Code Selection */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="space-y-2">
                    <label className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                      Mandatory Variance Reason Code
                    </label>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Select the primary root cause for this pricing discrepancy before approving dispatch.
                    </p>
                    <select
                      value={reasonCode}
                      onChange={(e) => setReasonCode(e.target.value)}
                      className="w-full mt-1.5 p-3 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm font-medium text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="" disabled>
                        -- Select Reason Code --
                      </option>
                      {REASON_CODES.map((code) => (
                        <option key={code} value={code}>
                          {code}
                        </option>
                      ))}
                    </select>
                  </div>

                  {reasonCode && (
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl space-y-1">
                      <span className="text-xs font-semibold text-indigo-900 dark:text-indigo-300 uppercase tracking-wider block">
                        Audit Classification
                      </span>
                      <p className="text-xs text-indigo-700 dark:text-indigo-400">
                        Resolution logged under reason code: <strong className="font-semibold">{reasonCode}</strong>. This classification will be recorded in corporate compliance tables.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Final Review & Dispatch */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="p-4 bg-zinc-50 dark:bg-zinc-800/60 rounded-xl border border-zinc-200 dark:border-zinc-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Vendor</span>
                      <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{selectedDraft.vendorName}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Invoice Number</span>
                      <span className="text-sm font-mono text-zinc-900 dark:text-zinc-100">#{selectedDraft.invoiceNumber}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">Resolution Reason Code</span>
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                        {reasonCode}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-700">
                      <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">Total Credit Claim</span>
                      <span className="text-base font-bold text-red-600 dark:text-red-400">
                        ${selectedDraft.flaggedItems.reduce((acc, item) => acc + Number(item.leakage ?? item.overchargeAmount ?? 0), 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block mb-2">
                      Credit Memo Communication Preview
                    </span>
                    <div className="text-xs font-mono text-zinc-700 dark:text-zinc-300 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                      {selectedDraft.compiledEmailBody}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer Controls */}
            <div className="px-6 py-4 bg-zinc-50 dark:bg-zinc-900/80 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                {step > 1 && (
                  <button
                    onClick={() => setStep((prev) => (prev - 1) as 1 | 2 | 3)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2.5">
                <button
                  onClick={handleCloseModal}
                  className="px-4 py-2 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                >
                  Cancel
                </button>

                {step === 1 && (
                  <button
                    onClick={() => setStep(2)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                  >
                    Next: Select Reason
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {step === 2 && (
                  <button
                    onClick={() => setStep(3)}
                    disabled={!reasonCode}
                    className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg shadow-sm transition-colors ${
                      !reasonCode
                        ? "bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                        : "bg-indigo-600 hover:bg-indigo-700 text-white"
                    }`}
                  >
                    Next: Final Review
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}

                {step === 3 && (
                  <button
                    onClick={handleDispatchMemo}
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    {approveMutation.isPending ? "Dispatching..." : "Dispatch Credit Memo"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
