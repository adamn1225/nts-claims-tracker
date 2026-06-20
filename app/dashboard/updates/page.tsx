"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Megaphone, Calendar, Tag, ArrowLeft } from "lucide-react";

type AppUpdate = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  category: string;
  published_at: string;
  author_id: string | null;
};

export default function UpdatesPage() {
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    fetchUpdates();
  }, []);

  const fetchUpdates = async () => {
    const supabase = createClient();

    const { data, error } = await supabase
      .from("app_updates")
      .select("id, title, slug, excerpt, category, published_at, author_id")
      .eq("is_published", true)
      .order("published_at", { ascending: false });

    if (data) {
      setUpdates(data);
    }

    setLoading(false);
  };

  const categories = [
    { value: "all", label: "All Updates" },
    { value: "feature", label: "Features" },
    { value: "announcement", label: "Announcements" },
    { value: "bug-fix", label: "Bug Fixes" },
    { value: "general", label: "General" },
  ];

  const filteredUpdates =
    selectedCategory === "all"
      ? updates
      : updates.filter((u) => u.category === selectedCategory);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      feature: "bg-blue-100 text-blue-800 border-blue-200",
      announcement: "bg-purple-100 text-purple-800 border-purple-200",
      "bug-fix": "bg-green-100 text-green-800 border-green-200",
      general: "bg-slate-100 text-slate-800 border-slate-200",
    };
    return colors[category] || colors.general;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
          <p className="text-sm text-slate-600">Loading updates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/dashboard"
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-orange-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-3">
              <Megaphone className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                App Updates & News
              </h1>
              <p className="text-sm text-slate-600">
                Stay informed about new features and improvements
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="flex flex-wrap gap-2">
            {categories.map((cat) => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  selectedCategory === cat.value
                    ? "bg-orange-500 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Updates List */}
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl space-y-4">
          {filteredUpdates.length > 0 ? (
            filteredUpdates.map((update) => (
              <Link
                key={update.id}
                href={`/dashboard/updates/${update.slug}`}
                className="block rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-orange-300 hover:shadow-md"
              >
                <div className="mb-3 flex items-center gap-3">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-medium ${getCategoryColor(update.category)}`}
                  >
                    <Tag className="mr-1 inline-block h-3 w-3" />
                    {update.category
                      .split("-")
                      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                      .join(" ")}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatDate(update.published_at)}
                  </span>
                </div>
                <h2 className="mb-2 text-xl font-bold text-slate-900 hover:text-orange-600">
                  {update.title}
                </h2>
                {update.excerpt && (
                  <p className="text-sm text-slate-600">{update.excerpt}</p>
                )}
                <div className="mt-3 text-sm font-medium text-orange-600">
                  Read more →
                </div>
              </Link>
            ))
          ) : (
            <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-12 text-center">
              <Megaphone className="mx-auto mb-3 h-12 w-12 text-slate-400" />
              <p className="text-lg font-medium text-slate-600">
                No updates in this category
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Check back later for new announcements
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
