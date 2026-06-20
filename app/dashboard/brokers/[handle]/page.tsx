"use client";

import { useCallback, useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, ExternalLink, Link2, Loader2, Palette, UserCircle2 } from "lucide-react";
import ProfileHeader, {
  type ProfileHeaderBroker,
} from "@/components/broker-profile/ProfileHeader";
import AchievementsGrid from "@/components/broker-profile/AchievementsGrid";
import PortfolioGallery, {
  type PortfolioItem,
} from "@/components/broker-profile/PortfolioGallery";
import EditProfileModal from "@/components/broker-profile/EditProfileModal";
import LandingPageEditor from "@/components/broker-profile/LandingPageEditor";
import {
  coerceLandingConfig,
  LANDING_STATUS_LABELS,
  type LandingConfig,
} from "@/lib/landing";
import {
  brokerHandle,
  computeXp,
  getLevelProgress,
  getProfileChecklist,
  getProfileStrength,
  getCompletenessSteps,
  getAchievements,
  type BrokerStats,
  type BrokerProfileExtras,
} from "@/lib/gamification";

type BrokerRow = ProfileHeaderBroker & {
  id: string;
  bio: string | null;
  email: string;
  phone?: string | null;
  profile_slug?: string | null;
  landing_config?: unknown;
  landing_status?: string | null;
  landing_review_note?: string | null;
};

const EMPTY_STATS: BrokerStats = {
  wonCount: 0,
  activeCount: 0,
  totalCustomers: 0,
  tasksCompleted: 0,
  portfolioCount: 0,
  loadsMoved: 0,
  qualifyingQuestionsHit: 0,
};

const EMPTY_EXTRAS: BrokerProfileExtras = {
  gotoConnected: false,
  helpDocsViewed: false,
};

export default function BrokerProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = use(params);
  const router = useRouter();
  // Untyped client for new profile columns / broker_portfolio table that may
  // not be in the generated types until db:types is regenerated.
  const supabase = createClient() as unknown as SupabaseClient;

  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [broker, setBroker] = useState<BrokerRow | null>(null);
  const [extras, setExtras] = useState<BrokerProfileExtras>(EMPTY_EXTRAS);
  const [stats, setStats] = useState<BrokerStats>(EMPTY_STATS);
  const [portfolio, setPortfolio] = useState<PortfolioItem[]>([]);
  const [showEdit, setShowEdit] = useState(false);
  const [showLandingEditor, setShowLandingEditor] = useState(false);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id ?? null);

      // Fetch all active brokers and match by email handle (local part before @).
      // Broker list is small so client-side match is fine and handles duplicates.
      // We try to select profile columns added by the broker-profiles migration.
      // Fall back to base columns only if those columns don't exist yet.
      let rows: unknown[] | null = null;
      const { data: withProfile, error: profileErr } = await supabase
        .from("brokers")
        .select(
          "id, email, first_name, last_name, office_location, territory, avatar_url, headline, bio, linkedin_url, specialties, help_docs_viewed, phone, profile_slug, landing_config, landing_status, landing_review_note",
        )
        .eq("is_active", true);
      if (!profileErr) {
        rows = withProfile;
      } else {
        // Migration not run yet — fall back to base columns
        const { data: base } = await supabase
          .from("brokers")
          .select("id, email, first_name, last_name, office_location, territory")
          .eq("is_active", true);
        rows = base;
      }

      // Try UUID match first (new links use broker.id), then fall back to
      // email-handle match for any old bookmarked or shared links.
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(handle);
      const match = (rows ?? []).find((b) => {
        const row = b as { id: string; email: string };
        if (isUuid) return row.id === handle;
        return brokerHandle(row.email) === handle;
      }) as BrokerRow | undefined;

      if (!match) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setBroker(match);

      const fullName = [match.first_name, match.last_name]
        .filter(Boolean)
        .join(" ");

      // Gather stats in parallel.
      const [customersRes, tasksRes, portfolioRes, loadsRes, gotoRes, callQualityRes] =
        await Promise.all([
          supabase
            .from("customers")
            .select("status")
            .eq("broker_id", match.id),
          supabase
            .from("tasks")
            .select("id", { count: "exact", head: true })
            .eq("broker_id", match.id)
            .eq("status", "completed"),
          supabase
            .from("broker_portfolio")
            .select("*")
            .eq("broker_id", match.id)
            .order("sort_order", { ascending: true })
            .order("created_at", { ascending: false }),
          fullName
            ? supabase
                .from("completed_orders")
                .select("id", { count: "exact", head: true })
                .eq("assigned_to", fullName)
            : Promise.resolve({ count: 0 }),
          // GoTo connection status
          supabase
            .from("goto_connections")
            .select("user_id")
            .eq("user_id", match.id)
            .maybeSingle(),
          // Call quality scores (may not exist if migration not yet run)
          supabase
            .from("broker_call_quality_scores")
            .select("qualifying_questions_hit")
            .eq("broker_id", match.id)
            .maybeSingle(),
        ]);

      const customerRows =
        (customersRes.data as { status: string | null }[] | null) ?? [];
      const wonCount = customerRows.filter((c) =>
        c.status?.toLowerCase().includes("won"),
      ).length;
      const activeCount = customerRows.filter((c) =>
        c.status?.toLowerCase().includes("active"),
      ).length;

      const items = (portfolioRes.data as PortfolioItem[] | null) ?? [];
      setPortfolio(items);

      setStats({
        wonCount,
        activeCount,
        totalCustomers: customerRows.length,
        tasksCompleted: tasksRes.count ?? 0,
        portfolioCount: items.length,
        loadsMoved: ("count" in loadsRes ? loadsRes.count : 0) ?? 0,
        qualifyingQuestionsHit:
          (callQualityRes as { data?: { qualifying_questions_hit?: number } | null })?.data
            ?.qualifying_questions_hit ?? 0,
      });

      const helpViewed =
        !!(match as unknown as { help_docs_viewed?: boolean }).help_docs_viewed;
      setExtras({
        gotoConnected: !!(
          gotoRes as { data?: { user_id?: string } | null }
        )?.data?.user_id,
        helpDocsViewed: helpViewed,
      });
    } catch (err) {
      console.error("Failed to load broker profile:", err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [handle, supabase]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#E85D04]" />
      </div>
    );
  }

  if (notFound || !broker) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
        <UserCircle2 className="h-12 w-12 text-gray-300" />
        <h1 className="mt-3 text-lg font-semibold text-gray-900">
          Broker not found
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          No broker with the handle &ldquo;{handle}&rdquo; was found.
        </p>
        <Link
          href="/dashboard/brokers"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[#E85D04] px-4 py-2 text-sm font-medium text-white hover:bg-[#d35303]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to team directory
        </Link>
      </div>
    );
  }

  const completenessSteps = getCompletenessSteps(broker, extras);
  const xp = computeXp(stats, completenessSteps);
  const level = getLevelProgress(xp);
  const checklist = getProfileChecklist(broker, stats.portfolioCount, extras);
  const strength = getProfileStrength(checklist);
  const achievements = getAchievements(stats, broker, extras, strength);
  const isOwn = currentUserId === broker.id;
  const landingConfig: LandingConfig = coerceLandingConfig(broker.landing_config);
  const landingStatus = broker.landing_status ?? "draft";

  async function markHelpDocsViewed() {
    if (extras.helpDocsViewed) return;
    try {
      await supabase
        .from("brokers")
        .update({ help_docs_viewed: true })
        .eq("id", broker!.id);
      setExtras((prev) => ({ ...prev, helpDocsViewed: true }));
    } catch {
      // non-fatal
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
      <button
        onClick={() => router.back()}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      {isOwn && broker.profile_slug && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-[#E85D04]/30 bg-[#E85D04]/5 px-4 py-2.5">
          <Link2 className="h-4 w-4 shrink-0 text-[#E85D04]" />
          <span className="text-sm text-gray-600">
            Your public page:
            <a
              href={`/rep/${broker.profile_slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-1 font-medium text-[#E85D04] hover:underline"
            >
              /rep/{broker.profile_slug}
            </a>
          </span>
          <button
            onClick={() => {
              navigator.clipboard.writeText(
                `${window.location.origin}/rep/${broker.profile_slug}`,
              );
            }}
            className="ml-auto shrink-0 rounded px-2 py-1 text-xs font-medium text-[#E85D04] hover:bg-[#E85D04]/10"
          >
            Copy link
          </button>
        </div>
      )}

      {isOwn && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <Palette className="h-5 w-5 shrink-0 text-gray-700" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900">
              Your landing page
            </p>
            <p className="text-xs text-gray-500">
              Pick a brand, add your own sections, and make it yours.
            </p>
          </div>
          <span
            className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
              landingStatus === "approved"
                ? "bg-emerald-100 text-emerald-700"
                : landingStatus === "pending"
                  ? "bg-amber-100 text-amber-700"
                  : landingStatus === "rejected"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-600"
            }`}
          >
            {LANDING_STATUS_LABELS[landingStatus] ?? "Draft"}
          </span>
          <button
            onClick={() => setShowLandingEditor(true)}
            className="ml-auto shrink-0 rounded-lg bg-gray-900 px-3.5 py-2 text-sm font-medium text-white hover:bg-black"
          >
            Customize page
          </button>
        </div>
      )}

      <ProfileHeader
        broker={broker}
        level={level}
        strength={strength}
        stats={stats}
        isOwn={isOwn}
        onEdit={() => setShowEdit(true)}
      />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <PortfolioGallery
            brokerId={broker.id}
            items={portfolio}
            isOwn={isOwn}
            onChange={loadProfile}
          />

          {broker.bio && (
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <h2 className="mb-2 text-lg font-semibold text-gray-900">
                About
              </h2>
              <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">
                {broker.bio}
              </p>
            </section>
          )}
        </div>

        <div className="space-y-6">
          <AchievementsGrid achievements={achievements} />

          {isOwn && strength < 100 && (
            <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-100">
              <h2 className="mb-3 text-lg font-semibold text-gray-900">
                Complete your profile
              </h2>
              <ul className="space-y-2">
                {checklist.map((c) => (
                  <li
                    key={c.key}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                          c.done
                            ? "bg-[#10B981] text-white"
                            : "bg-gray-100 text-gray-400"
                        }`}
                      >
                        {c.done ? "✓" : ""}
                      </span>
                      <span
                        className={
                          c.done ? "text-gray-400 line-through" : "text-gray-700"
                        }
                      >
                        {c.label}
                      </span>
                    </div>
                    {!c.done && c.href && (
                      <a
                        href={c.href}
                        target={c.key === "help_docs" ? "_blank" : undefined}
                        rel={
                          c.key === "help_docs"
                            ? "noopener noreferrer"
                            : undefined
                        }
                        onClick={
                          c.key === "help_docs" ? markHelpDocsViewed : undefined
                        }
                        className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-[#E85D04] hover:underline"
                      >
                        Go
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setShowEdit(true)}
                className="mt-4 w-full rounded-lg bg-[#E85D04] px-4 py-2 text-sm font-medium text-white hover:bg-[#d35303]"
              >
                Edit profile
              </button>
            </section>
          )}
        </div>
      </div>

      {showEdit && (
        <EditProfileModal
          brokerId={broker.id}
          initial={{
            avatar_url: broker.avatar_url,
            headline: broker.headline,
            bio: broker.bio,
            linkedin_url: broker.linkedin_url,
            specialties: broker.specialties,
            phone: broker.phone,
            profile_slug: broker.profile_slug,
          }}
          onClose={() => setShowEdit(false)}
          onSaved={loadProfile}
        />
      )}

      {showLandingEditor && (
        <LandingPageEditor
          brokerId={broker.id}
          initialConfig={landingConfig}
          initialStatus={landingStatus}
          reviewNote={broker.landing_review_note ?? null}
          profileSlug={broker.profile_slug ?? null}
          onClose={() => setShowLandingEditor(false)}
          onSaved={loadProfile}
        />
      )}
    </div>
  );
}
