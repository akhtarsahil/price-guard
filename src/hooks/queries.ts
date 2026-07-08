"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PendingCreditMemo } from "@/lib/notifications";
import { AuditLogEntry, Invoice } from "@/lib/interfaces";

export interface StatsData {
  totalSavings: string | number;
  pendingRecovery: string | number;
  invoicesScanned: number;
  flagRate: string | number;
}

export const queryKeys = {
  memos: ["memos"] as const,
  memoHistory: ["memos", "history"] as const,
  invoices: ["invoices"] as const,
  auditLog: (limit: number) => ["audit-log", limit] as const,
  stats: ["stats"] as const,
};

export function usePendingMemos() {
  return useQuery({
    queryKey: queryKeys.memos,
    queryFn: async () => {
      const res = await fetch("/api/memos");
      if (!res.ok) throw new Error("Failed to load pending memos");
      const data = await res.json();
      return (data.memos || []) as PendingCreditMemo[];
    },
  });
}

export function useMemoHistory() {
  return useQuery({
    queryKey: queryKeys.memoHistory,
    queryFn: async () => {
      const res = await fetch("/api/memos/history");
      if (!res.ok) throw new Error("Failed to load memo history");
      const data = await res.json();
      return (data.memos || []) as PendingCreditMemo[];
    },
  });
}

export function useInvoices() {
  return useQuery({
    queryKey: queryKeys.invoices,
    queryFn: async () => {
      const res = await fetch("/api/invoices");
      if (!res.ok) throw new Error("Failed to load invoices");
      return (await res.json()) as Invoice[];
    },
  });
}

export function useAuditLog(limit = 200) {
  return useQuery({
    queryKey: queryKeys.auditLog(limit),
    queryFn: async () => {
      const res = await fetch(`/api/audit-log?limit=${limit}`);
      if (!res.ok) throw new Error("Failed to load audit logs");
      const data = await res.json();
      return (data.entries || []) as AuditLogEntry[];
    },
  });
}

export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: async () => {
      const res = await fetch("/api/stats");
      if (!res.ok) throw new Error("Failed to load stats");
      return (await res.json()) as StatsData;
    },
  });
}

export function useApproveMemo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: string | { id: string; reasonCode?: string }) => {
      const id = typeof input === "string" ? input : input.id;
      const reasonCode = typeof input === "string" ? undefined : input.reasonCode;
      const res = await fetch(`/api/memos/${id}/approve`, {
        method: "POST",
        headers: reasonCode ? { "Content-Type": "application/json" } : undefined,
        body: reasonCode ? JSON.stringify({ reasonCode }) : undefined,
      });
      if (!res.ok) throw new Error("Failed to approve credit memo");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memos"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useDismissMemo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/memos/${id}/dismiss`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to dismiss credit memo");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["memos"] });
      queryClient.invalidateQueries({ queryKey: queryKeys.stats });
    },
  });
}

export function useInvalidateDashboard() {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["memos"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.invoices });
    queryClient.invalidateQueries({ queryKey: ["audit-log"] });
    queryClient.invalidateQueries({ queryKey: queryKeys.stats });
  };
}

export function useUserRole() {
  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me");
      if (!res.ok) return { authenticated: false, role: "CONTROLLER" as const };
      return (await res.json()) as { authenticated: boolean; role: "AP_CLERK" | "CONTROLLER" };
    },
    staleTime: 5 * 60 * 1000,
  });
}
