/**
 * Central application configuration for the Claims Tracker starter template.
 *
 * This is the single source of truth for branding, terminology, the industry
 * list, and feature toggles. Rebrand an install for a new industry by editing
 * THIS FILE ONLY — no component changes required.
 *
 * Anything that used to be hardcoded ("NTS", "broker", "carrier", orange
 * #E85D04, etc.) should read from here instead.
 */

export interface AppConfig {
  /** Branding shown across the app, emails, and the maintenance screen. */
  brand: {
    /** Product name, e.g. "Acme Claims Tracker". */
    name: string;
    /** Short name for tight spaces (nav, mobile). */
    shortName: string;
    /** Company/organization that owns the install. */
    company: string;
    /** Tagline shown on auth/landing. */
    tagline: string;
    /** Path (under /public) to the logo. */
    logoSrc: string;
    /** Support contact surfaced in help/footers. */
    supportEmail: string;
  };

  /**
   * Theme colors. These also feed the Tailwind theme (see app/globals.css).
   * Replace the hex values to recolor the whole app.
   */
  theme: {
    primary: string; // main brand color (buttons, active states)
    primaryDark: string; // hover/pressed
    accent: string; // highlights
    secondary: string; // dark neutral
    success: string;
    warning: string;
    danger: string;
  };

  /**
   * Display terminology. Internal code identifiers and DB tables intentionally
   * stay as `customer`/`broker` for stability; these are the *labels* users
   * see. Change these to suit the industry (Clients, Patients, Accounts, etc.).
   */
  terms: {
    contact: { singular: string; plural: string }; // the people/orgs you sell to
    user: { singular: string; plural: string }; // your internal team members
    /** Kanban pipeline stage labels (left → right). */
    pipelineStages: string[];
  };

  /**
   * The industry/category options for a contact. Generic by default; swap for
   * your vertical (e.g. clinics, law firms, dealerships).
   */
  industries: string[];

  /**
   * How often you typically follow up with a contact. Replaces the freight
   * "shipping frequency" with a neutral contact cadence.
   */
  contactFrequencies: string[];

  /** Toggle optional integrations/features on or off per install. */
  features: {
    /** GoTo Connect calling/recording integration. */
    goto: boolean;
    /** AI assistant widget + AI routes. */
    ai: boolean;
    /** AI call-quality coaching (requires goto + ai). */
    callCoaching: boolean;
    /** Microsoft SSO sign-in. */
    microsoftSso: boolean;
    /** Maintenance mode + activity heatmap (admin). */
    maintenanceMode: boolean;
    /** Chrome extension companion. */
    chromeExtension: boolean;
    /** Email notifications via SendGrid. */
    emailNotifications: boolean;
  };
}

export const appConfig: AppConfig = {
  brand: {
    name: "Claims Tracker",
    shortName: "Tracker",
    company: "Your Company",
    tagline: "Customer follow-ups, tasks, and pipeline in one place.",
    logoSrc: "/logo.svg",
    supportEmail: "support@example.com",
  },

  theme: {
    primary: "#2563EB", // neutral blue (was NTS orange) — change per brand
    primaryDark: "#1D4ED8",
    accent: "#60A5FA",
    secondary: "#1A1A1A",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
  },

  terms: {
    contact: { singular: "Contact", plural: "Contacts" },
    user: { singular: "User", plural: "Users" },
    pipelineStages: ["Inbox", "Prospect", "Active", "Won", "Lost"],
  },

  industries: [
    "Technology",
    "Healthcare",
    "Finance",
    "Retail",
    "Manufacturing",
    "Real Estate",
    "Education",
    "Hospitality",
    "Construction",
    "Professional Services",
    "Other",
  ],

  contactFrequencies: [
    "Multiple per week",
    "Weekly",
    "Bi-weekly",
    "Monthly",
    "Quarterly",
    "Yearly",
  ],

  features: {
    goto: false,
    ai: true,
    callCoaching: false,
    microsoftSso: true,
    maintenanceMode: true,
    chromeExtension: true,
    emailNotifications: true,
  },
};

// Convenience helpers so call sites stay terse.
export const t = appConfig.terms;
export const brand = appConfig.brand;
export const features = appConfig.features;
