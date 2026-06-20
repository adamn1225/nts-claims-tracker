/**
 * POST /api/ai/analyze-call-quality
 *
 * Analyzes call recordings to detect if brokers are asking key qualifying questions.
 * Used by sales coaches to identify training opportunities.
 *
 * Qualifying questions checked:
 *   1. Business or Personal? (Is this a business or personal shipment?)
 *   2. Shipping Frequency (How often do they ship?)
 *   3. Current Solution (Who do they currently use for shipping?)
 *   4. Asking for the Close (Being persistent, not taking no for an answer)
 *   5. Follow-up Scheduled? (Did they set a date/time for next contact?)
 *
 * Request body:
 *   brokerId?  string   — Analyze specific broker (admins only, optional = all brokers)
 *   userKey?   string   — GoTo user key (alternative to brokerId)
 *   days?      number   — Days to look back (default: 7, max: 30)
 *   minDuration? number — Minimum call duration in seconds (default: 60 = skip quick calls)
 *
 * Response:
 *   {
 *     analyzed: number,
 *     calls: [{
 *       id: string,
 *       brokerName: string,
 *       startTime: string,
 *       duration: number,
 *       direction: "INBOUND" | "OUTBOUND",
 *       customerPhone: string,
 *       score: number,  // 0-5 (how many questions were asked)
 *       questionsCovered: string[],
 *       questionsMissing: string[],
 *       transcript?: string,  // Optional: full transcript for review
 *       aiAnalysis: string,   // Brief explanation of what was missed
 *     }]
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import {
    getAdminGoToToken,
    fetchGoToRecordingsForUser,
    fetchGoToTranscriptionsViaCallReports,
    enrichRecordingTranscripts,
    type GoToRecording,
} from "@/lib/goto-utils";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const QUALIFYING_QUESTIONS = [
    "Business or Personal",
    "Shipping Frequency",
    "Current Solution",
    "Asking for Close",
    "Follow-up Scheduled",
];

interface AnalyzedCall {
    id: string;
    brokerName: string;
    brokerEmail: string;
    gotoUserKey: string;
    startTime: string;
    duration: number;
    direction: "INBOUND" | "OUTBOUND";
    customerPhone: string;
    customerName?: string;
    score: number;
    questionsCovered: string[];
    questionsMissing: string[];
    transcript?: string;
    aiAnalysis: string;
}

export async function POST(request: NextRequest) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    let userKey: string | undefined;
    let userName: string | undefined;
    let days = 7;
    let minDuration = 60; // Skip calls under 1 minute
    let direction: "INBOUND" | "OUTBOUND" | undefined;
    let maxCalls = 10;
    // source controls which discovery path to use:
    //   "auto"  (default) — try call-history → queue-caller → call-reports in order
    //   "queue" — queue-caller only (INBOUND queue calls)
    //   "all"   — call-reports user-activity only (ANY call: queue + direct + outbound)
    let source: "auto" | "queue" | "all" = "auto";

    try {
        const body = await request.json();
        userKey = body.userKey;
        userName = body.userName;
        days = Math.min(30, Math.max(1, body.days ?? 7));
        minDuration = Math.max(0, body.minDuration ?? 60);
        maxCalls = Math.min(50, Math.max(1, body.maxCalls ?? 10));
        if (body.direction === "INBOUND" || body.direction === "OUTBOUND") direction = body.direction;
        if (body.source === "queue" || body.source === "all") source = body.source;
    } catch {
        // Use defaults
    }

    // Authorization check
    const { data: callerBroker, error: brokerError } = await supabase
        .from("brokers")
        .select("is_admin, is_sales_coach, id, first_name, last_name, email")
        .eq("id", user.id)
        .maybeSingle();

    console.log("[analyze-call-quality] Auth check:", {
        userId: user.id,
        callerBroker,
        brokerError,
    });

    if (!callerBroker) {
        return NextResponse.json({
            error: "Broker not found",
            userId: user.id,
            details: brokerError?.message ?? "No broker record for this user",
        }, { status: 404 });
    }

    const hasCoachAccess = Boolean(callerBroker.is_admin || (callerBroker as { is_sales_coach?: boolean }).is_sales_coach);

    if (!hasCoachAccess) {
        return NextResponse.json({ error: "Forbidden - Admin or sales coach access required" }, { status: 403 });
    }

    if (!userKey) {
        return NextResponse.json({ error: "userKey is required" }, { status: 400 });
    }

    // Fetch recordings
    let recordings: GoToRecording[] = [];
    let recordingApiBlocked = false;
    let callReportsDiagnostic: Record<string, unknown> | undefined;

    {
        // All coaching analysis uses the admin token — no Salestrack account required for the target agent

        try {
            const adminToken = await getAdminGoToToken();

            if (!adminToken) {
                return NextResponse.json({
                    error: "GoTo authentication required",
                    details: "No admin GoTo token found. Re-authenticate via the GoTo button.",
                    needsAuth: true,
                }, { status: 424 });
            }

            console.log("[analyzeCallQuality] Fetching recordings for user", userName || userKey, "days:", days, "source:", source);

            const transcriptCount = () => recordings.filter(r => r.hasTranscript).length;

            // PRIMARY PATH (works for all source values): call-reports user-activity.
            // This is fast (one per-user API call) AND returns recording IDs that the
            // GoTo recording/transcription API can actually read (HTTP 200, not 404).
            //
            // The queue-caller endpoint exposes conversationSpaceIds / callerLegIds
            // that ALL 404 against the recording API, so it cannot be used to fetch
            // transcripts \u2014 only as a queue-stats source.  We therefore route every
            // source value (auto / queue / all) through call-reports and apply a
            // post-filter on leg.queue when the user picked "Queue calls only".
            if (userName) {
                console.log("[analyzeCallQuality] Trying call-reports transcription path");
                const result = await fetchGoToTranscriptionsViaCallReports(
                    adminToken,
                    userName,
                    days,
                    minDuration,
                    maxCalls,
                    { queueOnly: source === "queue" },
                );
                recordings = result.recordings;
                callReportsDiagnostic = result.diagnostic;
                console.log(`[analyzeCallQuality] Call-reports path: ${recordings.length} recordings (${transcriptCount()} with transcripts)`);
            }

            // FALLBACK PATH: call-history admin proxy. Only runs in "auto" mode when
            // the user wasn't matched in call-reports (rare). Often returns 0 because
            // most accounts lack the call-history admin scope.
            if (transcriptCount() === 0 && source === "auto") {
                console.log("[analyzeCallQuality] Trying call-history admin proxy fallback");
                const result = await fetchGoToRecordingsForUser(adminToken, userKey, undefined, days);
                if (result.recordings.length > 0) recordings = result.recordings;
                recordingApiBlocked = result.recordingApiBlocked;
                console.log("[analyzeCallQuality] Call-history fallback:", recordings.length, "| with transcript:", transcriptCount());
            }

            // Enrich with transcript text (only fetches for hasTranscript=true AND no transcript yet)
            const needsEnrichment = recordings.some(r => r.hasTranscript && !r.transcript);
            if (recordings.length > 0 && needsEnrichment) {
                recordings = await enrichRecordingTranscripts(adminToken, recordings);
            }

            userName = userName || "Selected User";
        } catch (err) {
            console.error("[analyze-call-quality] Failed to fetch recordings for userKey:", err);
            return NextResponse.json({
                error: "Failed to fetch call recordings",
                details: String(err),
            }, { status: 500 });
        }
    }

    // Filter recordings
    const filtered = recordings
        .filter(r =>
            r.duration >= minDuration &&
            r.hasTranscript &&
            r.transcript &&
            (!direction || r.direction.toUpperCase() === direction)
        )
        .slice(0, maxCalls);

    console.log(`[analyze-call-quality] Analyzing ${filtered.length} recordings (${recordings.length} total, direction=${direction ?? "ALL"}, maxCalls=${maxCalls})`);

    // Analyze each call with AI 
    const analyzed: AnalyzedCall[] = [];

    for (const recording of filtered) {
        if (!recording.transcript) continue;

        try {
            const analysis = await analyzeCallTranscript(recording.transcript);

            analyzed.push({
                id: recording.id,
                brokerName: userName ?? "Unknown",
                brokerEmail: "",
                gotoUserKey: userKey,
                startTime: recording.startTime,
                duration: recording.duration,
                direction: recording.direction,
                customerPhone: recording.direction === "INBOUND"
                    ? recording.caller.number
                    : recording.callee.number,
                customerName: recording.direction === "INBOUND"
                    ? recording.caller.name
                    : recording.callee.name,
                score: analysis.score,
                questionsCovered: analysis.questionsCovered,
                questionsMissing: analysis.questionsMissing,
                transcript: recording.transcript, // Include for coach review
                aiAnalysis: analysis.explanation,
            });
        } catch (err) {
            console.error(`[analyze-call-quality] Failed to analyze recording ${recording.id}:`, err);
        }
    }

    // Sort by score (lowest first = most training needed)
    analyzed.sort((a, b) => a.score - b.score);

    // ── Persist qualifying question hits to broker_call_quality_scores ──────
    // Total questions detected across all calls in this analysis run.
    const totalHits = analyzed.reduce((sum, c) => sum + c.questionsCovered.length, 0);

    if (totalHits > 0 && userKey) {
        try {
            // Resolve the broker_id from the GoTo userKey via goto_connections.
            const serviceSupabase = createServiceClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.SUPABASE_SERVICE_ROLE_KEY!,
            );

            // goto_connections stores user_key alongside user_id (broker id)
            const { data: conn } = await serviceSupabase
                .from("goto_connections")
                .select("user_id")
                .eq("user_key", userKey)
                .maybeSingle();

            if (conn?.user_id) {
                // Upsert: add this run's hits to the broker's running total
                await serviceSupabase.rpc("increment_call_quality_score", {
                    p_broker_id: conn.user_id,
                    p_questions_hit: totalHits,
                    p_calls_analyzed: analyzed.length,
                });
            }
        } catch (scoreErr) {
            // Non-fatal: log but don't fail the response
            console.error("[analyze-call-quality] Failed to persist quality scores:", scoreErr);
        }
    }

    return NextResponse.json({
        analyzed: analyzed.length,
        totalRecordings: recordings.length,
        skipped: recordings.length - filtered.length,
        recordingApiBlocked,
        avgScore: analyzed.length > 0
            ? Math.round((analyzed.reduce((sum, c) => sum + c.score, 0) / analyzed.length) * 10) / 10
            : 0,
        calls: analyzed,
        // Diagnostic: call-reports API response details (helps debug when 0 transcripts found)
        ...(callReportsDiagnostic ? { callReportsDiagnostic } : {}),
    });
}

/**
 * Use GPT-4 to analyze a call transcript and detect qualifying questions.
 */
async function analyzeCallTranscript(transcript: string): Promise<{
    score: number;
    questionsCovered: string[];
    questionsMissing: string[];
    explanation: string;
}> {
    const systemPrompt = `You are a sales coaching assistant for freight brokers.
Analyze call transcripts to detect if the broker asked these 5 qualifying questions:

1. **Business or Personal**: Did they ask if this is a business shipment or personal transport?
2. **Shipping Frequency**: Did they ask how often the customer ships freight?
3. **Current Solution**: Did they ask who the customer currently uses for shipping?
4. **Asking for Close**: Did they ask for the business/sale? Were they persistent without being pushy?
5. **Follow-up Scheduled**: Did they set a specific date/time for the next call or follow-up?

Return a JSON object: { "covered": ["question1", "question2"], "missing": ["question3"], "explanation": "brief analysis" }

Be strict but fair. The broker doesn't need exact phrasing, but the intent must be clear.`;

    const userPrompt = `Analyze this sales call transcript:

${transcript}

Which of the 5 qualifying questions were asked? Return JSON only.`;

    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            max_tokens: 300,
            temperature: 0.2,
            response_format: { type: "json_object" },
        });

        const content = response.choices[0]?.message?.content?.trim() ?? "{}";
        const parsed = JSON.parse(content);

        const covered = Array.isArray(parsed.covered) ? parsed.covered : [];
        const missing = QUALIFYING_QUESTIONS.filter(q => !covered.some((c: string) =>
            q.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(q.toLowerCase())
        ));

        return {
            score: covered.length,
            questionsCovered: covered,
            questionsMissing: missing,
            explanation: parsed.explanation ?? "Analysis unavailable",
        };
    } catch (err) {
        console.error("[analyzeCallTranscript] AI analysis failed:", err);
        return {
            score: 0,
            questionsCovered: [],
            questionsMissing: QUALIFYING_QUESTIONS,
            explanation: "AI analysis failed",
        };
    }
}
