"use client";

import { useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Building2,
  Mail,
  Package,
  TrendingUp,
  ArrowLeft,
  Download,
} from "lucide-react";

interface PriceEntry {
  price: number;
  date: string;
}

interface VendorProduct {
  productSku: string;
  contractPrice: number;
  movingAverage: number;
  priceHistory: PriceEntry[];
}

interface VendorData {
  id: string;
  name: string;
  email: string;
  trackedSkus: number;
  products: VendorProduct[];
}

function Sparkline({ data }: { data: PriceEntry[] }) {
  if (data.length < 2) {
    return <span className="text-xs text-zinc-400">—</span>;
  }

  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const width = 80;
  const height = 24;
  const padding = 2;

  const points = prices.map((p, i) => {
    const x = padding + (i / (prices.length - 1)) * (width - 2 * padding);
    const y = height - padding - ((p - min) / range) * (height - 2 * padding);
    return `${x},${y}`;
  });

  const trending = prices[prices.length - 1] > prices[0];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="inline-block"
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={trending ? "#f43f5e" : "#10b981"}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function VendorRow({ vendor }: { vendor: VendorData }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden transition-all hover:shadow-sm">
      {/* Header row */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-4 px-5 py-4 text-left bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
      >
        <div className="shrink-0 text-zinc-400 dark:text-zinc-500">
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </div>
        <div className="shrink-0 p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
          <Building2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 truncate">
            {vendor.name}
          </h3>
          <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            <Mail className="w-3 h-3" />
            <span className="truncate">{vendor.email}</span>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-1.5 px-2.5 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-md">
          <Package className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-300">
            {vendor.trackedSkus} SKU{vendor.trackedSkus !== 1 ? "s" : ""}
          </span>
        </div>
      </button>

      {/* Expanded product detail */}
      {expanded && vendor.products.length > 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/30">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-zinc-500 dark:text-zinc-400 uppercase bg-zinc-100/70 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800">
                <tr>
                  <th className="px-5 py-2.5 font-medium">Product SKU</th>
                  <th className="px-4 py-2.5 font-medium text-right">
                    Contract Price
                  </th>
                  <th className="px-4 py-2.5 font-medium text-right">
                    Moving Avg
                  </th>
                  <th className="px-4 py-2.5 font-medium text-right">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {vendor.products.map((product) => {
                  const variance =
                    product.contractPrice > 0
                      ? ((product.movingAverage - product.contractPrice) /
                          product.contractPrice) *
                        100
                      : 0;
                  const isOver = variance > 0;

                  return (
                    <tr
                      key={product.productSku}
                      className="hover:bg-zinc-100/40 dark:hover:bg-zinc-800/20 transition-colors"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <TrendingUp className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                          <span className="font-medium text-zinc-900 dark:text-zinc-100">
                            {product.productSku}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-600 dark:text-zinc-400">
                        {product.contractPrice > 0
                          ? `$${product.contractPrice.toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-mono text-zinc-900 dark:text-zinc-100">
                          ${product.movingAverage.toFixed(2)}
                        </span>
                        {product.contractPrice > 0 && (
                          <span
                            className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              isOver
                                ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                            }`}
                          >
                            {isOver ? "+" : ""}
                            {variance.toFixed(1)}%
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Sparkline data={product.priceHistory} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {expanded && vendor.products.length === 0 && (
        <div className="border-t border-zinc-200 dark:border-zinc-800 px-5 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400 bg-zinc-50/50 dark:bg-zinc-950/30">
          No pricing data tracked for this vendor yet.
        </div>
      )}
    </div>
  );
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<VendorData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/vendors")
      .then((res) => res.json())
      .then((data) => setVendors(data.vendors || []))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black p-4 md:p-8 lg:p-12 text-zinc-900 dark:text-zinc-50 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex flex-col gap-2">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors mb-2 max-w-max"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Dashboard
          </a>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-900 to-zinc-500 dark:from-white dark:to-zinc-500">
              Vendor Management
            </h1>
            <a
              href="/api/export/vendors"
              download
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-black border border-zinc-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </a>
          </div>
          <p className="text-base text-zinc-500 dark:text-zinc-400 max-w-2xl">
            View all tracked vendors and their pricing baselines. Expand a row
            to see per-SKU contract prices, moving averages, and price trends.
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-20 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-900/20 animate-pulse"
              />
            ))}
          </div>
        ) : vendors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <Building2 className="w-12 h-12 text-zinc-300 dark:text-zinc-600 mb-4" />
            <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
              No Vendors Found
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Vendors will appear here once invoices are processed.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {vendors.map((vendor) => (
              <VendorRow key={vendor.id} vendor={vendor} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
