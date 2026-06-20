"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  generateApiToken,
  API_SCOPES,
  SCOPE_PRESETS,
  getScopeDescription,
  groupScopesByTable,
  type ApiScope,
} from "@/lib/api-token-utils";
import {
  Key,
  Plus,
  Copy,
  Check,
  Trash2,
  Eye,
  EyeOff,
  Activity,
  Shield,
  AlertCircle,
  Info,
} from "lucide-react";

type ApiToken = {
  id: string;
  name: string;
  token_prefix: string;
  scopes: string[];
  rate_limit_per_hour: number;
  requests_count: number;
  last_used_at: string | null;
  last_used_ip: string | null;
  last_used_endpoint: string | null;
  is_active: boolean;
  created_at: string;
  expires_at: string | null;
};

export default function ApiTokenManagement() {
  const supabase = createClient();
  const [tokens, setTokens] = useState<ApiToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTokenData, setNewTokenData] = useState<{
    token: string;
    name: string;
  } | null>(null);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("api_tokens")
      .select("*")
      .order("created_at", { ascending: false });
    setTokens(data || []);
    setLoading(false);
  };

  const handleCreateToken = async (
    name: string,
    scopes: string[],
    rateLimit: number,
    expiresInDays?: number,
  ) => {
    const { token, tokenHash, tokenPrefix } = generateApiToken();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;

    const expiresAt = expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error } = await supabase.from("api_tokens").insert({
      broker_id: user.id,
      name,
      token_hash: tokenHash,
      token_prefix: tokenPrefix,
      scopes,
      rate_limit_per_hour: rateLimit,
      expires_at: expiresAt,
    });

    if (!error) {
      setNewTokenData({ token, name });
      loadTokens();
    }
  };

  const handleRevokeToken = async (tokenId: string) => {
    if (!confirm("Are you sure you want to revoke this token? This action cannot be undone.")) {
      return;
    }

    await supabase
      .from("api_tokens")
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
      })
      .eq("id", tokenId);

    loadTokens();
  };

  const handleDeleteToken = async (tokenId: string) => {
    if (!confirm("Permanently delete this token? This cannot be undone.")) {
      return;
    }

    await supabase.from("api_tokens").delete().eq("id", tokenId);
    loadTokens();
  };

  if (loading) {
    return <div className="text-center py-8">Loading API tokens...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Key className="h-5 w-5 text-orange-500" />
            API Tokens
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            Manage API access tokens for third-party integrations
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600"
        >
          <Plus className="h-4 w-4" />
          Create Token
        </button>
      </div>

      {/* Info Banner */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900">
            <p className="font-medium">API Base URL:</p>
            <code className="mt-1 block rounded bg-blue-100 px-2 py-1 text-xs">
              {typeof window !== 'undefined' ? window.location.origin : ''}/api/v1
            </code>
            <p className="mt-2">
              Include tokens in the <code className="rounded bg-blue-100 px-1">Authorization</code> header:
              <code className="ml-2 rounded bg-blue-100 px-1">Bearer nts_live_...</code>
            </p>
          </div>
        </div>
      </div>

      {/* Tokens List */}
      {tokens.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 py-12 text-center">
          <Key className="mx-auto mb-3 h-12 w-12 text-slate-300" />
          <p className="text-slate-600">No API tokens yet</p>
          <p className="text-sm text-slate-500">Create your first token to get started</p>
        </div>
      ) : (
        <div className="space-y-4">
          {tokens.map((token) => (
            <TokenCard
              key={token.id}
              token={token}
              onRevoke={handleRevokeToken}
              onDelete={handleDeleteToken}
            />
          ))}
        </div>
      )}

      {/* Create Token Modal */}
      {showCreateModal && (
        <CreateTokenModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateToken}
        />
      )}

      {/* New Token Display Modal */}
      {newTokenData && (
        <NewTokenModal
          token={newTokenData.token}
          name={newTokenData.name}
          onClose={() => setNewTokenData(null)}
        />
      )}
    </div>
  );
}

// Token Card Component
function TokenCard({
  token,
  onRevoke,
  onDelete,
}: {
  token: ApiToken;
  onRevoke: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [showScopes, setShowScopes] = useState(false);
  const scopesByTable = groupScopesByTable(token.scopes);

  return (
    <div
      className={`rounded-lg border ${
        token.is_active ? "border-slate-200 bg-white" : "border-slate-300 bg-slate-50 opacity-60"
      } p-4`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h3 className="font-medium text-slate-900">{token.name}</h3>
            {!token.is_active && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                Revoked
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-sm text-slate-600">{token.token_prefix}••••••••</p>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              {token.requests_count.toLocaleString()} requests
            </div>
            <div className="flex items-center gap-1">
              <Shield className="h-3 w-3" />
              {token.scopes.length} permissions
            </div>
            {token.last_used_at && (
              <div>
                Last used: {new Date(token.last_used_at).toLocaleDateString()}
              </div>
            )}
            {token.expires_at && (
              <div className="text-amber-600">
                Expires: {new Date(token.expires_at).toLocaleDateString()}
              </div>
            )}
          </div>
          
          {/* Scopes Toggle */}
          <button
            onClick={() => setShowScopes(!showScopes)}
            className="mt-3 text-xs text-orange-600 hover:text-orange-700 flex items-center gap-1"
          >
            {showScopes ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
            {showScopes ? "Hide" : "Show"} permissions
          </button>
          
          {showScopes && (
            <div className="mt-3 rounded-lg bg-slate-50 p-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(scopesByTable).map(([table, actions]) => (
                  <div key={table} className="text-xs">
                    <div className="font-medium text-slate-700 capitalize">
                      {table.replace(/_/g, " ")}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {actions.map((action) => (
                        <span
                          key={action}
                          className="rounded bg-orange-100 px-1.5 py-0.5 text-orange-700"
                        >
                          {action}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {token.is_active && (
            <button
              onClick={() => onRevoke(token.id)}
              className="rounded p-2 text-slate-600 hover:bg-slate-100 hover:text-red-600"
              title="Revoke token"
            >
              <AlertCircle className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => onDelete(token.id)}
            className="rounded p-2 text-slate-600 hover:bg-slate-100 hover:text-red-600"
            title="Delete token"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Create Token Modal
function CreateTokenModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (name: string, scopes: string[], rateLimit: number, expiresInDays?: number) => void;
}) {
  const [name, setName] = useState("");
  const [preset, setPreset] = useState<"readonly" | "readwrite" | "admin" | "custom">("readonly");
  const [customScopes, setCustomScopes] = useState<Set<string>>(new Set());
  const [rateLimit, setRateLimit] = useState(10000);
  const [expiresInDays, setExpiresInDays] = useState<number | undefined>(undefined);

  const handleSubmit = () => {
    if (!name.trim()) return;

    const scopes = preset === "custom" 
      ? Array.from(customScopes)
      : SCOPE_PRESETS[preset];

    onCreate(name.trim(), scopes, rateLimit, expiresInDays);
    onClose();
  };

  const toggleScope = (scope: string) => {
    const newScopes = new Set(customScopes);
    if (newScopes.has(scope)) {
      newScopes.delete(scope);
    } else {
      newScopes.add(scope);
    }
    setCustomScopes(newScopes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Create New API Token</h3>

        <div className="space-y-4">
          {/* Token Name */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Token Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., TMS Integration, Mobile App"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          {/* Permission Preset */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Permission Level
            </label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as any)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="readonly">Read Only</option>
              <option value="readwrite">Read + Write</option>
              <option value="admin">Full Access (Admin)</option>
              <option value="custom">Custom Permissions</option>
            </select>
          </div>

          {/* Custom Scopes */}
          {preset === "custom" && (
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Select Permissions
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {API_SCOPES.map((scope) => (
                  <label
                    key={scope}
                    className="flex items-center gap-2 rounded border border-slate-200 p-2 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={customScopes.has(scope)}
                      onChange={() => toggleScope(scope)}
                      className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span>{getScopeDescription(scope)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Rate Limit */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Rate Limit (requests/hour)
            </label>
            <input
              type="number"
              value={rateLimit}
              onChange={(e) => setRateLimit(parseInt(e.target.value))}
              min="100"
              max="100000"
              step="1000"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          {/* Expiration */}
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Expiration (optional)
            </label>
            <select
              value={expiresInDays || ""}
              onChange={(e) => setExpiresInDays(e.target.value ? parseInt(e.target.value) : undefined)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">Never expires</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">1 year</option>
            </select>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:opacity-50"
          >
            Create Token
          </button>
        </div>
      </div>
    </div>
  );
}

// New Token Display Modal
function NewTokenModal({ token, name, onClose }: { token: string; name: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(token);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
            <Check className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Token Created Successfully!</h3>
            <p className="text-sm text-slate-600">{name}</p>
          </div>
        </div>

        <div className="rounded-lg border-2 border-orange-200 bg-orange-50 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-orange-900">
            <AlertCircle className="h-4 w-4" />
            Save this token now - it won't be shown again!
          </div>
          <div className="relative">
            <code className="block overflow-x-auto rounded bg-white p-3 text-sm text-slate-900">
              {token}
            </code>
            <button
              onClick={handleCopy}
              className="absolute right-2 top-2 rounded p-1.5 hover:bg-slate-100"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Copy className="h-4 w-4 text-slate-600" />
              )}
            </button>
          </div>
        </div>

        <button
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          I've saved my token
        </button>
      </div>
    </div>
  );
}
