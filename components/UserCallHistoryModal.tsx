/**
 * UserCallHistoryModal - Displays detailed call history for an individual user
 * 
 * Shows:
 * - User stats (total calls, answered, missed, avg duration)
 * - Complete call log with caller/callee details
 * - Direction indicators (inbound/outbound)
 * - Call outcomes and durations
 */

"use client";

import { useState, useEffect } from "react";
import { X, Phone, PhoneIncoming, PhoneOutgoing, Clock, Calendar, Loader2 } from "lucide-react";

interface UserCallHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  userKey: string;
  userEmail: string;
}

interface Call {
  legId: string;
  caller: { name: string; number: string };
  callee: { name: string; number: string };
  direction: string;
  startTime: string;
  answerTime: string | null;
  duration: number;
  hangupCause: number;
  outcome: string;
}

interface CallHistoryData {
  stats: {
    totalCalls: number;
    answeredCalls: number;
    missedCalls: number;
    totalDurationSeconds: number;
    avgDurationSeconds: number;
    inboundCalls: number;
    outboundCalls: number;
  };
  calls: Call[];
  dateRange: {
    startTime: string;
    endTime: string;
    days: number;
  };
}

export default function UserCallHistoryModal({
  isOpen,
  onClose,
  userName,
  userKey,
  userEmail,
}: UserCallHistoryModalProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<CallHistoryData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState(7);

  useEffect(() => {
    if (isOpen && userKey) {
      fetchCallHistory(selectedDays);
    } else if (isOpen && !userKey) {
      setError("No user key available for this agent — they may not be a GoTo Connect user.");
    }
  }, [isOpen, userKey, selectedDays]);

  async function fetchCallHistory(days: number) {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/goto/user-call-history?userKey=${userKey}&days=${days}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error("Failed to fetch call history:", err);
      setError(err instanceof Error ? err.message : "Failed to load call history");
    } finally {
      setLoading(false);
    }
  }

  function formatDuration(seconds: number): string {
    if (seconds === 0) return "0s";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  }

  function getCallSummary(call: Call): { label: string; number: string } {
    // For inbound: show caller (customer)
    // For outbound: show callee (customer)
    if (call.direction === "INBOUND") {
      return {
        label: call.caller.name || "Unknown Caller",
        number: call.caller.number,
      };
    } else {
      return {
        label: call.callee.name || "Unknown Number",
        number: call.callee.number,
      };
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#1A1A1A] rounded-lg max-w-5xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-white">{userName}</h2>
            <p className="text-gray-400 text-sm mt-1">{userEmail}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Date Range Selector */}
        <div className="px-6 py-4 border-b border-gray-700 bg-[#0A0A0A]">
          <div className="flex items-center gap-4">
            <label className="text-sm text-gray-400">Call History:</label>
            <select
              value={selectedDays}
              onChange={(e) => setSelectedDays(parseInt(e.target.value))}
              className="bg-[#1A1A1A] text-white px-3 py-1.5 rounded border border-gray-700 focus:border-[#E85D04] focus:outline-none text-sm"
            >
              <option value="7">Last 7 days</option>
              <option value="14">Last 14 days</option>
              <option value="30">Last 30 days</option>
              <option value="60">Last 60 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-[#E85D04]" />
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={() => fetchCallHistory(selectedDays)}
                className="px-4 py-2 bg-[#E85D04] text-white rounded-lg hover:bg-[#D44E00]"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {/* Stats Grid */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-[#0A0A0A] rounded-lg p-4">
                  <div className="text-gray-400 text-xs uppercase mb-1">Total Calls</div>
                  <div className="text-2xl font-bold text-white">{data.stats.totalCalls}</div>
                </div>
                <div className="bg-[#0A0A0A] rounded-lg p-4">
                  <div className="text-gray-400 text-xs uppercase mb-1">Answered</div>
                  <div className="text-2xl font-bold text-green-400">{data.stats.answeredCalls}</div>
                </div>
                <div className="bg-[#0A0A0A] rounded-lg p-4">
                  <div className="text-gray-400 text-xs uppercase mb-1">Missed</div>
                  <div className="text-2xl font-bold text-red-400">{data.stats.missedCalls}</div>
                </div>
                <div className="bg-[#0A0A0A] rounded-lg p-4">
                  <div className="text-gray-400 text-xs uppercase mb-1">Avg Duration</div>
                  <div className="text-2xl font-bold text-white">{formatDuration(data.stats.avgDurationSeconds)}</div>
                </div>
              </div>

              {/* Call List */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-gray-400 uppercase mb-3">
                  Call Log ({data.calls.length} calls)
                </h3>

                {data.calls.length === 0 && (
                  <div className="text-center py-12 text-gray-400">
                    No calls found in this time period
                  </div>
                )}

                {data.calls.map((call) => {
                  const summary = getCallSummary(call);
                  const isAnswered = call.outcome === "answered";
                  const isInbound = call.direction === "INBOUND";

                  return (
                    <div
                      key={call.legId}
                      className="bg-[#0A0A0A] rounded-lg p-4 hover:bg-[#252525] transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          {/* Direction Icon */}
                          <div className={`p-2 rounded-full ${isInbound
                            ? isAnswered ? "bg-green-500/20" : "bg-red-500/20"
                            : "bg-blue-500/20"
                            }`}>
                            {isInbound ? (
                              <PhoneIncoming className={`h-4 w-4 ${isAnswered ? "text-green-400" : "text-red-400"
                                }`} />
                            ) : (
                              <PhoneOutgoing className="h-4 w-4 text-blue-400" />
                            )}
                          </div>

                          {/* Call Details */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium text-white truncate">
                                {summary.label}
                              </span>
                              <span className="text-gray-500 text-sm font-mono">
                                {summary.number}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-gray-400">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(call.startTime).toLocaleDateString()}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(call.startTime).toLocaleTimeString()}
                              </span>
                              <span className={`px-2 py-0.5 rounded ${isInbound ? "bg-green-500/20 text-green-300" : "bg-blue-500/20 text-blue-300"
                                }`}>
                                {isInbound ? "Inbound" : "Outbound"}
                              </span>
                            </div>
                          </div>

                          {/* Duration */}
                          <div className="text-right">
                            <div className={`text-lg font-semibold ${isAnswered ? "text-white" : "text-gray-500"
                              }`}>
                              {formatDuration(call.duration)}
                            </div>
                            <div className={`text-xs ${isAnswered ? "text-gray-400" : "text-red-400"
                              }`}>
                              {isAnswered ? "Answered" : "No Answer"}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-700 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
