/**
 * TeamMember gamification engine.
 *
 * Pure, dependency-free helpers that turn a team member's real activity into XP,
 * levels, profile strength, and achievements.
 */

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export type TeamMemberProfileFields = {
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  linkedin_url: string | null;
  specialties: string[] | null;
};

/** Extra status flags that aren't stored on the teamMembers row itself. */
export type TeamMemberProfileExtras = {
  gotoConnected: boolean;
  helpDocsViewed: boolean;
};

export type TeamMemberStats = {
  wonCount: number;
  activeCount: number;
  totalCustomers: number;
  tasksCompleted: number;
  portfolioCount: number;
  loadsMoved: number;
  /** Running total of qualifying questions detected across all analyzed calls. */
  qualifyingQuestionsHit: number;
};

// ---------------------------------------------------------------------------
// XP
// ---------------------------------------------------------------------------

const XP_WEIGHTS = {
  won: 150,
  active: 40,
  task: 10,
  portfolio: 60,
  load: 20,
  qualifyingQuestion: 30, // every Q detected on any analyzed call
  completenessStep: 50,   // per completed profile field / integration
} as const;

export function computeXp(
  stats: TeamMemberStats,
  completenessSteps: number,
): number {
  return (
    stats.wonCount * XP_WEIGHTS.won +
    stats.activeCount * XP_WEIGHTS.active +
    stats.tasksCompleted * XP_WEIGHTS.task +
    stats.portfolioCount * XP_WEIGHTS.portfolio +
    stats.loadsMoved * XP_WEIGHTS.load +
    stats.qualifyingQuestionsHit * XP_WEIGHTS.qualifyingQuestion +
    completenessSteps * XP_WEIGHTS.completenessStep
  );
}

// ---------------------------------------------------------------------------
// Levels
// ---------------------------------------------------------------------------

export type LevelTier = {
  level: number;
  title: string;
  min: number;
};

export const LEVELS: LevelTier[] = [
  { level: 1, title: "Rookie TeamMember", min: 0 },
  { level: 2, title: "Dispatch Apprentice", min: 500 },
  { level: 3, title: "Lane Runner", min: 1500 },
  { level: 4, title: "Freight Closer", min: 3500 },
  { level: 5, title: "Heavy Hauler", min: 7000 },
  { level: 6, title: "Lane Master", min: 12000 },
  { level: 7, title: "Freight Legend", min: 20000 },
];

export type LevelProgress = {
  current: LevelTier;
  next: LevelTier | null;
  xp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  percentToNext: number;
};

export function getLevelProgress(xp: number): LevelProgress {
  let current = LEVELS[0];
  for (const tier of LEVELS) {
    if (xp >= tier.min) current = tier;
    else break;
  }
  const next = LEVELS.find((l) => l.level === current.level + 1) ?? null;

  if (!next) {
    return {
      current,
      next: null,
      xp,
      xpIntoLevel: xp - current.min,
      xpForNextLevel: 0,
      percentToNext: 100,
    };
  }

  const span = next.min - current.min;
  const into = xp - current.min;
  return {
    current,
    next,
    xp,
    xpIntoLevel: into,
    xpForNextLevel: span,
    percentToNext: Math.min(100, Math.round((into / span) * 100)),
  };
}

// ---------------------------------------------------------------------------
// Profile strength
// ---------------------------------------------------------------------------

export type ProfileCheck = {
  key: string;
  label: string;
  done: boolean;
  href?: string; // optional link to action
};

export function getProfileChecklist(
  profile: TeamMemberProfileFields,
  portfolioCount: number,
  extras: TeamMemberProfileExtras,
): ProfileCheck[] {
  return [
    {
      key: "avatar",
      label: "Add a profile photo",
      done: !!profile.avatar_url,
    },
    {
      key: "headline",
      label: "Write a headline",
      done: !!profile.headline?.trim(),
    },
    {
      key: "bio",
      label: "Add an about section",
      done: !!profile.bio?.trim(),
    },
    {
      key: "linkedin",
      label: "Link your LinkedIn",
      done: !!profile.linkedin_url?.trim(),
    },
    {
      key: "specialties",
      label: "List your specialties",
      done: !!(profile.specialties && profile.specialties.length > 0),
    },
    {
      key: "portfolio",
      label: "Upload 3+ freight photos",
      done: portfolioCount >= 3,
    },
    {
      key: "goto",
      label: "Connect GoTo (click-to-call)",
      done: extras.gotoConnected,
      href: "/dashboard/settings#goto-integration",
    },
    {
      key: "help_docs",
      label: "Explore the help docs",
      done: extras.helpDocsViewed,
      href: "/dashboard/help",
    },
  ];
}

export function getProfileStrength(checklist: ProfileCheck[]): number {
  const done = checklist.filter((c) => c.done).length;
  return Math.round((done / checklist.length) * 100);
}

/** Completed profile fields — drives XP bonus. */
export function getCompletenessSteps(
  profile: TeamMemberProfileFields,
  extras: TeamMemberProfileExtras,
): number {
  return [
    profile.avatar_url,
    profile.headline?.trim(),
    profile.bio?.trim(),
    profile.linkedin_url?.trim(),
    profile.specialties && profile.specialties.length > 0 ? "x" : "",
    extras.gotoConnected ? "x" : "",
    extras.helpDocsViewed ? "x" : "",
  ].filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// Achievements  (ordered easy → hard within each tier)
// ---------------------------------------------------------------------------

export type AchievementTier = "bronze" | "silver" | "gold";

export type Achievement = {
  id: string;
  name: string;
  description: string;
  icon: string;
  tier: AchievementTier;
  earned: boolean;
};

export function getAchievements(
  stats: TeamMemberStats,
  profile: TeamMemberProfileFields,
  extras: TeamMemberProfileExtras,
  profileStrength: number,
): Achievement[] {
  return [
    // ── Bronze: easy wins ──────────────────────────────────────────────────
    {
      id: "welcome",
      name: "Welcome Aboard",
      description: "You're on the team",
      icon: "Handshake",
      tier: "bronze",
      earned: true, // always earned
    },
    {
      id: "face-of-team",
      name: "Face of the Team",
      description: "Upload a profile photo",
      icon: "Camera",
      tier: "bronze",
      earned: !!profile.avatar_url,
    },
    {
      id: "elevator-pitch",
      name: "Elevator Pitch",
      description: "Write a headline",
      icon: "MessageSquare",
      tier: "bronze",
      earned: !!profile.headline?.trim(),
    },
    {
      id: "connected",
      name: "Networked",
      description: "Link your LinkedIn",
      icon: "Linkedin",
      tier: "bronze",
      earned: !!profile.linkedin_url?.trim(),
    },
    {
      id: "power-caller",
      name: "Power Caller",
      description: "Connect GoTo",
      icon: "PhoneOutgoing",
      tier: "bronze",
      earned: extras.gotoConnected,
    },
    {
      id: "knowledge-seeker",
      name: "Knowledge Seeker",
      description: "Explore the help docs",
      icon: "BookOpen",
      tier: "bronze",
      earned: extras.helpDocsViewed,
    },
    {
      id: "shutterbug",
      name: "Shutterbug",
      description: "Upload your first freight photo",
      icon: "Images",
      tier: "bronze",
      earned: stats.portfolioCount >= 1,
    },
    {
      id: "first-win",
      name: "First Win",
      description: "Close your first deal",
      icon: "Trophy",
      tier: "bronze",
      earned: stats.wonCount >= 1,
    },
    // ── Silver ────────────────────────────────────────────────────────────
    {
      id: "call-quality-starter",
      name: "Call Quality",
      description: "Ask 25 qualifying questions",
      icon: "PhoneCall",
      tier: "silver",
      earned: stats.qualifyingQuestionsHit >= 25,
    },
    {
      id: "closer",
      name: "Closer",
      description: "Win 10 customers",
      icon: "TrendingUp",
      tier: "silver",
      earned: stats.wonCount >= 10,
    },
    {
      id: "portfolio-builder",
      name: "Portfolio Builder",
      description: "Upload 5+ freight photos",
      icon: "LayoutGrid",
      tier: "silver",
      earned: stats.portfolioCount >= 5,
    },
    {
      id: "task-master",
      name: "Task Master",
      description: "Complete 100 follow-up tasks",
      icon: "CheckCircle2",
      tier: "silver",
      earned: stats.tasksCompleted >= 100,
    },
    // ── Gold ──────────────────────────────────────────────────────────────
    {
      id: "call-coach",
      name: "Call Coach",
      description: "Ask 100 qualifying questions",
      icon: "Headphones",
      tier: "gold",
      earned: stats.qualifyingQuestionsHit >= 100,
    },
    {
      id: "rainmaker",
      name: "Rainmaker",
      description: "Win 50 customers",
      icon: "CloudRain",
      tier: "gold",
      earned: stats.wonCount >= 50,
    },
    {
      id: "road-warrior",
      name: "Road Warrior",
      description: "Move 100 loads",
      icon: "Truck",
      tier: "gold",
      earned: stats.loadsMoved >= 100,
    },
    {
      id: "big-book",
      name: "Big Book",
      description: "Build a book of 100 customers",
      icon: "BookOpen",
      tier: "gold",
      earned: stats.totalCustomers >= 100,
    },
    {
      id: "all-star",
      name: "Profile Complete",
      description: "Fill out every section of your profile",
      icon: "Star",
      tier: "gold",
      earned: profileStrength >= 100,
    },
  ];
}

// ---------------------------------------------------------------------------
// Handle helpers (teamMember email -> URL handle)
// ---------------------------------------------------------------------------

/**
 * Derives a URL handle from a team member's email address.
 * e.g. "noah.smith@ntsconnect.com" → "noah.smith"
 */
export function teamMemberHandle(email: string): string {
  return email.split("@")[0].toLowerCase();
}

/** @deprecated */
export function teamMemberSlug(
  firstName: string | null,
  lastName: string | null,
): string {
  return [firstName, lastName]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

