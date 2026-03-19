"use client";

import { useState, useEffect } from "react";
import { NotificationDashboard } from "@/components/Dashboard";
import { UploadInvoice } from "@/components/UploadInvoice";
import { PendingCreditMemo } from "@/lib/notifications";

export default function Home() {
  const [drafts, setDrafts] = useState<PendingCreditMemo[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

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
    <main className="min-h-screen bg-zinc-50 dark:bg-black p-8 md:p-16 text-zinc-900 dark:text-zinc-50 font-sans">
      <div className="max-w-6xl mx-auto space-y-12">
        <header className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <h1 className="text-4xl font-extrabold tracking-tight lg:text-5xl">
              Price Guard
            </h1>
            <div className="flex items-center gap-3">
              <a
                href="/setup"
                className="px-4 py-2 text-sm font-medium text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 rounded-lg transition-all"
              >
                ⚙ Setup
              </a>
              <a
                href="https://github.com/akhtarsahil"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 text-sm font-bold tracking-wider text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-lg transition-all shadow-sm hover:shadow-md"
              >
                AKHTAR
              </a>
            </div>
          </div>
          <p className="text-lg text-zinc-500 dark:text-zinc-400 max-w-2xl">
            Intelligent AP Pricing & Monitoring. Automatically scan invoices, detect leakage, and trigger credit memos in one click.
          </p>
          {sentCount > 0 && (
            <div className="mt-4 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-lg inline-flex max-w-max">
              <span className="font-medium text-sm">Successfully dispatched {sentCount} credit memo{sentCount !== 1 ? 's' : ''} to vendors.</span>
            </div>
          )}
        </header>

        <section className="grid gap-12 lg:grid-cols-12 items-start">
          {/* Main Dashboard / Memos take up most space */}
          <div className="lg:col-span-8 space-y-8">
            <NotificationDashboard 
              drafts={drafts} 
              onApproveAndSend={handleApproveAndSend} 
              onDismiss={handleDismiss} 
            />
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
