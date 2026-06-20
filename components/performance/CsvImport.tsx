"use client";

import { useRef, useState, useCallback } from "react";
import { Upload, CheckCircle2, XCircle, FileText } from "lucide-react";
import type { AgentSummaryRow, CallDetailRow, AiSentiment } from "./types";
import { parseCsvLine, parseTimeToSeconds, parsePct } from "./utils";

// --- CSV Parsers ---

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, " ").trim();
}

function detectFormat(headers: string[]): "agent_summary" | "call_details" | "unknown" {
  const normalized = headers.map(normalizeHeader);
  if (normalized.some((h) => h.includes("handled"))) return "agent_summary";
  if (normalized.some((h) => h.includes("talk duration"))) return "call_details";
  return "unknown";
}

function parseAgentSummary(rows: string[][]): AgentSummaryRow[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);

  const col = (name: string) =>
    headers.findIndex((h) => h.includes(name));

  const iAgentName = col("agent name");
  const iHandled = col("handled");
  const iTalkTime = col("total talk time");
  const iMissed = col("missed");
  const iUtil = col("utilization");
  const iAvailable = col("available");
  const iPaused = col("paused");

  return rows
    .slice(1)
    .filter((r) => r.length > 1 && r[iAgentName]?.trim())
    .map((r) => ({
      agentName: r[iAgentName]?.trim() ?? "",
      handledCalls: parseInt(r[iHandled] ?? "0", 10) || 0,
      totalTalkTimeSeconds: parseTimeToSeconds(r[iTalkTime] ?? ""),
      missedRingPct: parsePct(r[iMissed] ?? "0"),
      utilizationPct: parsePct(r[iUtil] ?? "0"),
      availableTimeSeconds: parseTimeToSeconds(r[iAvailable] ?? ""),
      pausedTimeSeconds: parseTimeToSeconds(r[iPaused] ?? ""),
      sentimentPositivePct: 0, // Not present in agent summary CSV
    }));
}

function mapSentiment(raw: string): AiSentiment {
  const lower = raw.toLowerCase().trim();
  if (lower === "positive") return "positive";
  if (lower === "negative") return "negative";
  return "neutral";
}

function parseCallDetails(rows: string[][]): CallDetailRow[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map(normalizeHeader);

  const col = (name: string) =>
    headers.findIndex((h) => h.includes(name));

  const iAgent = col("agent name");
  const iQueue = col("queue");
  const iDuration = col("talk duration");
  const iOutcome = col("outcome");
  const iSentiment = col("sentiment");
  const iStart = col("start time");
  const iCallerName = col("caller name");
  const iCallerNumber = col("caller number");

  return rows
    .slice(1)
    .filter((r) => r.length > 1 && r[iAgent]?.trim())
    .map((r, idx) => ({
      id: `csv-${idx}-${Date.now()}`,
      agentName: r[iAgent]?.trim() ?? "",
      queue: r[iQueue]?.trim() ?? "",
      talkDurationSeconds: parseInt(r[iDuration] ?? "0", 10) || 0,
      outcome: r[iOutcome]?.trim().toLowerCase() ?? "",
      aiSentiment: mapSentiment(r[iSentiment] ?? ""),
      startTime: r[iStart]?.trim() ?? "",
      callerName: r[iCallerName]?.trim() ?? "",
      callerNumber: r[iCallerNumber]?.trim() ?? "",
    }));
}

function parseCsvText(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map(parseCsvLine);
}

// --- Drop Zone ---

type ZoneStatus = "idle" | "dragover" | "success" | "error";

interface ZoneState {
  status: ZoneStatus;
  fileName?: string;
  recordCount?: number;
  errorMsg?: string;
}

interface DropZoneProps {
  title: string;
  description: string;
  accepts: string;
  state: ZoneState;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onFile: (file: File) => void;
  onDragStateChange: (over: boolean) => void;
}

function DropZone({
  title,
  description,
  accepts,
  state,
  inputRef,
  onFile,
  onDragStateChange,
}: DropZoneProps) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    onDragStateChange(false);
    const file = e.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragStateChange(true);
      }}
      onDragLeave={() => onDragStateChange(false)}
      onDrop={handleDrop}
      className={`relative flex min-h-[140px] flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
        state.status === "dragover"
          ? "border-orange-400 bg-orange-50"
          : state.status === "success"
            ? "border-emerald-300 bg-emerald-50"
            : state.status === "error"
              ? "border-red-300 bg-red-50"
              : "border-slate-200 bg-slate-50 hover:border-slate-300"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFile(file);
          e.target.value = "";
        }}
      />

      {state.status === "success" ? (
        <>
          <CheckCircle2 className="h-7 w-7 text-emerald-500" />
          <p className="mt-2 text-sm font-semibold text-emerald-700">
            {state.fileName}
          </p>
          <p className="text-xs text-emerald-600">
            {state.recordCount} record{state.recordCount !== 1 ? "s" : ""} loaded
          </p>
          <button
            onClick={() => inputRef.current?.click()}
            className="mt-2 text-xs text-emerald-700 underline hover:no-underline"
          >
            Replace file
          </button>
        </>
      ) : state.status === "error" ? (
        <>
          <XCircle className="h-7 w-7 text-red-500" />
          <p className="mt-2 text-sm font-semibold text-red-700">Parse error</p>
          <p className="text-xs text-red-600">{state.errorMsg}</p>
          <button
            onClick={() => inputRef.current?.click()}
            className="mt-2 text-xs text-red-700 underline hover:no-underline"
          >
            Try another file
          </button>
        </>
      ) : (
        <>
          <Upload
            className={`h-7 w-7 ${state.status === "dragover" ? "text-orange-400" : "text-slate-400"}`}
          />
          <p className="mt-2 text-sm font-semibold text-slate-700">{title}</p>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
          <button
            onClick={() => inputRef.current?.click()}
            className="mt-3 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Browse files
          </button>
          <p className="mt-1.5 text-[11px] text-slate-400">{accepts}</p>
        </>
      )}
    </div>
  );
}

// --- Main Component ---

interface CsvImportProps {
  onAgentSummaryImported: (summaries: AgentSummaryRow[]) => void;
  onCallDetailsImported: (calls: CallDetailRow[]) => void;
}

export function CsvImport({ onAgentSummaryImported, onCallDetailsImported }: CsvImportProps) {
  const [summaryZone, setSummaryZone] = useState<ZoneState>({ status: "idle" });
  const [detailsZone, setDetailsZone] = useState<ZoneState>({ status: "idle" });
  const summaryRef = useRef<HTMLInputElement>(null);
  const detailsRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    (file: File, expectedFormat: "agent_summary" | "call_details") => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const text = e.target?.result as string;
          const rows = parseCsvText(text);
          if (rows.length === 0) throw new Error("File appears to be empty.");

          const detected = detectFormat(rows[0]);

          if (detected === "unknown") {
            throw new Error(
              "Could not detect CSV format. Ensure headers match GoTo Analytics export.",
            );
          }

          if (detected !== expectedFormat) {
            throw new Error(
              `Expected ${expectedFormat === "agent_summary" ? "Agent Summary" : "Call Details"} CSV but got the other format.`,
            );
          }

          if (detected === "agent_summary") {
            const summaries = parseAgentSummary(rows);
            setSummaryZone({
              status: "success",
              fileName: file.name,
              recordCount: summaries.length,
            });
            onAgentSummaryImported(summaries);
          } else {
            const calls = parseCallDetails(rows);
            setDetailsZone({
              status: "success",
              fileName: file.name,
              recordCount: calls.length,
            });
            onCallDetailsImported(calls);
          }
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Unknown error";
          if (expectedFormat === "agent_summary") {
            setSummaryZone({ status: "error", errorMsg: msg });
          } else {
            setDetailsZone({ status: "error", errorMsg: msg });
          }
        }
      };

      reader.onerror = () => {
        const errorState: ZoneState = {
          status: "error",
          errorMsg: "Failed to read file.",
        };
        if (expectedFormat === "agent_summary") setSummaryZone(errorState);
        else setDetailsZone(errorState);
      };

      reader.readAsText(file);
    },
    [onAgentSummaryImported, onCallDetailsImported],
  );

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-4">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 shrink-0 text-slate-500" />
          <h2 className="text-base font-semibold text-slate-900">
            Import GoTo Analytics Data
          </h2>
        </div>
        <p className="mt-0.5 text-sm text-slate-500">
          Upload your exported CSVs from GoTo Analytics. Data is parsed in-browser — nothing is uploaded to a server.
        </p>
      </div>

      <div className="grid gap-4 p-6 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold text-slate-600">
            Agent Summary
          </p>
          <DropZone
            title="Agent Summary CSV"
            description="Handled calls, talk time, missed %, utilization"
            accepts="GoTo: Analytics › Agents › Export"
            state={summaryZone}
            inputRef={summaryRef}
            onFile={(f) => processFile(f, "agent_summary")}
            onDragStateChange={(over) =>
              setSummaryZone((s) => ({
                ...s,
                status: over && s.status !== "success" ? "dragover" : s.status === "dragover" ? "idle" : s.status,
              }))
            }
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-slate-600">
            Queue Caller Details
          </p>
          <DropZone
            title="Call Details CSV"
            description="Per-call: agent, queue, duration, sentiment, caller"
            accepts="GoTo: Analytics › Queue Caller Details › Export"
            state={detailsZone}
            inputRef={detailsRef}
            onFile={(f) => processFile(f, "call_details")}
            onDragStateChange={(over) =>
              setDetailsZone((s) => ({
                ...s,
                status: over && s.status !== "success" ? "dragover" : s.status === "dragover" ? "idle" : s.status,
              }))
            }
          />
        </div>
      </div>
    </div>
  );
}
