// Shared landing-page CMS model for teamMember public pages (/rep/[slug]).
//
// This module is framework-agnostic (no React, no Supabase) so it can be
// imported from both server components and client components.

export type LandingBrandId = "nts" | "heavy_haulers";

export type LandingBrand = {
  id: LandingBrandId;
  name: string;
  /** Short marketing line used as the default tagline for the brand. */
  defaultTagline: string;
  primary: string;
  primaryDark: string;
  accent: string;
  dark: string;
  /**
   * Full, static Tailwind gradient class for the profile banner. Must be a
   * literal string so the Tailwind JIT compiler can see the arbitrary values.
   */
  bannerClass: string;
};

// NOTE: keep bannerClass values as complete literal strings — do not build
// them dynamically or Tailwind will not generate the arbitrary color utilities.
export const LANDING_BRANDS: Record<LandingBrandId, LandingBrand> = {
  nts: {
    id: "nts",
    name: "Nationwide Transport Services",
    defaultTagline: "Your freight, moved with confidence.",
    primary: "#E85D04",
    primaryDark: "#d35303",
    accent: "#FFA726",
    dark: "#1A1A1A",
    bannerClass: "bg-linear-to-r from-[#1A1A1A] via-[#E85D04] to-[#FFA726]",
  },
  heavy_haulers: {
    id: "heavy_haulers",
    name: "Heavy Haulers",
    defaultTagline: "Heavy haul specialists you can count on.",
    primary: "#C8941A",
    primaryDark: "#a87a12",
    accent: "#F5C842",
    dark: "#1A1A1A",
    bannerClass: "bg-linear-to-r from-[#1A1A1A] via-[#C8941A] to-[#F5C842]",
  },
};

export const DEFAULT_BRAND: LandingBrandId = "nts";

export const LANDING_BRAND_LIST: LandingBrand[] = Object.values(LANDING_BRANDS);

export function getBrand(id: string | null | undefined): LandingBrand {
  if (id && id in LANDING_BRANDS) {
    return LANDING_BRANDS[id as LandingBrandId];
  }
  return LANDING_BRANDS[DEFAULT_BRAND];
}

// --- Content blocks -------------------------------------------------------

export type LandingBlockType = "bio" | "testimonials" | "services";

export type Testimonial = { quote: string; name: string; company: string };
export type ServiceItem = { label: string; description: string };

export type BioBlock = {
  id: string;
  type: "bio";
  visible: boolean;
  data: { heading: string; text: string };
};

export type TestimonialsBlock = {
  id: string;
  type: "testimonials";
  visible: boolean;
  data: { heading: string; items: Testimonial[] };
};

export type ServicesBlock = {
  id: string;
  type: "services";
  visible: boolean;
  data: { heading: string; items: ServiceItem[] };
};

export type LandingBlock = BioBlock | TestimonialsBlock | ServicesBlock;

export type LandingConfig = {
  brand: LandingBrandId;
  tagline: string;
  blocks: LandingBlock[];
};

export const BLOCK_LABELS: Record<LandingBlockType, string> = {
  bio: "About me",
  testimonials: "Customer testimonials",
  services: "Services I offer",
};

export const BLOCK_DESCRIPTIONS: Record<LandingBlockType, string> = {
  bio: "A longer, personal introduction in your own words.",
  testimonials: "Quotes from happy customers to build trust.",
  services: "Highlight the equipment types and lanes you specialize in.",
};

export const ADDABLE_BLOCK_TYPES: LandingBlockType[] = [
  "bio",
  "services",
  "testimonials",
];

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createBlock(type: LandingBlockType): LandingBlock {
  switch (type) {
    case "bio":
      return {
        id: newId(),
        type: "bio",
        visible: true,
        data: { heading: "About me", text: "" },
      };
    case "testimonials":
      return {
        id: newId(),
        type: "testimonials",
        visible: true,
        data: {
          heading: "What customers say",
          items: [{ quote: "", name: "", company: "" }],
        },
      };
    case "services":
      return {
        id: newId(),
        type: "services",
        visible: true,
        data: {
          heading: "What I haul",
          items: [{ label: "", description: "" }],
        },
      };
  }
}

export function emptyLandingConfig(): LandingConfig {
  return { brand: DEFAULT_BRAND, tagline: "", blocks: [] };
}

// --- Validation / coercion from raw JSONB --------------------------------

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asBool(v: unknown, fallback = true): boolean {
  return typeof v === "boolean" ? v : fallback;
}

/**
 * Safely turn an untyped JSONB value from the database into a LandingConfig.
 * Unknown block types and malformed fields are dropped so the renderer always
 * receives a well-formed structure.
 */
export function coerceLandingConfig(raw: unknown): LandingConfig {
  if (!raw || typeof raw !== "object") return emptyLandingConfig();
  const obj = raw as Record<string, unknown>;

  const brand: LandingBrandId =
    obj.brand === "heavy_haulers" || obj.brand === "nts"
      ? obj.brand
      : DEFAULT_BRAND;

  const tagline = asString(obj.tagline);

  const rawBlocks = Array.isArray(obj.blocks) ? obj.blocks : [];
  const blocks: LandingBlock[] = [];

  for (const rb of rawBlocks) {
    if (!rb || typeof rb !== "object") continue;
    const b = rb as Record<string, unknown>;
    const id = asString(b.id) || newId();
    const visible = asBool(b.visible, true);
    const data = (b.data && typeof b.data === "object" ? b.data : {}) as Record<
      string,
      unknown
    >;

    if (b.type === "bio") {
      blocks.push({
        id,
        type: "bio",
        visible,
        data: {
          heading: asString(data.heading, "About me"),
          text: asString(data.text),
        },
      });
    } else if (b.type === "testimonials") {
      const items = Array.isArray(data.items) ? data.items : [];
      blocks.push({
        id,
        type: "testimonials",
        visible,
        data: {
          heading: asString(data.heading, "What customers say"),
          items: items.map((it) => {
            const t = (it && typeof it === "object" ? it : {}) as Record<
              string,
              unknown
            >;
            return {
              quote: asString(t.quote),
              name: asString(t.name),
              company: asString(t.company),
            };
          }),
        },
      });
    } else if (b.type === "services") {
      const items = Array.isArray(data.items) ? data.items : [];
      blocks.push({
        id,
        type: "services",
        visible,
        data: {
          heading: asString(data.heading, "What I haul"),
          items: items.map((it) => {
            const s = (it && typeof it === "object" ? it : {}) as Record<
              string,
              unknown
            >;
            return {
              label: asString(s.label),
              description: asString(s.description),
            };
          }),
        },
      });
    }
  }

  return { brand, tagline, blocks };
}

export const LANDING_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  pending: "Pending review",
  approved: "Live",
  rejected: "Changes requested",
};
