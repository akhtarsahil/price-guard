"use client";

import { useState, useEffect } from "react";

interface ServiceStatus {
  openai: boolean;
  resend: boolean;
  supabase: boolean;
  envFileExists: boolean;
}

type Step = "welcome" | "openai" | "resend" | "supabase" | "review";
const STEPS: Step[] = ["welcome", "openai", "resend", "supabase", "review"];

export default function SetupPage() {
  const [currentStep, setCurrentStep] = useState<Step>("welcome");
  const [status, setStatus] = useState<ServiceStatus | null>(null);

  // Form fields
  const [openaiKey, setOpenaiKey] = useState("");
  const [resendKey, setResendKey] = useState("");
  const [fromEmail, setFromEmail] = useState("");
  const [supabaseUrl, setSupabaseUrl] = useState("");
  const [supabaseKey, setSupabaseKey] = useState("");

  // UI state
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/setup")
      .then((res) => res.json())
      .then((data: ServiceStatus) => setStatus(data))
      .catch(() => {});
  }, []);

  const stepIndex = STEPS.indexOf(currentStep);
  const goNext = () => setCurrentStep(STEPS[Math.min(stepIndex + 1, STEPS.length - 1)]);
  const goBack = () => setCurrentStep(STEPS[Math.max(stepIndex - 1, 0)]);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openaiKey, resendKey, fromEmail, supabaseUrl, supabaseKey }),
      });
      const data = await res.json();
      if (res.ok) {
        setSaveResult({ success: true, message: data.message });
      } else {
        setSaveResult({ success: false, message: data.error || "Failed to save" });
      }
    } catch (e: any) {
      setSaveResult({ success: false, message: e.message });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleShowKey = (key: string) => setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }));

  const configuredCount = [openaiKey, resendKey, supabaseUrl && supabaseKey].filter(Boolean).length;

  // Generate .env.local preview
  const generateEnvPreview = () => {
    const lines: string[] = [];
    if (openaiKey) lines.push(`OPENAI_API_KEY=${openaiKey}`);
    if (resendKey) {
      lines.push(`RESEND_API_KEY=${resendKey}`);
      if (fromEmail) lines.push(`FROM_EMAIL=${fromEmail}`);
    }
    if (supabaseUrl && supabaseKey) {
      lines.push(`NEXT_PUBLIC_SUPABASE_URL=${supabaseUrl}`);
      lines.push(`SUPABASE_SERVICE_ROLE_KEY=${supabaseKey}`);
    }
    return lines.length > 0 ? lines.join("\n") : "# No keys configured — app will run in Mock Mode";
  };

  return (
    <main className="min-h-screen bg-zinc-50 dark:bg-black text-zinc-900 dark:text-zinc-100 font-sans">
      {/* Gradient Header */}
      <div className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-8 py-12 md:py-16">
        <div className="max-w-2xl mx-auto">
          <a href="/" className="text-white/70 hover:text-white text-sm font-medium mb-4 inline-block transition-colors">← Back to Dashboard</a>
          <h1 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight">
            Setup Wizard
          </h1>
          <p className="text-white/80 mt-2 text-lg">
            Configure your backend services in under 2 minutes. Skip any you don't need yet.
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="max-w-2xl mx-auto px-8 -mt-4">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-4 shadow-lg">
          <div className="flex items-center justify-between mb-2">
            {STEPS.map((step, i) => (
              <div key={step} className="flex items-center">
                <button
                  onClick={() => setCurrentStep(step)}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    i <= stepIndex
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/30"
                      : "bg-zinc-200 dark:bg-zinc-700 text-zinc-500"
                  }`}
                >
                  {i + 1}
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`w-12 md:w-20 h-0.5 mx-1 transition-colors ${
                    i < stepIndex ? "bg-indigo-500" : "bg-zinc-200 dark:bg-zinc-700"
                  }`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between text-[10px] md:text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            <span>Welcome</span>
            <span>OCR</span>
            <span>Email</span>
            <span>Database</span>
            <span>Review</span>
          </div>
        </div>
      </div>

      {/* Step Content */}
      <div className="max-w-2xl mx-auto px-8 py-8">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 md:p-8 shadow-sm min-h-[320px] flex flex-col">

          {/* WELCOME */}
          {currentStep === "welcome" && (
            <div className="flex-1 flex flex-col">
              <h2 className="text-2xl font-bold mb-3">Welcome to Price Guard</h2>
              <p className="text-zinc-600 dark:text-zinc-400 mb-4 leading-relaxed">
                This wizard helps you connect real backend services. <strong>All services are optional</strong> — 
                the app works perfectly out-of-the-box in Mock Mode.
              </p>
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: "AI OCR", desc: "OpenAI Vision", icon: "🔍", active: status?.openai },
                  { label: "Email", desc: "Resend", icon: "✉️", active: status?.resend },
                  { label: "Database", desc: "Supabase", icon: "🗄️", active: status?.supabase },
                ].map((svc) => (
                  <div key={svc.label} className={`p-4 rounded-lg border text-center transition-all ${
                    svc.active
                      ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-900/20"
                      : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50"
                  }`}>
                    <div className="text-2xl mb-1">{svc.icon}</div>
                    <div className="text-sm font-semibold">{svc.label}</div>
                    <div className="text-xs text-zinc-500 dark:text-zinc-400">{svc.desc}</div>
                    <div className={`text-[10px] font-bold mt-2 ${svc.active ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                      {svc.active ? "CONNECTED" : "MOCK MODE"}
                    </div>
                  </div>
                ))}
              </div>
              {status?.envFileExists && (
                <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300 mb-4">
                  ⓘ A <code className="font-mono bg-blue-100 dark:bg-blue-900/40 px-1 rounded">.env.local</code> file already exists. Running this wizard will overwrite it.
                </div>
              )}
              <div className="mt-auto flex justify-end">
                <button onClick={goNext} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
                  Get Started →
                </button>
              </div>
            </div>
          )}

          {/* OPENAI */}
          {currentStep === "openai" && (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🔍</span>
                <div>
                  <h2 className="text-xl font-bold">AI Invoice OCR</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Powered by OpenAI Vision (GPT-4o)</p>
                </div>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                When configured, uploaded invoices are sent to GPT-4o Vision which extracts structured line items 
                (SKU, quantity, price) from any format. <strong>Without this key</strong>, uploads return realistic mock data for testing.
              </p>
              <label className="block text-sm font-medium mb-1.5">OpenAI API Key</label>
              <div className="relative mb-2">
                <input
                  type={showKeys.openai ? "text" : "password"}
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
                <button onClick={() => toggleShowKey("openai")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                  {showKeys.openai ? "Hide" : "Show"}
                </button>
              </div>
              <p className="text-xs text-zinc-400 mb-6">
                Get your key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-indigo-500 hover:underline">platform.openai.com</a>
              </p>
              <div className="mt-auto flex justify-between">
                <button onClick={goBack} className="px-5 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium transition-colors">
                  ← Back
                </button>
                <button onClick={goNext} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
                  {openaiKey ? "Next →" : "Skip →"}
                </button>
              </div>
            </div>
          )}

          {/* RESEND */}
          {currentStep === "resend" && (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">✉️</span>
                <div>
                  <h2 className="text-xl font-bold">Email Dispatch</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Powered by Resend</p>
                </div>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                Sends real credit memo emails to vendors when you approve them. <strong>Without this key</strong>, 
                emails are logged to the server console only.
              </p>
              <label className="block text-sm font-medium mb-1.5">Resend API Key</label>
              <div className="relative mb-4">
                <input
                  type={showKeys.resend ? "text" : "password"}
                  value={resendKey}
                  onChange={(e) => setResendKey(e.target.value)}
                  placeholder="re_..."
                  className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
                <button onClick={() => toggleShowKey("resend")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                  {showKeys.resend ? "Hide" : "Show"}
                </button>
              </div>
              <label className="block text-sm font-medium mb-1.5">From Email <span className="text-zinc-400 font-normal">(optional)</span></label>
              <input
                type="email"
                value={fromEmail}
                onChange={(e) => setFromEmail(e.target.value)}
                placeholder="accounts@your-domain.com"
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all mb-2"
              />
              <p className="text-xs text-zinc-400 mb-6">
                Get your key from <a href="https://resend.com" target="_blank" rel="noopener" className="text-indigo-500 hover:underline">resend.com</a>
              </p>
              <div className="mt-auto flex justify-between">
                <button onClick={goBack} className="px-5 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium transition-colors">
                  ← Back
                </button>
                <button onClick={goNext} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
                  {resendKey ? "Next →" : "Skip →"}
                </button>
              </div>
            </div>
          )}

          {/* SUPABASE */}
          {currentStep === "supabase" && (
            <div className="flex-1 flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🗄️</span>
                <div>
                  <h2 className="text-xl font-bold">Database</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">Powered by Supabase (PostgreSQL)</p>
                </div>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-6 leading-relaxed">
                Persists vendors, invoices, pricing history, and credit memos to a real database. 
                <strong> Without these keys</strong>, all data lives in RAM and resets when the server restarts.
              </p>
              <label className="block text-sm font-medium mb-1.5">Supabase Project URL</label>
              <input
                type="text"
                value={supabaseUrl}
                onChange={(e) => setSupabaseUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all mb-4"
              />
              <label className="block text-sm font-medium mb-1.5">Service Role Key</label>
              <div className="relative mb-2">
                <input
                  type={showKeys.supabase ? "text" : "password"}
                  value={supabaseKey}
                  onChange={(e) => setSupabaseKey(e.target.value)}
                  placeholder="ey..."
                  className="w-full px-4 py-2.5 bg-zinc-50 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-sm font-mono focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
                <button onClick={() => toggleShowKey("supabase")} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                  {showKeys.supabase ? "Hide" : "Show"}
                </button>
              </div>
              <p className="text-xs text-zinc-400 mb-4">
                Found under Project Settings → API in your <a href="https://supabase.com/dashboard" target="_blank" rel="noopener" className="text-indigo-500 hover:underline">Supabase dashboard</a>.
              </p>
              {supabaseUrl && supabaseKey && (
                <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300 mb-4">
                  ⚠️ Remember to run the SQL from <code className="font-mono bg-amber-100 dark:bg-amber-900/40 px-1 rounded">supabase-schema.sql</code> in your Supabase SQL Editor to create the required tables.
                </div>
              )}
              <div className="mt-auto flex justify-between">
                <button onClick={goBack} className="px-5 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium transition-colors">
                  ← Back
                </button>
                <button onClick={goNext} className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm">
                  Review →
                </button>
              </div>
            </div>
          )}

          {/* REVIEW */}
          {currentStep === "review" && (
            <div className="flex-1 flex flex-col">
              <h2 className="text-2xl font-bold mb-4">Review & Save</h2>

              {/* Status Chips */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                {[
                  { label: "AI OCR", configured: !!openaiKey },
                  { label: "Email", configured: !!resendKey },
                  { label: "Database", configured: !!(supabaseUrl && supabaseKey) },
                ].map((svc) => (
                  <div key={svc.label} className={`px-3 py-2 rounded-lg text-center text-sm font-semibold ${
                    svc.configured
                      ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700"
                      : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700"
                  }`}>
                    {svc.configured ? "✓ " : "○ "}{svc.label}
                  </div>
                ))}
              </div>

              {/* .env.local Preview */}
              <label className="block text-sm font-medium mb-1.5">.env.local preview</label>
              <pre className="p-4 bg-zinc-900 dark:bg-zinc-950 text-green-400 text-xs font-mono rounded-lg overflow-x-auto mb-6 border border-zinc-700 whitespace-pre-wrap">
                {generateEnvPreview()}
              </pre>

              {configuredCount === 0 && (
                <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-700 dark:text-blue-300 mb-4">
                  ⓘ No keys provided — the app will continue running in full <strong>Mock Mode</strong>. You can return here anytime to configure services.
                </div>
              )}

              {saveResult && (
                <div className={`px-4 py-3 rounded-lg text-sm mb-4 border ${
                  saveResult.success
                    ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300"
                    : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300"
                }`}>
                  {saveResult.success ? "✅ " : "❌ "}{saveResult.message}
                  {saveResult.success && (
                    <span className="block mt-1 text-xs opacity-80">Restart the dev server (<code className="font-mono">npm run dev</code>) to apply changes.</span>
                  )}
                </div>
              )}

              <div className="mt-auto flex justify-between">
                <button onClick={goBack} className="px-5 py-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 font-medium transition-colors">
                  ← Back
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {isSaving ? "Saving..." : (configuredCount > 0 ? `Save .env.local (${configuredCount} service${configuredCount !== 1 ? "s" : ""})` : "Save Empty Config")}
                </button>
              </div>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}
