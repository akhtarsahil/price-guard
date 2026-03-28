"use client";
import { useState, useCallback } from "react";
import { UploadCloud, File, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";

interface UploadInvoiceProps {
  onUploadSuccess: () => void;
}

type FileStatus = "pending" | "uploading" | "done" | "error";

interface QueuedFile {
  file: File;
  status: FileStatus;
  error?: string;
}

export function UploadInvoice({ onUploadSuccess }: UploadInvoiceProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<{ processed: number; errors: number } | null>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragging(true);
    } else if (e.type === "dragleave") {
      setIsDragging(false);
    }
  }, []);

  const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];

  const addFiles = (files: FileList) => {
    const newFiles: QueuedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      if (validTypes.includes(f.type)) {
        newFiles.push({ file: f, status: "pending" });
      }
    }
    if (newFiles.length > 0) {
      setQueue((prev) => [...prev, ...newFiles]);
      setResults(null);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
    // Reset input so same files can be re-selected
    e.target.value = "";
  };

  const removeFile = (index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  };

  const processAll = async () => {
    if (queue.length === 0) return;
    setIsProcessing(true);
    setResults(null);

    let processed = 0;
    let errors = 0;

    for (let i = 0; i < queue.length; i++) {
      // Mark current as uploading
      setQueue((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: "uploading" as FileStatus } : item
        )
      );

      try {
        const formData = new FormData();
        formData.append("invoice", queue[i].file);

        const response = await fetch("/api/process-invoice", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed");
        }

        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: "done" as FileStatus } : item
          )
        );
        processed++;
      } catch (err: any) {
        setQueue((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: "error" as FileStatus, error: err.message }
              : item
          )
        );
        errors++;
      }
    }

    setResults({ processed, errors });
    setIsProcessing(false);
    if (processed > 0) onUploadSuccess();
  };

  const clearQueue = () => {
    setQueue([]);
    setResults(null);
  };

  const statusIcon = (s: FileStatus) => {
    switch (s) {
      case "uploading":
        return <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />;
      case "done":
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <File className="w-4 h-4 text-zinc-400" />;
    }
  };

  return (
    <div className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm">
      <div className="p-6">
        <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50 mb-1">
          Upload Invoices
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6">
          Upload one or more invoice photos/PDFs. Each will be processed sequentially.
        </p>

        {/* Drop zone — always visible */}
        <div
          className={`
            relative flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl transition-colors mb-4
            ${isDragging
              ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20'
              : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50 dark:bg-zinc-900/50'}
          `}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            accept=".pdf,image/jpeg,image/png"
            multiple
            onChange={handleChange}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            disabled={isProcessing}
          />
          <div className="p-3 bg-white dark:bg-black rounded-full shadow-sm mb-3">
            <UploadCloud className="w-6 h-6 text-indigo-500" />
          </div>
          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-0.5">
            Click to upload or drag and drop
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 text-center max-w-xs">
            PDF, PNG, or JPG. Select multiple files for batch processing.
          </p>
        </div>

        {/* Queue list */}
        {queue.length > 0 && (
          <div className="space-y-2 mb-4">
            {queue.map((item, i) => (
              <div
                key={`${item.file.name}-${i}`}
                className={`flex items-center justify-between px-3 py-2 rounded-lg border text-sm transition-colors ${
                  item.status === "done"
                    ? "border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/10"
                    : item.status === "error"
                    ? "border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/10"
                    : "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {statusIcon(item.status)}
                  <span className="truncate text-zinc-700 dark:text-zinc-300">
                    {item.file.name}
                  </span>
                  <span className="text-xs text-zinc-400 shrink-0">
                    {(item.file.size / 1024).toFixed(0)} KB
                  </span>
                </div>
                {item.status === "pending" && !isProcessing && (
                  <button
                    onClick={() => removeFile(i)}
                    className="p-1 text-zinc-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
                {item.status === "error" && (
                  <span className="text-xs text-red-500 shrink-0 ml-2">{item.error}</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Results summary */}
        {results && (
          <div className={`p-3 rounded-lg text-sm mb-4 ${
            results.errors === 0
              ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50"
              : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50"
          }`}>
            {results.processed} processed, {results.errors} errors
          </div>
        )}

        {/* Action buttons */}
        {queue.length > 0 && (
          <div className="flex gap-2">
            {!results ? (
              <button
                onClick={processAll}
                disabled={isProcessing || queue.every((q) => q.status !== "pending")}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-black outline-none shadow-sm"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing {queue.filter((q) => q.status === "done").length + 1} of {queue.length}...
                  </>
                ) : (
                  <>
                    Process {queue.length} Invoice{queue.length > 1 ? "s" : ""}
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={clearQueue}
                className="flex-1 py-2.5 px-4 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 text-sm font-medium rounded-lg transition-colors"
              >
                Clear & Upload More
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
