export type AiSentiment = "positive" | "neutral" | "negative";
export type QualityRating = "excellent" | "good" | "poor";
export type CallType = "quote" | "customer_service" | "junk";
export type CallScoreVerdict = "strong" | "needs_coaching" | "critical";

// ─── View mode ────────────────────────────────────────────────────────────────

/** The three dashboard views available to sales coaches */
export type ViewMode = "team" | "groups" | "individual";

// ─── Agent level ──────────────────────────────────────────────────────────────

export interface AgentSummaryRow {
  agentName: string;
  gotoUserKey?: string;
  gotoUserEmail?: string;
  officeLocation?: string | null;
  handledCalls: number;
  totalTalkTimeSeconds: number;
  missedRingPct: number;
  utilizationPct: number;
  availableTimeSeconds: number;
  pausedTimeSeconds: number;
  sentimentPositivePct: number;
}

export interface CallDetailRow {
  id: string;
  agentName: string;
  queue: string;
  talkDurationSeconds: number;
  outcome: string;
  aiSentiment: AiSentiment;
  startTime: string;
  callerName: string;
  callerNumber: string;
}

export interface CallScore {
  callId: string;
  isValid: boolean;
  callType: CallType;
  discoveryPerformed: boolean;
  discoveryQuality: QualityRating;
  closingSkills: QualityRating;
  clearNextSteps: boolean;
  overallVerdict: CallScoreVerdict;
  overallScore: number; // 0–100
}

// ─── Group level ──────────────────────────────────────────────────────────────

export interface GroupSummary {
  groupName: string;       // office_location value, or "Unassigned"
  agentCount: number;
  totalCalls: number;
  handledCalls: number;
  missedCalls: number;
  avgTalkTimeSeconds: number;
  missedRingPct: number;
  sentimentPositivePct: number;
  topAgent: string | null;
  bottomAgent: string | null;
}

// ─── Dashboard data ───────────────────────────────────────────────────────────

export interface PerformanceData {
  agentSummaries: AgentSummaryRow[];
  callDetails: CallDetailRow[];
  callScores: Record<string, CallScore>;
  groups: GroupSummary[];
  dataSource: "csv" | "mock" | "api";
  importedAt?: string;
}

// ─── Agent override config ────────────────────────────────────────────────────

export interface AgentOverride {
  id?: string;
  gotoUserEmail: string;
  gotoUserKey?: string | null;
  displayNameOverride?: string | null;
  officeLocation?: string | null;
  isExcluded: boolean;
  notes?: string | null;
}

