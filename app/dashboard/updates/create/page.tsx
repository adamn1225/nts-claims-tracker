"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowLeft, AlertCircle } from "lucide-react";

type UpdateForm = {
    title: string;
    excerpt: string;
    content: string;
    category: "feature" | "announcement" | "bug-fix" | "general";
};

export default function CreateUpdatePage() {
    const router = useRouter();
    const supabase = createClient();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [form, setForm] = useState<UpdateForm>({
        title: "",
        excerpt: "",
        content: "",
        category: "feature",
    });

    const generateSlug = (title: string) => {
        return title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            const { data: userData } = await supabase.auth.getUser();
            if (!userData.user) {
                setError("Not authenticated");
                setLoading(false);
                return;
            }

            const slug = generateSlug(form.title);

            const { error: insertError } = await supabase.from("app_updates").insert({
                title: form.title,
                slug,
                excerpt: form.excerpt,
                content: form.content,
                category: form.category,
                author_id: userData.user.id,
                is_published: true,
                published_at: new Date().toISOString(),
            });

            if (insertError) {
                setError(insertError.message);
                setLoading(false);
                return;
            }

            router.push(`/dashboard/updates/${slug}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to create update");
            setLoading(false);
        }
    };

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
                        Back to Updates
                    </Link>
                    <h1 className="text-3xl font-bold text-slate-900">
                        Create New Update
                    </h1>
                    <p className="mt-2 text-slate-600">
                        Share new features, bug fixes, and announcements with your team
                    </p>
                </div>
            </div>

            {/* Form */}
            <div className="px-4 py-8 sm:px-6 lg:px-8">
                <div className="mx-auto max-w-3xl">
                    {error && (
                        <div className="mb-6 flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
                            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
                            <p className="text-sm text-red-700">{error}</p>
                        </div>
                    )}

                    <form
                        onSubmit={handleSubmit}
                        className="space-y-6 rounded-lg border border-slate-200 bg-white p-8 shadow-sm"
                    >
                        {/* Title */}
                        <div>
                            <label htmlFor="title" className="block text-sm font-medium text-slate-900">
                                Title
                            </label>
                            <input
                                id="title"
                                type="text"
                                required
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                placeholder="e.g., New Team Collaboration Feature"
                                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label htmlFor="category" className="block text-sm font-medium text-slate-900">
                                Category
                            </label>
                            <select
                                id="category"
                                value={form.category}
                                onChange={(e) =>
                                    setForm({
                                        ...form,
                                        category: e.target.value as UpdateForm["category"],
                                    })
                                }
                                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                            >
                                <option value="feature">Feature</option>
                                <option value="announcement">Announcement</option>
                                <option value="bug-fix">Bug Fix</option>
                                <option value="general">General</option>
                            </select>
                        </div>

                        {/* Excerpt */}
                        <div>
                            <label htmlFor="excerpt" className="block text-sm font-medium text-slate-900">
                                Excerpt (Short Summary)
                            </label>
                            <textarea
                                id="excerpt"
                                rows={2}
                                value={form.excerpt}
                                onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
                                placeholder="Brief description that appears in the updates list"
                                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                        </div>

                        {/* Content */}
                        <div>
                            <label htmlFor="content" className="block text-sm font-medium text-slate-900">
                                Content (Markdown)
                            </label>
                            <textarea
                                id="content"
                                rows={12}
                                required
                                value={form.content}
                                onChange={(e) => setForm({ ...form, content: e.target.value })}
                                placeholder="Write your update here. Supports Markdown formatting."
                                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-2 font-mono text-sm text-slate-900 placeholder-slate-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                            />
                            <p className="mt-2 text-xs text-slate-500">
                                Supports Markdown: **bold**, *italic*, # headings, - lists, etc.
                            </p>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 justify-end">
                            <Link
                                href="/dashboard/updates"
                                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                            >
                                Cancel
                            </Link>
                            <button
                                type="submit"
                                disabled={loading}
                                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-medium text-white hover:bg-orange-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? "Publishing..." : "Publish Update"}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
