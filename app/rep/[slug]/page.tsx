import { createClient } from "@/lib/supabase/server";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  MapPin,
  Phone,
  Linkedin,
  Mail,
  Images,
  Quote,
  Truck,
} from "lucide-react";
import ContactForm from "./ContactForm";
import { coerceLandingConfig, getBrand } from "@/lib/landing";

type Props = { params: Promise<{ slug: string }> };

function initials(first: string | null, last: string | null) {
  return `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase() || "NT";
}

export default async function PublicBrokerPage({ params }: Props) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: broker } = await supabase
    .from("public_broker_pages")
    .select(
      "id, first_name, last_name, office_location, avatar_url, headline, bio, linkedin_url, specialties, phone, profile_slug, landing_config_approved, landing_status",
    )
    .eq("profile_slug", slug)
    .single();

  if (!broker) notFound();

  // Only an admin-approved config is shown publicly.
  const brokerRow = broker as typeof broker & {
    landing_config_approved?: unknown;
    landing_status?: string | null;
  };
  const config = coerceLandingConfig(
    brokerRow.landing_status === "approved"
      ? brokerRow.landing_config_approved
      : null,
  );
  const brand = getBrand(config.brand);
  const visibleBlocks = config.blocks.filter((b) => b.visible);
  const tagline = config.tagline?.trim() || brand.defaultTagline;

  // Fetch portfolio photos
  const { data: portfolio } = await supabase
    .from("broker_portfolio")
    .select("id, image_path, caption, equipment_type, origin, destination")
    .eq("broker_id", broker.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  const portfolioItems = (portfolio ?? []) as {
    id: string;
    image_path: string;
    caption: string | null;
    equipment_type: string | null;
    origin: string | null;
    destination: string | null;
  }[];

  const BUCKET = "broker-portfolio";
  function getPublicUrl(path: string) {
    return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  const fullName =
    [broker.first_name, broker.last_name].filter(Boolean).join(" ") || "Agent";

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-[#1A1A1A] py-3 text-center">
        <span className="text-sm font-semibold text-white tracking-wide">
          {brand.name}
        </span>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-10">
        {/* Profile card */}
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
          {/* Banner */}
          <div className={`h-24 ${brand.bannerClass}`} />

          <div className="px-6 pb-6 pt-0">
            {/* Avatar */}
            <div className="-mt-10 mb-4">
              <div className="relative h-20 w-20 overflow-hidden rounded-2xl ring-4 ring-white">
                {broker.avatar_url ? (
                  <Image
                    src={broker.avatar_url}
                    alt={fullName}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <div
                    className="flex h-full w-full items-center justify-center text-2xl font-bold text-white"
                    style={{
                      backgroundImage: `linear-gradient(to bottom right, ${brand.primary}, ${brand.accent})`,
                    }}
                  >
                    {initials(broker.first_name, broker.last_name)}
                  </div>
                )}
              </div>
            </div>

            <h1 className="text-2xl font-bold text-gray-900">{fullName}</h1>

            {broker.headline && (
              <p className="mt-1 text-gray-600">{broker.headline}</p>
            )}

            <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-500">
              {broker.office_location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-4 w-4" style={{ color: brand.primary }} />
                  {broker.office_location}
                </span>
              )}
              {broker.phone && (
                <a
                  href={`tel:${broker.phone}`}
                  className="inline-flex items-center gap-1 font-medium hover:underline"
                  style={{ color: brand.primary }}
                >
                  <Phone className="h-4 w-4" />
                  {broker.phone}
                </a>
              )}
              {broker.linkedin_url && (
                <a
                  href={broker.linkedin_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-medium text-[#0A66C2] hover:underline"
                >
                  <Linkedin className="h-4 w-4" />
                  LinkedIn
                </a>
              )}
            </div>

            {broker.specialties && broker.specialties.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {broker.specialties.map((s: string) => (
                  <span
                    key={s}
                    className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}

            {broker.bio && (
              <p className="mt-5 whitespace-pre-line text-sm leading-relaxed text-gray-600 border-t border-gray-100 pt-5">
                {broker.bio}
              </p>
            )}
          </div>
        </div>

        {/* Custom content blocks (admin-approved) */}
        {visibleBlocks.map((block) => {
          if (block.type === "bio" && block.data.text.trim()) {
            return (
              <div
                key={block.id}
                className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
              >
                <h2 className="mb-3 text-lg font-bold text-gray-900">
                  {block.data.heading}
                </h2>
                <p className="whitespace-pre-line text-sm leading-relaxed text-gray-600">
                  {block.data.text}
                </p>
              </div>
            );
          }

          if (block.type === "services") {
            const items = block.data.items.filter((i) => i.label.trim());
            if (items.length === 0) return null;
            return (
              <div
                key={block.id}
                className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
              >
                <div className="mb-4 flex items-center gap-2">
                  <Truck className="h-5 w-5" style={{ color: brand.primary }} />
                  <h2 className="text-lg font-bold text-gray-900">
                    {block.data.heading}
                  </h2>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {items.map((item, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-gray-100 bg-gray-50/60 p-3"
                    >
                      <p
                        className="text-sm font-semibold"
                        style={{ color: brand.primaryDark }}
                      >
                        {item.label}
                      </p>
                      {item.description.trim() && (
                        <p className="mt-0.5 text-xs text-gray-500">
                          {item.description}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (block.type === "testimonials") {
            const items = block.data.items.filter((i) => i.quote.trim());
            if (items.length === 0) return null;
            return (
              <div
                key={block.id}
                className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100"
              >
                <div className="mb-4 flex items-center gap-2">
                  <Quote className="h-5 w-5" style={{ color: brand.primary }} />
                  <h2 className="text-lg font-bold text-gray-900">
                    {block.data.heading}
                  </h2>
                </div>
                <div className="space-y-4">
                  {items.map((item, i) => (
                    <figure
                      key={i}
                      className="rounded-xl border-l-4 bg-gray-50/60 p-4"
                      style={{ borderColor: brand.primary }}
                    >
                      <blockquote className="text-sm italic leading-relaxed text-gray-700">
                        “{item.quote}”
                      </blockquote>
                      {(item.name.trim() || item.company.trim()) && (
                        <figcaption className="mt-2 text-xs font-medium text-gray-500">
                          {[item.name, item.company]
                            .filter((x) => x.trim())
                            .join(", ")}
                        </figcaption>
                      )}
                    </figure>
                  ))}
                </div>
              </div>
            );
          }

          return null;
        })}

        {/* Portfolio */}
        {portfolioItems.length > 0 && (
          <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
            <div className="mb-4 flex items-center gap-2">
              <Images className="h-5 w-5" style={{ color: brand.primary }} />
              <h2 className="text-lg font-bold text-gray-900">Freight Portfolio</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {portfolioItems.map((item) => (
                <div key={item.id} className="group relative overflow-hidden rounded-xl bg-gray-100">
                  <div className="relative aspect-4/3 w-full">
                    <Image
                      src={getPublicUrl(item.image_path)}
                      alt={item.caption ?? item.equipment_type ?? "Freight photo"}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      className="object-cover transition group-hover:scale-105"
                    />
                  </div>
                  {(item.caption || item.equipment_type || (item.origin && item.destination)) && (
                    <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent p-2">
                      {item.caption && (
                        <p className="text-xs font-medium text-white">{item.caption}</p>
                      )}
                      {!item.caption && item.equipment_type && (
                        <p className="text-xs font-medium text-white">{item.equipment_type}</p>
                      )}
                      {item.origin && item.destination && (
                        <p className="text-[10px] text-white/80">{item.origin} → {item.destination}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tagline + contact form */}
        <div className="mt-6 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <p
            className="mb-1 text-center text-base font-semibold"
            style={{ color: brand.primaryDark }}
          >
            {tagline}
          </p>
          <div className="mb-5 flex items-center justify-center gap-2">
            <Mail className="h-5 w-5" style={{ color: brand.primary }} />
            <h2 className="text-lg font-bold text-gray-900">
              Request a freight quote
            </h2>
          </div>
          <ContactForm brokerId={broker.id} brokerName={fullName} />
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          Powered by{" "}
          <span className="font-medium text-gray-500">{brand.name}</span>
        </p>
      </div>
    </div>
  );
}
