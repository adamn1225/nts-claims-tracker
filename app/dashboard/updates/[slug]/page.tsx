"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, Calendar, Tag, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type AppUpdate = {
  id: string;
  title: string;
  slug: string;
  content: string;
  category: string;
  published_at: string;
  author_id: string | null;
};

export default function UpdateDetailPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [update, setUpdate] = useState<AppUpdate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchUpdate();
  }, [slug]);

  const fetchUpdate = async () => {
    const supabase = createClient();

    const { data, error: fetchError } = await supabase
      .from("app_updates")
      .select("*")
      .eq("slug", slug)
      .eq("is_published", true)
      .single();

    if (fetchError || !data) {
      setError("Update not found");
    } else {
      setUpdate(data);
    }

    setLoading(false);
  };

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
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-slate-600">Loading update...</p>
        </div>
      </div>
    );
  }

  if (error || !update) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900">Update Not Found</h1>
          <p className="mt-2 text-slate-600">
            The update you're looking for doesn't exist.
          </p>
          <Link
            href="/dashboard/updates"
            className="mt-4 inline-flex items-center gap-2 text-orange-600 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Updates
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <Link
            href="/dashboard/updates"
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 hover:text-orange-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to All Updates
          </Link>

          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-medium ${getCategoryColor(update.category)}`}
            >
              <Tag className="mr-1 inline-block h-3 w-3" />
              {update.category
                .split("-")
                .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                .join(" ")}
            </span>
            <span className="flex items-center gap-1.5 text-sm text-slate-500">
              <Calendar className="h-4 w-4" />
              {formatDate(update.published_at)}
            </span>
          </div>

          <h1 className="text-3xl font-bold text-slate-900">{update.title}</h1>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl">
          <article className="prose prose-slate max-w-none rounded-lg border border-slate-200 bg-white p-8 shadow-sm prose-headings:text-slate-900 prose-a:text-orange-600">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {update.content}
            </ReactMarkdown>
          </article>
        </div>
      </div>
    </div>
  );
}
