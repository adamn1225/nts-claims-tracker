"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useTeamMemberView } from "@/contexts/TeamMemberViewContext";
import type { Customer, Task } from "@/lib/types";
import { getCustomerDisplayName } from "@/lib/customer-utils";
import {
  TrendingUp,
  TrendingDown,
  Users,
  Building2,
  ListTodo,
  AlertCircle,
  Calendar,
  Phone,
  Mail,
  Clock,
  CheckCircle2,
  Megaphone,
  X,
  Plus,
  ArrowUpRight,
  Star,
  FolderOpen,
  FileText,
  LayoutGrid,
} from "lucide-react";

/**
 * KPI Card Component
 * Reusable metric display with status indicator
 */
function KPICard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  status = "neutral",
  href,
}: {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ElementType;
  trend?: {
    value: string;
    direction: "up" | "down";
    isPositive: boolean;
  };
  status?: "healthy" | "warning" | "critical" | "neutral";
  href?: string;
}) {
  const statusColors = {
    healthy: "text-emerald-600 bg-emerald-50",
    warning: "text-amber-600 bg-amber-50",
    critical: "text-rose-600 bg-rose-50",
    neutral: "text-slate-600 bg-slate-50",
  };

  const statusIconColors = {
    healthy: "text-emerald-500",
    warning: "text-amber-500",
    critical: "text-rose-500",
    neutral: "text-slate-500",
  };

  const CardWrapper = href ? "a" : "div";
  const cardProps = href
    ? { href, className: "block transition-shadow hover:shadow-lg" }
    : {};

  return (
    <CardWrapper {...cardProps}>
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className={`rounded-lg p-2 ${statusColors[status]}`}>
            <Icon className={`h-6 w-6 ${statusIconColors[status]}`} />
          </div>
          {trend && (
            <div
              className={`flex items-center text-sm ${trend.isPositive ? "text-emerald-600" : "text-rose-600"}`}
            >
              {trend.direction === "up" ? (
                <TrendingUp className="mr-1 h-4 w-4" />
              ) : (
                <TrendingDown className="mr-1 h-4 w-4" />
              )}
              <span className="font-medium">{trend.value}</span>
            </div>
          )}
        </div>
        <div className="mt-4">
          <p className="text-sm font-medium text-slate-600">{title}</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">{value}</p>
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        </div>
      </div>
    </CardWrapper>
  );
}

/**
 * KpiTile — compact, accent-striped metric tile used in the dashboard hero.
 * Color accent is driven by claim-stage semantics from the design system.
 */
function KpiTile({
  accent,
  label,
  value,
  sub,
  icon: Icon,
  href,
  badge,
}: {
  accent: "info" | "warning" | "danger" | "primary" | "success" | "neutral";
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  href: string;
  badge?: string;
}) {
  const accentMap: Record<string, { bar: string; wash: string; icon: string }> = {
    info: { bar: "bg-info", wash: "bg-info/5", icon: "text-info-text" },
    warning: { bar: "bg-warning", wash: "bg-warning/5", icon: "text-warning-text" },
    danger: { bar: "bg-danger", wash: "bg-danger/5", icon: "text-danger" },
    primary: { bar: "bg-primary", wash: "bg-primary/5", icon: "text-primary-text" },
    success: { bar: "bg-success", wash: "bg-success/5", icon: "text-success" },
    neutral: { bar: "bg-slate-300", wash: "bg-white", icon: "text-slate-600" },
  };
  const c = accentMap[accent];

  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-xl border border-slate-200 ${c.wash} p-4 transition-all hover:border-slate-300 hover:shadow-md`}
    >
      {/* Left accent stripe */}
      <span className={`absolute left-0 top-0 h-full w-1 ${c.bar}`} />
      <div className="flex items-start justify-between">
        <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200/70">
          <Icon className={`h-4 w-4 ${c.icon}`} />
        </div>
        <ArrowUpRight className="h-4 w-4 text-slate-300 transition-all group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-slate-500" />
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-2xl font-bold tabular-nums text-slate-900">{value}</p>
        {badge && (
          <span className="rounded-full bg-danger px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
            {badge}
          </span>
        )}
      </div>
      <p className="mt-0.5 text-xs font-semibold text-slate-700">{label}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{sub}</p>
    </Link>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return "Working late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Working late";
}

/**
 * Recent Activity Card
 */
function ActivityItem({
  icon: Icon,
  title,
  subtitle,
  time,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  time: string;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-0">
      <div className="rounded-lg bg-slate-100 p-2">
        <Icon className="h-4 w-4 text-slate-600" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">{title}</p>
        <p className="text-xs text-slate-600">{subtitle}</p>
      </div>
      <span className="text-xs text-slate-500">{time}</span>
    </div>
  );
}

/**
 * App Updates Widget
 * Shows recent announcements/updates
 */
function AppUpdatesWidget() {
  const [updates, setUpdates] = useState<Array<{
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    category: string;
    published_at: string;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUpdates = async () => {
      const supabase = createClient();

      const { data } = await supabase
        .from("app_updates")
        .select("id, title, slug, excerpt, category, published_at")
        .eq("is_published", true)
        .order("published_at", { ascending: false })
        .limit(2);

      if (data) {
        setUpdates(data);
      }

      setLoading(false);
    };

    fetchUpdates();
  }, []);

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      feature: "bg-blue-600",
      announcement: "bg-purple-600",
      "bug-fix": "bg-green-600",
      general: "bg-slate-600",
    };
    return colors[category] || colors.general;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-900">App Updates</h2>
        </div>
        <div className="flex items-center justify-center py-8">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Megaphone className="h-4 w-4 text-primary" />
          App Updates
        </h2>
        <Link
          href="/dashboard/updates"
          className="text-xs text-primary-text hover:underline"
        >
          View all
        </Link>
      </div>
      <div className="space-y-2">
        {updates.length > 0 ? (
          updates.map((update) => (
            <Link
              key={update.id}
              href={`/dashboard/updates/${update.slug}`}
              className="block rounded-lg border border-slate-200 p-3 transition-all hover:border-primary/60 hover:bg-primary/5"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <span
                  className={`h-1.5 w-1.5 shrink-0 rounded-full ${getCategoryColor(update.category)}`}
                />
                <span className="text-xs text-slate-500">
                  {formatTimeAgo(update.published_at)}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-900 line-clamp-2">
                {update.title}
              </p>
              {update.excerpt && (
                <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                  {update.excerpt}
                </p>
              )}
            </Link>
          ))
        ) : (
          <p className="py-4 text-center text-sm text-slate-500">
            No updates available
          </p>
        )}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { viewingTeamMember, loading: teamMemberLoading } = useTeamMemberView();
  const [teamMemberId, setTeamMemberId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [showOverdueAlert, setShowOverdueAlert] = useState(true);
  const [metrics, setMetrics] = useState({
    totalCustomers: 0,
    activeClients: 0,
    prospects: 0,
    wonThisMonth: 0,
    tasksToday: 0,
    overdueTasks: 0,
    followUpsThisWeek: 0,
    pinnedCustomers: 0,
  });
  const [recentActivity, setRecentActivity] = useState<
    Array<{
      icon: React.ElementType;
      title: string;
      subtitle: string;
      time: string;
    }>
  >([]);
  const [pinnedCustomers, setPinnedCustomers] = useState<Customer[]>([]);
  const [weeklyTasks, setWeeklyTasks] = useState<Record<string, number>>({
    Monday: 0,
    Tuesday: 0,
    Wednesday: 0,
    Thursday: 0,
    Friday: 0,
  });

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (teamMemberLoading || !viewingTeamMember) return;

      setTeamMemberId(viewingTeamMember.id);

      // Fetch all data in parallel
      await Promise.all([
        fetchMetrics(viewingTeamMember.id),
        fetchRecentActivity(viewingTeamMember.id),
        fetchPinnedCustomers(viewingTeamMember.id),
        fetchWeeklyTasks(viewingTeamMember.id),
      ]);

      setIsLoading(false);
    };

    fetchDashboardData();
  }, [viewingTeamMember, teamMemberLoading]);

  const fetchMetrics = async (userId: string) => {
    const supabase = createClient();

    // Get all customers
    const { data: allCustomers } = await supabase
      .from("customers")
      .select("id, status, is_pinned, created_at")
      .eq("team_member_id", userId);

    const totalCustomers = allCustomers?.length || 0;
    const activeClients =
      allCustomers?.filter((c) => c.status === "active").length || 0;
    const prospects =
      allCustomers?.filter((c) => c.status === "prospect").length || 0;
    const pinnedCustomers =
      allCustomers?.filter((c) => c.is_pinned).length || 0;

    // Won this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const wonThisMonth =
      allCustomers?.filter((c) => {
        return c.status === "won" && new Date(c.created_at) >= startOfMonth;
      }).length || 0;

    // Get all tasks
    const { data: allTasks } = await supabase
      .from("tasks")
      .select("id, due_date, due_time, status")
      .eq("team_member_id", userId);

    const today = new Date().toISOString().split("T")[0];
    const now = new Date();

    const tasksToday =
      allTasks?.filter(
        (t) =>
          t.due_date === today &&
          t.status !== "completed" &&
          t.status !== "cancelled",
      ).length || 0;

    const overdueTasks =
      allTasks?.filter((t) => {
        if (t.status === "completed" || t.status === "cancelled") return false;
        const dueDate = new Date(t.due_date);
        if (t.due_time) {
          const [hours, minutes] = t.due_time.split(":");
          dueDate.setHours(parseInt(hours), parseInt(minutes));
        }
        return dueDate < now;
      }).length || 0;

    // Follow-ups this week
    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 7);

    const followUpsThisWeek =
      allTasks?.filter((t) => {
        const taskDate = new Date(t.due_date);
        return (
          taskDate >= startOfWeek &&
          taskDate < endOfWeek &&
          t.status !== "completed" &&
          t.status !== "cancelled"
        );
      }).length || 0;

    setMetrics({
      totalCustomers,
      activeClients,
      prospects,
      wonThisMonth,
      tasksToday,
      overdueTasks,
      followUpsThisWeek,
      pinnedCustomers,
    });
  };

  const fetchRecentActivity = async (userId: string) => {
    const supabase = createClient();

    const { data: contactLogs } = await supabase
      .from("contact_log")
      .select(
        `
        *,
        customer:customers(business_name, contact_name)
      `,
      )
      .eq("team_member_id", userId)
      .order("contact_date", { ascending: false })
      .limit(3);

    if (contactLogs) {
      const activities = contactLogs.map((log: any) => {
        const getIcon = () => {
          switch (log.type) {
            case "call":
              return Phone;
            case "email":
              return Mail;
            case "meeting":
              return Calendar;
            case "quote":
              return CheckCircle2;
            default:
              return Clock;
          }
        };

        const getTimeAgo = (dateString: string) => {
          const date = new Date(dateString);
          const now = new Date();
          const diffMs = now.getTime() - date.getTime();
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

          if (diffHours < 24) return `${diffHours}h ago`;
          if (diffDays === 1) return "1d ago";
          return `${diffDays}d ago`;
        };

        const customer = Array.isArray(log.customer)
          ? log.customer[0]
          : log.customer;

        return {
          icon: getIcon(),
          title:
            log.subject ||
            `${log.type.charAt(0).toUpperCase() + log.type.slice(1)} with ${customer?.business_name || "customer"}`,
          subtitle: log.notes || (customer ? getCustomerDisplayName(customer) : ""),
          time: getTimeAgo(log.contact_date),
        };
      });

      setRecentActivity(activities);
    }
  };

  const fetchPinnedCustomers = async (userId: string) => {
    const supabase = createClient();

    const { data } = await supabase
      .from("customers")
      .select("*")
      .eq("team_member_id", userId)
      .eq("is_pinned", true)
      .order("pin_order", { ascending: true })
      .limit(3);

    if (data) {
      setPinnedCustomers(data);
    }
  };

  const fetchWeeklyTasks = async (userId: string) => {
    const supabase = createClient();

    const now = new Date();
    const startOfWeek = new Date();
    startOfWeek.setDate(now.getDate() - now.getDay() + 1); // Monday
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 5); // Friday

    const { data: tasks } = await supabase
      .from("tasks")
      .select("due_date, status")
      .eq("team_member_id", userId)
      .gte("due_date", startOfWeek.toISOString().split("T")[0])
      .lte("due_date", endOfWeek.toISOString().split("T")[0])
      .neq("status", "cancelled");

    const tasksByDay: Record<string, number> = {
      Monday: 0,
      Tuesday: 0,
      Wednesday: 0,
      Thursday: 0,
      Friday: 0,
    };

    tasks?.forEach((task) => {
      const taskDate = new Date(task.due_date);
      const dayOfWeek = taskDate.getDay();
      const dayNames = [
        "Sunday",
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ];
      const dayName = dayNames[dayOfWeek];

      if (dayName in tasksByDay) {
        tasksByDay[dayName]++;
      }
    });

    setWeeklyTasks(tasksByDay);
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
          <p className="text-sm text-slate-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-canvas-grid">
      {/* Hero — greeting + claim-stage-tinted KPI tiles */}
      <div className="relative overflow-hidden border-b border-slate-200 bg-linear-to-br from-white via-slate-50 to-white">
        {/* subtle brand accent in the top-right corner */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-primary/5 blur-3xl" />
        <div className="pointer-events-none absolute -right-10 -bottom-20 h-40 w-40 rounded-full bg-accent/5 blur-3xl" />

        <div className="relative px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-text">
                {getGreeting()} · {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                {viewingTeamMember?.first_name
                  ? `Welcome back, ${viewingTeamMember.first_name}`
                  : "Claims Dashboard"}
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                {metrics.overdueTasks > 0
                  ? `${metrics.overdueTasks} ${metrics.overdueTasks === 1 ? "task is" : "tasks are"} overdue — jump in below.`
                  : "All follow-ups on schedule. Nice work."}
              </p>
            </div>
            <div className="flex items-center gap-2 self-start lg:self-auto">
              <Link
                href="/dashboard/customers/kanban"
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-400 hover:bg-slate-50"
              >
                <LayoutGrid className="h-4 w-4" />
                Claims Board
              </Link>
              <Link
                href="/dashboard/customers?action=new"
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-primary-text hover:shadow-md"
              >
                <Plus className="h-4 w-4" />
                Open new claim
              </Link>
            </div>
          </div>

          {/* Accent-striped KPI tiles */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile
              accent="info"
              label="Open Claims"
              value={metrics.totalCustomers}
              sub="Across every stage"
              icon={FolderOpen}
              href="/dashboard/customers/kanban"
            />
            <KpiTile
              accent={metrics.overdueTasks > 0 ? "danger" : "success"}
              label="Tasks Today"
              value={metrics.tasksToday}
              sub={
                metrics.overdueTasks > 0
                  ? `${metrics.overdueTasks} overdue`
                  : "On track"
              }
              icon={ListTodo}
              href="/dashboard/tasks?filter=today"
              badge={metrics.overdueTasks > 0 ? "!" : undefined}
            />
            <KpiTile
              accent="warning"
              label="This Week"
              value={metrics.followUpsThisWeek}
              sub="Upcoming follow-ups"
              icon={Calendar}
              href="/dashboard/tasks"
            />
            <KpiTile
              accent="primary"
              label="Pinned"
              value={metrics.pinnedCustomers}
              sub="Watched claims"
              icon={Star}
              href="/dashboard/customers"
            />
          </div>
        </div>
      </div>

      {/* Main Content - Compact Grid Layout */}
      <div className="grid gap-3 p-3 sm:gap-4 sm:p-4 lg:grid-cols-12 lg:p-4">
        {/* Critical Alert - Full Width if Exists */}
        {metrics.overdueTasks > 0 && showOverdueAlert && (
          <div className="lg:col-span-12">
            <div className="flex flex-col gap-3 rounded-lg border-2 border-danger/40 bg-danger/5 p-4 shadow-sm sm:flex-row sm:items-center sm:gap-4">
              <AlertCircle className="h-6 w-6 shrink-0 text-danger" />
              <div className="flex-1">
                <h3 className="font-semibold text-danger">
                  {metrics.overdueTasks} Overdue {metrics.overdueTasks === 1 ? "Task" : "Tasks"} Need Attention
                </h3>
                <p className="text-sm text-danger/80">
                  These follow-ups are past due and should be addressed immediately
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/tasks?filter=overdue"
                  className="shrink-0 rounded-lg bg-danger px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-danger/90"
                >
                  View Now
                </Link>
                <button
                  onClick={() => setShowOverdueAlert(false)}
                  className="shrink-0 rounded-lg p-2 text-danger transition-colors hover:bg-danger/10"
                  title="Dismiss alert"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions — claim-flavored shortcuts */}
        <div className="lg:col-span-8">
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">
              Quick Actions
            </h2>
            <div className="grid gap-2 sm:grid-cols-3">
              <Link
                href="/dashboard/customers?action=new"
                className="group flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition-all hover:border-primary hover:bg-primary/5 hover:shadow-sm"
              >
                <div className="rounded-lg bg-primary/10 p-2 ring-1 ring-primary/15 transition-all group-hover:bg-primary group-hover:ring-primary">
                  <Plus className="h-4 w-4 text-primary-text transition-colors group-hover:text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">New Claim</p>
                  <p className="truncate text-xs text-slate-600">Open a claim file</p>
                </div>
              </Link>
              <Link
                href="/dashboard/tasks?action=new"
                className="group flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition-all hover:border-accent hover:bg-accent/5 hover:shadow-sm"
              >
                <div className="rounded-lg bg-accent/10 p-2 ring-1 ring-accent/15 transition-all group-hover:bg-accent group-hover:ring-accent">
                  <FileText className="h-4 w-4 text-accent transition-colors group-hover:text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">Log Correspondence</p>
                  <p className="truncate text-xs text-slate-600">Call, email, or note</p>
                </div>
              </Link>
              <Link
                href="/dashboard/customers/calendar"
                className="group flex items-center gap-3 rounded-lg border border-slate-200 p-3 transition-all hover:border-warning hover:bg-warning/5 hover:shadow-sm"
              >
                <div className="rounded-lg bg-warning/10 p-2 ring-1 ring-warning/15 transition-all group-hover:bg-warning group-hover:ring-warning">
                  <Calendar className="h-4 w-4 text-warning-text transition-colors group-hover:text-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900">Deadlines</p>
                  <p className="truncate text-xs text-slate-600">View schedule</p>
                </div>
              </Link>
            </div>
          </div>

         {/* Recent Activity - Compact */}
          <div className="mt-4 rounded-lg border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Clock className="h-4 w-4 text-slate-400" />
                Recent Activity
              </h2>
              {recentActivity.length > 0 && (
                <Link
                  href="/dashboard/customers"
                  className="text-xs text-primary-text hover:underline"
                >
                  View all
                </Link>
              )}
            </div>
            <div className="p-4">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <ActivityItem key={index} {...activity} />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-linear-to-br from-accent/10 to-primary/10 ring-1 ring-slate-200/60">
                    <Mail className="h-5 w-5 text-slate-500" />
                  </div>
                  <p className="text-sm font-semibold text-slate-900">
                    No activity yet
                  </p>
                  <p className="mt-1 max-w-xs text-xs text-slate-500">
                    Calls, emails, and notes you log on a claim will appear here so the whole team stays in the loop.
                  </p>
                  <Link
                    href="/dashboard/customers?action=new"
                    className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:border-primary hover:text-primary-text"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Open your first claim
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Compact */}
        <div className="space-y-3 lg:col-span-4">
          {/* App Updates Widget - Moved to top */}
          <AppUpdatesWidget />

          {/* This Week - Visual */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">This Week</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {metrics.followUpsThisWeek} tasks
              </span>
            </div>
            <div className="space-y-2">
              {Object.entries(weeklyTasks).map(([day, count]) => (
                <div key={day} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 transition-colors hover:bg-slate-50">
                  <span className="text-sm text-slate-700">{day}</span>
                  <span className={`text-sm font-semibold ${
                    count > 0 ? "text-primary-text" : "text-slate-400"
                  }`}>
                    {count}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pinned Customers - Compact */}
          <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">
                Pinned Claims
              </h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                {metrics.pinnedCustomers}
              </span>
            </div>
            <div className="space-y-2">
              {pinnedCustomers.length > 0 ? (
                pinnedCustomers.map((customer) => (
                  <Link
                    key={customer.id}
                    href={`/dashboard/customers?id=${customer.id}`}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 transition-all hover:border-primary/60 hover:bg-primary/5"
                  >
                    <div className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">
                        {customer.business_name}
                      </p>
                      <p className="truncate text-xs text-slate-600">
                        {getCustomerDisplayName(customer) || "No contact"}
                      </p>
                    </div>
                  </Link>
                ))
              ) : (
                <p className="py-2 text-center text-sm text-slate-500">
                  No pinned claims
                </p>
              )}
              <Link
                href="/dashboard/customers"
                className="block pt-2 text-center text-xs text-primary-text hover:underline"
              >
                View all claims →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
