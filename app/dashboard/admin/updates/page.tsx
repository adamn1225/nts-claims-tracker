"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import {
  Megaphone,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Save,
  X,
} from "lucide-react";

type AppUpdate = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  category: string;
  published_at: string;
  is_published: boolean;
};

export default function AdminUpdatesPage() {
  const router = useRouter();
  const [updates, setUpdates] = useState<AppUpdate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    content: "",
    excerpt: "",
    category: "general",
    is_published: true,
  });

  useEffect(() => {
    checkAdminAccess();
    fetchUpdates();
  }, []);

  const checkAdminAccess = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      router.push("/auth/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      router.push("/dashboard");
    }
  };

  const fetchUpdates = async () => {
    const supabase = createClient();

    const { data } = await supabase
      .from("app_updates")
      .select("*")
      .order("published_at", { ascending: false });

    if (data) {
      setUpdates(data);
    }

    setLoading(false);
  };

  const generateSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  };

  const handleTitleChange = (title: string) => {
    setFormData({
      ...formData,
      title,
      slug: generateSlug(title),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return;

    if (editingId) {
      // Update existing
      await supabase
        .from("app_updates")
        .update(formData)
        .eq("id", editingId);
    } else {
      // Create new
      await supabase.from("app_updates").insert({
        ...formData,
        author_id: user.id,
      });
    }

    resetForm();
    fetchUpdates();
  };

  const handleEdit = (update: AppUpdate) => {
    setFormData({
      title: update.title,
      slug: update.slug,
      content: update.content,
      excerpt: update.excerpt || "",
      category: update.category,
      is_published: update.is_published,
    });
    setEditingId(update.id);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this update?")) return;

    const supabase = createClient();
    await supabase.from("app_updates").delete().eq("id", id);

    fetchUpdates();
  };

  const togglePublished = async (id: string, currentStatus: boolean) => {
    const supabase = createClient();
    await supabase
      .from("app_updates")
      .update({ is_published: !currentStatus })
      .eq("id", id);

    fetchUpdates();
  };

  const resetForm = () => {
    setFormData({
      title: "",
      slug: "",
      content: "",
      excerpt: "",
      category: "general",
      is_published: true,
    });
    setEditingId(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-orange-500 border-t-transparent"></div>
          <p className="text-sm text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-orange-100 p-3">
              <Megaphone className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Manage App Updates
              </h1>
              <p className="text-sm text-slate-600">
                Create and manage announcements for users
              </p>
            </div>
          </div>
          {!showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
            >
              <Plus className="h-4 w-4" />
              New Update
            </button>
          )}
        </div>
      </div>

      <div className="px-4 py-8 sm:px-6 lg:px-8">
        {/* Form */}
        {showForm && (
          <div className="mb-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                {editingId ? "Edit Update" : "New Update"}
              </h2>
              <button
                onClick={resetForm}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Title
                </label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Announcing new features..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Slug (auto-generated)
                </label>
                <input
                  type="text"
                  required
                  value={formData.slug}
                  onChange={(e) =>
                    setFormData({ ...formData, slug: e.target.value })
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="announcing-new-features"
                />
                <p className="mt-1 text-xs text-slate-500">
                  URL: /dashboard/updates/{formData.slug || "your-slug"}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Excerpt (short summary)
                </label>
                <textarea
                  value={formData.excerpt}
                  onChange={(e) =>
                    setFormData({ ...formData, excerpt: e.target.value })
                  }
                  rows={2}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="Brief summary shown in lists..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Content (Markdown supported)
                </label>
                <textarea
                  required
                  value={formData.content}
                  onChange={(e) =>
                    setFormData({ ...formData, content: e.target.value })
                  }
                  rows={12}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 font-mono text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  placeholder="# Heading&#10;&#10;Content with **bold** and *italic*..."
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="general">General</option>
                    <option value="feature">Feature</option>
                    <option value="announcement">Announcement</option>
                    <option value="bug-fix">Bug Fix</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Status
                  </label>
                  <select
                    value={formData.is_published ? "published" : "draft"}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        is_published: e.target.value === "published",
                      })
                    }
                    className="mt-1 w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="published">Published</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex items-center gap-2 rounded-lg bg-orange-500 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
                >
                  <Save className="h-4 w-4" />
                  {editingId ? "Update" : "Create"} Update
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-300 px-6 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Updates List */}
        <div className="space-y-4">
          {updates.map((update) => (
            <div
              key={update.id}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="mb-2 flex items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-900">
                      {update.title}
                    </h3>
                    {!update.is_published && (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                        Draft
                      </span>
                    )}
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {update.category}
                    </span>
                  </div>
                  {update.excerpt && (
                    <p className="text-sm text-slate-600">{update.excerpt}</p>
                  )}
                  <p className="mt-2 text-xs text-slate-500">
                    Published: {new Date(update.published_at).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => togglePublished(update.id, update.is_published)}
                    className="rounded-lg border border-slate-300 p-2 text-slate-600 transition-colors hover:bg-slate-50"
                    title={update.is_published ? "Unpublish" : "Publish"}
                  >
                    {update.is_published ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(update)}
                    className="rounded-lg border border-slate-300 p-2 text-blue-600 transition-colors hover:bg-blue-50"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(update.id)}
                    className="rounded-lg border border-slate-300 p-2 text-red-600 transition-colors hover:bg-red-50"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {updates.length === 0 && (
            <div className="rounded-lg border-2 border-dashed border-slate-300 bg-white p-12 text-center">
              <Megaphone className="mx-auto mb-3 h-12 w-12 text-slate-400" />
              <p className="text-lg font-medium text-slate-600">
                No updates yet
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Create your first announcement to get started
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
