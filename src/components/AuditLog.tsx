"use client";

import { useState, useEffect } from "react";
import { Search, Filter, AlertCircle, CheckCircle2, Server, Download } from "lucide-react";

export interface AuditLogEntry {
  id: string;
  invoiceId: string;
  lineItemIndex: number;
  vendorId: string;
  itemSku: string;
  billedPrice: number;
  referencePrice: number;
  referenceType: "contract" | "moving_avg";
  variancePct: number;
  overcharge: number;
  flagType: "PRICE_HIKE" | "CONTRACT_VIOLATION" | null;
  thresholdApplied: string;
  loggedAt: string;
}

export function AuditLog() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [flaggedOnly, setFlaggedOnly] = useState(false);

  useEffect(() => {
    const fetchLogs = async () => {
      setIsLoading(true);
      try {
        const res = await fetch("/api/audit-log?limit=200");
        const data = await res.json();
        setEntries(data.entries || []);
      } catch (err) {
        console.error("Failed to load audit logs:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchLogs();
  }, []);

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch =
      entry.itemSku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.invoiceId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      entry.vendorId.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (flaggedOnly) {
      return matchesSearch && entry.flagType !== null;
    }
    return matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-white dark:bg-black rounded-xl border border-zinc-200 dark:border-zinc-800 animate-pulse">
        <Server className="w-8 h-8 text-zinc-400 mb-4" />
        <p className="text-zinc-500">Loading immutable audit trail...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between p-4 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search SKU, Invoice, Vendor..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-zinc-100"
          />
        </div>
        
        <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-zinc-700 dark:text-zinc-300 select-none">
          <div className={`relative inline-flex items-center h-5 rounded-full w-9 transition-colors ${flaggedOnly ? 'bg-red-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}>
            <input 
              type="checkbox" 
              className="sr-only" 
              checked={flaggedOnly} 
              onChange={() => setFlaggedOnly(!flaggedOnly)} 
            />
            <span className={`inline-block w-3.5 h-3.5 transform bg-white rounded-full transition-transform ${flaggedOnly ? 'translate-x-4' : 'translate-x-1'}`} />
          </div>
          <Filter className="w-4 h-4 text-zinc-400 ml-1" />
          Flagged Exceptions Only
        </label>

        <a
          href="/api/export/audit-log"
          download
          className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-all"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </a>
      </div>

      {/* Data Table */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-50 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
              <tr>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">Item SKU</th>
                <th className="px-4 py-3 font-medium text-right">Billed</th>
                <th className="px-4 py-3 font-medium text-right">Ref Price</th>
                <th className="px-4 py-3 font-medium text-right">Variance</th>
                <th className="px-4 py-3 font-medium">Threshold Log</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {filteredEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                    No entries found matching filters.
                  </td>
                </tr>
              ) : (
                filteredEntries.map((entry) => {
                  const isFlagged = entry.flagType !== null;
                  const date = new Date(entry.loggedAt);
                  return (
                    <tr 
                      key={entry.id} 
                      className={`hover:bg-zinc-50 dark:hover:bg-black/40 transition-colors ${isFlagged ? 'bg-red-50/30 dark:bg-red-900/5' : ''}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isFlagged ? (
                          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 font-medium">
                            <AlertCircle className="w-4 h-4" />
                            <span>Flagged</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-500">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>Cleared</span>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400 text-xs">
                        {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                        {entry.itemSku}
                        <div className="text-[10px] text-zinc-400 font-normal mt-0.5">{entry.invoiceId}</div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-900 dark:text-zinc-100">
                        \${entry.billedPrice.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-500 dark:text-zinc-400">
                        \${entry.referencePrice.toFixed(2)}
                        <span className="text-[10px] block mt-0.5 uppercase tracking-wider">{entry.referenceType === 'contract' ? 'Fixed' : 'Avg'}</span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          entry.variancePct > 0 
                            ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' 
                            : entry.variancePct < 0 
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
                              : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300'
                        }`}>
                          {entry.variancePct > 0 ? '+' : ''}{entry.variancePct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400 max-w-[200px] truncate" title={entry.thresholdApplied}>
                        {entry.thresholdApplied}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
