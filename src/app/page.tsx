"use client";

import { useState, useEffect } from "react";
import { NotificationDashboard } from "@/components/Dashboard";
import { UploadInvoice } from "@/components/UploadInvoice";
import { AuditLog } from "@/components/AuditLog";
import { StatsBar } from "@/components/StatsBar";
import { MemoHistory } from "@/components/MemoHistory";
import { InvoiceHistory } from "@/components/InvoiceHistory";
import { PendingCreditMemo } from "@/lib/notifications";
import { CheckSquare, ShieldCheck, Clock, FileText, LogOut } from "lucide-react";

export default function Home() {
  const [drafts, setDrafts] = useState<PendingCreditMemo[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"approvals" | "auditor" | "history" | "invoices">("approvals");
  const [refreshKey, setRefreshKey] = useState(0);

  // Load drafts via API route
  const loadMemos = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/memos");
      const data = await res.json();
      setDrafts(data.memos || []);
    } catch (err) {
      console.error("Failed to load memos:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadMemos();
  }, []);

  const handleUploadSuccess = () => {
    loadMemos();
    setRefreshKey((k) => k + 1);
  };

  const handleApproveAndSend = async (id: string) => {
    try {
      const res = await fetch(`/api/memos/${id}/approve`, { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setDrafts((prev) => prev.filter((d) => d.id !== id));
        setSentCount((prev) => prev + 1);
      }
    } catch (err) {
      console.error("Failed to approve memo:", err);
    }
  };

  const handleDismiss = async (id: string) => {
    try {
      const res = await fetch(`/api/memos/${id}/dismiss`, { method: "POST" });
      const data = await res.json();

      if (data.success) {
        setDrafts((prev) => prev.filter((d) => d.id !== id));
      }
    } catch (err) {
      console.error("Failed to dismiss memo:", err);
    }
  };

  if (isLoading && drafts.length === 0) {
    return (
      <main className="min-h-screen bg-zinc-50 dark:bg-black p-8 md:p-16 text-zinc-900 dark:text-zinc-50 flex items-center justify-center">
        <p className="text-zinc-500 animate-pulse">Loading dashboard...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black p-4 md:p-8 lg:p-12 text-zinc-900 dark:text-zinc-50 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex flex-col gap-2">
          <a
            href="https://github.com/akhtarsahil"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-zinc-400 dark:text-zinc-500 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors max-w-max"
          >
            Akhtar
          </a>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-extrabold tracking-tight lg:text-4xl text-transparent bg-clip-text bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-500">
              Price Guard
            </h1>
            <div className="flex items-center gap-3">
              <a
                href="/vendors"
                className="px-4 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-lg transition-all"
              >
                📋 Vendors
              </a>
              <a
                href="/setup"
                className="px-4 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-lg transition-all"
              >
                ⚙ Setup
              </a>
              <button
                onClick={async () => {
                  await fetch("/api/auth/logout", { method: "POST" });
                  window.location.href = "/login";
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 border border-zinc-200 dark:border-zinc-800 hover:border-red-300 dark:hover:border-red-700 rounded-lg transition-all"
              >
                <LogOut className="w-3.5 h-3.5" />
                Logout
              </button>
            </div>
          </div>
          <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-2xl">
            Intelligent AP Pricing & Monitoring. Automatically scan invoices, detect leakage, and trigger credit memos in one click.
          </p>
          {sentCount > 0 && (
            <div className="mt-2 px-4 py-2 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg inline-flex max-w-max">
              <span className="font-medium text-sm">Successfully dispatched {sentCount} credit memo{sentCount !== 1 ? 's' : ''} to vendors.</span>
            </div>
          )}
        </header>

        <section className="mb-8">
          <StatsBar />
        </section>

        <section className="grid gap-8 lg:grid-cols-12 items-start">
          {/* Main Dashboard / Memos / Audit Log */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Tab Navigation */}
            <div className="flex space-x-1 p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl max-w-xl">
               <button
                  onClick={() => setActiveTab("approvals")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium rounded-lg transition-all ${
                    activeTab === "approvals" 
                      ? "bg-white dark:bg-black text-indigo-600 dark:text-indigo-400 shadow-sm" 
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  <CheckSquare className="w-4 h-4" />
                  Drafts
                  {drafts.length > 0 && (
                     <span className="ml-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                      {drafts.length}
                    </span>
                  )}
               </button>
               <button
                  onClick={() => setActiveTab("auditor")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium rounded-lg transition-all ${
                    activeTab === "auditor" 
                      ? "bg-white dark:bg-black text-indigo-600 dark:text-indigo-400 shadow-sm" 
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  <ShieldCheck className="w-4 h-4" />
                  Auditor
               </button>
               <button
                  onClick={() => setActiveTab("history")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium rounded-lg transition-all ${
                    activeTab === "history" 
                      ? "bg-white dark:bg-black text-indigo-600 dark:text-indigo-400 shadow-sm" 
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  <Clock className="w-4 h-4" />
                  History
               </button>
               <button
                  onClick={() => setActiveTab("invoices")}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 text-sm font-medium rounded-lg transition-all ${
                    activeTab === "invoices" 
                      ? "bg-white dark:bg-black text-indigo-600 dark:text-indigo-400 shadow-sm" 
                      : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Invoices
               </button>
            </div>

            {/* Tab Content */}
            <div className="min-h-[500px]">
              {activeTab === "approvals" ? (
                <NotificationDashboard 
                  drafts={drafts} 
                  onApproveAndSend={handleApproveAndSend} 
                  onDismiss={handleDismiss} 
                />
              ) : activeTab === "auditor" ? (
                <AuditLog />
              ) : activeTab === "history" ? (
                <MemoHistory />
              ) : (
                <InvoiceHistory refreshKey={refreshKey} />
              )}
            </div>

          </div>
          
          {/* Upload Widget Sidebar */}
          <div className="lg:col-span-4 lg:sticky top-8">
            <UploadInvoice onUploadSuccess={handleUploadSuccess} />
          </div>
        </section>
      </div>
    </main>
  );
}
