"use client";

import { useState, useEffect, useRef } from "react";
import { DollarSign, Clock, FileSearch, AlertTriangle } from "lucide-react";

interface Stats {
  totalSavings: number;
  pendingRecovery: number;
  invoicesScanned: number;
  flagRate: number;
}

function useCountUp(target: number = 0, duration: number = 1200, decimals: number = 0): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Number((eased * target).toFixed(decimals)));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [target, duration, decimals]);

  return value;
}

function StatCard({
  icon: Icon,
  label,
  value,
  prefix = "",
  suffix = "",
  color,
  delay,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  prefix?: string;
  suffix?: string;
  color: string;
  delay: number;
}) {
  const [visible, setVisible] = useState(false);
  const displayValue = useCountUp(visible ? value : 0, 1200, suffix === "%" ? 1 : 2);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  const colorMap: Record<string, { bg: string; iconBg: string; text: string; border: string }> = {
    emerald: {
      bg: "bg-emerald-50/60 dark:bg-emerald-950/20",
      iconBg: "bg-emerald-100 dark:bg-emerald-900/40",
      text: "text-emerald-600 dark:text-emerald-400",
      border: "border-emerald-200/60 dark:border-emerald-800/40",
    },
    amber: {
      bg: "bg-amber-50/60 dark:bg-amber-950/20",
      iconBg: "bg-amber-100 dark:bg-amber-900/40",
      text: "text-amber-600 dark:text-amber-400",
      border: "border-amber-200/60 dark:border-amber-800/40",
    },
    indigo: {
      bg: "bg-indigo-50/60 dark:bg-indigo-950/20",
      iconBg: "bg-indigo-100 dark:bg-indigo-900/40",
      text: "text-indigo-600 dark:text-indigo-400",
      border: "border-indigo-200/60 dark:border-indigo-800/40",
    },
    rose: {
      bg: "bg-rose-50/60 dark:bg-rose-950/20",
      iconBg: "bg-rose-100 dark:bg-rose-900/40",
      text: "text-rose-600 dark:text-rose-400",
      border: "border-rose-200/60 dark:border-rose-800/40",
    },
  };

  const c = colorMap[color] || colorMap.indigo;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border ${c.border} ${c.bg} p-4 backdrop-blur-sm transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`p-2 rounded-lg ${c.iconBg}`}>
          <Icon className={`w-4 h-4 ${c.text}`} />
        </div>
      </div>
      <div className="space-y-0.5">
        <p className={`text-2xl font-bold tracking-tight ${c.text}`}>
          {prefix}
          {suffix === "%"
            ? displayValue.toFixed(1)
            : displayValue.toLocaleString("en-US", { minimumFractionDigits: prefix === "$" ? 2 : 0, maximumFractionDigits: prefix === "$" ? 2 : 0 })}
          {suffix}
        </p>
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          {label}
        </p>
      </div>
    </div>
  );
}

export function StatsBar() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((res) => res.json())
      .then(setStats)
      .catch(console.error);
  }, []);

  if (!stats) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[108px] rounded-xl border border-zinc-200/60 dark:border-zinc-800/40 bg-zinc-50/60 dark:bg-zinc-900/20 animate-pulse"
          />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={DollarSign}
        label="Total Savings"
        value={stats.totalSavings}
        prefix="$"
        color="emerald"
        delay={0}
      />
      <StatCard
        icon={Clock}
        label="Pending Recovery"
        value={stats.pendingRecovery}
        prefix="$"
        color="amber"
        delay={100}
      />
      <StatCard
        icon={FileSearch}
        label="Invoices Scanned"
        value={stats.invoicesScanned}
        color="indigo"
        delay={200}
      />
      <StatCard
        icon={AlertTriangle}
        label="Flag Rate"
        value={stats.flagRate}
        suffix="%"
        color="rose"
        delay={300}
      />
    </div>
  );
}
