"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Customer, Task } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { useCustomerSearch } from "@/contexts/CustomerSearchContext";
import { getCustomerDisplayName } from "@/lib/customer-utils";
import {
  ChevronLeft,
  ChevronRight,
  Phone,
  Mail,
  MapPin,
  Plus,
  X,
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  LayoutGrid,
  Rows3,
} from "lucide-react";

type ViewMode = "day" | "week" | "month";

type FollowUpType = "call" | "email" | "online_meeting" | "follow_up";

const followUpTypeStyles: Record<FollowUpType, { badge: string; dot: string }> =
  {
    call: {
      badge: "bg-green-50 text-green-800 border-green-200",
      dot: "bg-green-500",
    },
    email: {
      badge: "bg-blue-50 text-blue-800 border-blue-200",
      dot: "bg-blue-500",
    },
    online_meeting: {
      badge: "bg-teal-50 text-teal-800 border-teal-200",
      dot: "bg-teal-500",
    },
    follow_up: {
      badge: "bg-amber-50 text-amber-800 border-amber-200",
      dot: "bg-amber-500",
    },
  };

const formatFollowUpType = (type: FollowUpType) => type.replace("_", " ");

interface CalendarViewProps {
  customers: Customer[];
  onEdit: (customer: Customer) => void;
  onQuickAction: (
    action: "call" | "email" | "schedule" | "notes",
    customer: Customer,
  ) => void;
  onAddTask?: (date: Date) => void;
  onTaskClick?: (task: Task) => void;
}

export default function CalendarView({
  customers,
  onEdit,
  onQuickAction,
  onAddTask,
  onTaskClick,
}: CalendarViewProps) {
  const { searchQuery, statusFilter, sourceFilter } = useCustomerSearch();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [showDateRangeFilter, setShowDateRangeFilter] = useState(false);
  const [dateRangeStart, setDateRangeStart] = useState<string>("");
  const [dateRangeEnd, setDateRangeEnd] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<{
    date: Date;
    customers: Customer[];
    tasks: Task[];
  } | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teamMemberId, setTeamMemberId] = useState<string>("");

  // Fetch tasks for calendar display
  useEffect(() => {
    const fetchTasks = async () => {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setTeamMemberId(user.id);

      // Fetch all tasks (including past ones, but not cancelled)
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("team_member_id", user.id)
        .neq("status", "cancelled")
        .order("due_date", { ascending: true });

      if (error) {
        console.error("Error fetching tasks:", error);
        return;
      }

      setTasks(data || []);
    };

    fetchTasks();
  }, []);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();
    return { daysInMonth, firstDayOfMonth };
  };

  const { daysInMonth, firstDayOfMonth } = getDaysInMonth(currentDate);

  const goToPreviousMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1),
    );
  };

  const goToNextMonth = () => {
    setCurrentDate(
      new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1),
    );
  };

  const goToPreviousWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 7);
    setCurrentDate(newDate);
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 7);
    setCurrentDate(newDate);
  };

  const goToPreviousDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() - 1);
    setCurrentDate(newDate);
  };

  const goToNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + 1);
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const getWeekDays = () => {
    const startOfWeek = new Date(currentDate);
    const day = startOfWeek.getDay();
    startOfWeek.setDate(currentDate.getDate() - day);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      days.push(date);
    }
    return days;
  };

  const getCustomersForDate = (day: number) => {
    const dateToCheck = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day,
    );
    const dateString = dateToCheck.toISOString().split("T")[0];

    return customers.filter((customer) => {
      // Date filter
      if (!customer.next_follow_up_date) return false;
      const followUpDate = new Date(customer.next_follow_up_date);
      if (isNaN(followUpDate.getTime())) return false; // Invalid date
      const followUpDateString = followUpDate.toISOString().split("T")[0];
      if (followUpDateString !== dateString) return false;

      // Status filter
      if (statusFilter.length > 0) {
        if (!statusFilter.some(f => f.toLowerCase() === customer.status.toLowerCase())) {
          return false;
        }
      }

      // Source filter (case-insensitive, trimmed comparison)
      if (sourceFilter.length > 0) {
        if (!customer.import_source) {
          return false;
        }
        const customerSource = customer.import_source.trim().toLowerCase();
        if (!sourceFilter.some(s => s.trim().toLowerCase() === customerSource)) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const searchableText = [
          customer.customer_id,
          customer.business_name,
          getCustomerDisplayName(customer),
          customer.industry,
          customer.city,
          customer.state,
          customer.email,
          customer.phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(query)) {
          return false;
        }
      }

      return true;
    });
  };

  const getCustomersForDateObj = (date: Date) => {
    const dateString = date.toISOString().split("T")[0];

    return customers.filter((customer) => {
      // Date filter
      if (!customer.next_follow_up_date) return false;
      const followUpDate = new Date(customer.next_follow_up_date);
      if (isNaN(followUpDate.getTime())) return false; // Invalid date
      const followUpDateString = followUpDate.toISOString().split("T")[0];
      if (followUpDateString !== dateString) return false;

      // Status filter
      if (statusFilter.length > 0) {
        if (!statusFilter.some(f => f.toLowerCase() === customer.status.toLowerCase())) {
          return false;
        }
      }

      // Source filter (case-insensitive, trimmed comparison)
      if (sourceFilter.length > 0) {
        if (!customer.import_source) {
          return false;
        }
        const customerSource = customer.import_source.trim().toLowerCase();
        if (!sourceFilter.some(s => s.trim().toLowerCase() === customerSource)) {
          return false;
        }
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const searchableText = [
          customer.customer_id,
          customer.business_name,
          getCustomerDisplayName(customer),
          customer.industry,
          customer.city,
          customer.state,
          customer.email,
          customer.phone,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableText.includes(query)) {
          return false;
        }
      }

      return true;
    });
  };

  const getTasksForDate = (day: number) => {
    const dateToCheck = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day,
    );
    const dateString = dateToCheck.toISOString().split("T")[0];

    return tasks.filter((task) => {
      if (!task.due_date) return false;
      const taskDate = new Date(task.due_date);
      if (isNaN(taskDate.getTime())) return false; // Invalid date
      const taskDateString = taskDate.toISOString().split("T")[0];
      return taskDateString === dateString;
    });
  };

  const getTasksForDateObj = (date: Date) => {
    const dateString = date.toISOString().split("T")[0];

    return tasks.filter((task) => {
      if (!task.due_date) return false;
      const taskDate = new Date(task.due_date);
      if (isNaN(taskDate.getTime())) return false; // Invalid date
      const taskDateString = taskDate.toISOString().split("T")[0];
      return taskDateString === dateString;
    });
  };

  const isToday = (day: number) => {
    const today = new Date();
    return (
      today.getDate() === day &&
      today.getMonth() === currentDate.getMonth() &&
      today.getFullYear() === currentDate.getFullYear()
    );
  };

  const isTodayDate = (date: Date) => {
    const today = new Date();
    return (
      today.getDate() === date.getDate() &&
      today.getMonth() === date.getMonth() &&
      today.getFullYear() === date.getFullYear()
    );
  };

  const isPast = (day: number) => {
    const dateToCheck = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day,
    );
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    dateToCheck.setHours(0, 0, 0, 0);
    return dateToCheck < today;
  };

  const isPastDate = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkDate = new Date(date);
    checkDate.setHours(0, 0, 0, 0);
    return checkDate < today;
  };

  const isInDateRange = (day: number) => {
    if (!dateRangeStart && !dateRangeEnd) return true;

    const dateToCheck = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      day,
    );
    const dateString = dateToCheck.toISOString().split("T")[0];

    if (dateRangeStart && dateString < dateRangeStart) return false;
    if (dateRangeEnd && dateString > dateRangeEnd) return false;

    return true;
  };

  const isInDateRangeObj = (date: Date) => {
    if (!dateRangeStart && !dateRangeEnd) return true;

    const dateString = date.toISOString().split("T")[0];

    if (dateRangeStart && dateString < dateRangeStart) return false;
    if (dateRangeEnd && dateString > dateRangeEnd) return false;

    return true;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      prospect: "bg-blue-500",
      active: "bg-green-500",
      won: "bg-amber-500",
      lost: "bg-slate-400",
    };
    return colors[status] || colors.prospect;
  };

  const monthYear = currentDate.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });

  const weekRange = () => {
    const weekDays = getWeekDays();
    const start = weekDays[0];
    const end = weekDays[6];

    if (start.getMonth() === end.getMonth()) {
      return `${start.toLocaleDateString("en-US", { month: "long", day: "numeric" })} - ${end.getDate()}, ${start.getFullYear()}`;
    } else {
      return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - ${end.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${start.getFullYear()}`;
    }
  };

  const dayTitle = currentDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const getTitle = () => {
    if (viewMode === "day") return dayTitle;
    if (viewMode === "week") return weekRange();
    return monthYear;
  };

  const goToPrevious = () => {
    if (viewMode === "day") goToPreviousDay();
    else if (viewMode === "week") goToPreviousWeek();
    else goToPreviousMonth();
  };

  const goToNext = () => {
    if (viewMode === "day") goToNextDay();
    else if (viewMode === "week") goToNextWeek();
    else goToNextMonth();
  };

  const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  // Calculate total days to display (including padding)
  const totalCells = Math.ceil((firstDayOfMonth + daysInMonth) / 7) * 7;
  const calendarDays: (number | null)[] = [];

  for (let i = 0; i < totalCells; i++) {
    if (i < firstDayOfMonth || i >= firstDayOfMonth + daysInMonth) {
      calendarDays.push(null);
    } else {
      calendarDays.push(i - firstDayOfMonth + 1);
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white">
      {/* Calendar Header */}
      <div className="border-b border-slate-200 p-4">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{getTitle()}</h2>

          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex rounded-lg border border-slate-200 bg-white">
              <button
                onClick={() => setViewMode("day")}
                className={`flex h-9 items-center gap-1.5 rounded-l-lg px-3 text-xs font-medium transition-colors ${
                  viewMode === "day"
                    ? "bg-orange-500 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
                title="Day View"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Day</span>
              </button>
              <button
                onClick={() => setViewMode("week")}
                className={`flex h-9 items-center gap-1.5 border-x border-slate-200 px-3 text-xs font-medium transition-colors ${
                  viewMode === "week"
                    ? "bg-orange-500 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
                title="Week View"
              >
                <Rows3 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Week</span>
              </button>
              <button
                onClick={() => setViewMode("month")}
                className={`flex h-9 items-center gap-1.5 rounded-r-lg px-3 text-xs font-medium transition-colors ${
                  viewMode === "month"
                    ? "bg-orange-500 text-white"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
                title="Month View"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Month</span>
              </button>
            </div>

            {/* Navigation */}
            <button
              onClick={(e) => {
                e.preventDefault();
                goToToday();
              }}
              className="flex h-9 items-center justify-center rounded-lg border border-slate-200 px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Today
            </button>
            <button
              onClick={goToPrevious}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50"
              title={`Previous ${viewMode}`}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={goToNext}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50"
              title={`Next ${viewMode}`}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={() => setShowDateRangeFilter(!showDateRangeFilter)}
            className={`text-sm font-medium transition-colors ${
              showDateRangeFilter || dateRangeStart || dateRangeEnd
                ? "text-orange-600"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {dateRangeStart || dateRangeEnd ? "✓ " : ""}Date Range Filter
          </button>

          {(dateRangeStart || dateRangeEnd) && (
            <button
              onClick={() => {
                setDateRangeStart("");
                setDateRangeEnd("");
              }}
              className="text-xs text-slate-600 hover:text-orange-600"
            >
              Clear Filter
            </button>
          )}
        </div>

        {showDateRangeFilter && (
          <div className="mt-3 flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center">
            <div className="flex flex-1 items-center gap-2">
              <label className="text-xs font-medium text-slate-700">
                From:
              </label>
              <input
                type="date"
                value={dateRangeStart}
                onChange={(e) => setDateRangeStart(e.target.value)}
                className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
            <div className="flex flex-1 items-center gap-2">
              <label className="text-xs font-medium text-slate-700">To:</label>
              <input
                type="date"
                value={dateRangeEnd}
                onChange={(e) => setDateRangeEnd(e.target.value)}
                className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Calendar Content - Conditional rendering based on view mode */}
      {viewMode === "month" && (
        <div className="p-4">
          {/* Weekday Headers */}
          <div className="mb-2 grid grid-cols-7 gap-2">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-semibold text-slate-600"
              >
                <span className="hidden sm:inline">{day}</span>
                <span className="sm:hidden">{day.charAt(0)}</span>
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((day, index) => {
              if (day === null) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="h-16 rounded-lg bg-slate-50 sm:h-24"
                  />
                );
              }

              const customersOnDay = getCustomersForDate(day);
              const tasksOnDay = getTasksForDate(day);
              const hasCustomers = customersOnDay.length > 0;
              const hasTasks = tasksOnDay.length > 0;
              const hasContent = hasCustomers || hasTasks;
              const hasOverdue = customersOnDay.some(
                (c) =>
                  c.next_follow_up_date &&
                  new Date(c.next_follow_up_date) < new Date(),
              );

              const dateForTask = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth(),
                day,
              );

              const isPastDate = isPast(day);

              return (
                <div
                  key={day}
                  onClick={() => {
                    if (hasContent) {
                      setSelectedDate({
                        date: dateForTask,
                        customers: customersOnDay,
                        tasks: tasksOnDay,
                      });
                    } else if (onAddTask) {
                      onAddTask(dateForTask);
                    }
                  }}
                  className={`group cursor-pointer relative h-16 w-full rounded-lg border transition-all sm:h-24 ${
                    isToday(day)
                      ? "border-orange-500 bg-orange-50 ring-2 ring-orange-500 ring-opacity-30"
                      : hasOverdue
                        ? "border-red-300 bg-red-50 hover:border-red-400 hover:bg-red-100"
                        : hasContent
                          ? "border-blue-300 bg-blue-50 hover:border-blue-400 hover:bg-blue-100 cursor-pointer"
                          : "border-slate-200 bg-white hover:bg-orange-50 hover:border-orange-300 cursor-pointer"
                  } ${isPastDate && !isToday(day) && hasContent ? "opacity-60" : ""}`}
                  title={
                    hasContent
                      ? `View ${customersOnDay.length} customer${customersOnDay.length > 1 ? "s" : ""} and ${tasksOnDay.length} task${tasksOnDay.length > 1 ? "s" : ""}`
                      : "Click to add task"
                  }
                >
                  {/* Day Number */}
                  <div className="flex items-start justify-between p-1">
                    <div
                      className={`text-xs font-medium sm:text-sm ${
                        isToday(day)
                          ? "text-orange-700"
                          : isPastDate
                            ? "text-slate-400"
                            : "text-slate-700"
                      }`}
                    >
                      {day}
                    </div>
                  </div>

                  {/* Empty Date - Show "Add Task" hint on hover */}
                  {!hasContent && onAddTask && (
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none">
                      <div className="flex flex-col items-center gap-1 text-orange-500">
                        <Plus className="h-6 w-6" />
                        <span className="hidden text-xs font-medium sm:block">
                          Add Task
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Content Indicators - Customers and Tasks */}
                  {hasContent && (
                    <div className="absolute bottom-1 left-1 right-1 space-y-1">
                      {/* Tasks */}
                      {hasTasks && (
                        <div className="space-y-0.5">
                          {tasksOnDay.slice(0, 1).map((task) => (
                            <div
                              key={task.id}
                              className="flex items-center gap-1"
                            >
                              <div className="flex items-center gap-1 truncate rounded bg-slate-700 px-1.5 py-0.5 text-xs font-medium text-white">
                                {task.status === "completed" ? (
                                  <CheckCircle2 className="h-3 w-3 text-green-400" />
                                ) : task.status === "overdue" ? (
                                  <Clock className="h-3 w-3 text-red-400" />
                                ) : (
                                  <Clock className="h-3 w-3" />
                                )}
                                <span className="truncate">
                                  {task.title.length > 8
                                    ? task.title.substring(0, 8) + "..."
                                    : task.title}
                                </span>
                              </div>
                            </div>
                          ))}
                          {tasksOnDay.length > 1 && (
                            <div className="rounded bg-slate-600 px-1.5 py-0.5 text-center text-xs font-medium text-white">
                              +{tasksOnDay.length - 1} task
                              {tasksOnDay.length - 1 > 1 ? "s" : ""}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Customers */}
                      {hasCustomers && (
                        <>
                          {/* Mobile: Show colored dots */}
                          <div className="flex flex-wrap gap-1 sm:hidden">
                            {customersOnDay.slice(0, 4).map((customer) => (
                              <div
                                key={customer.id}
                                className={`h-2 w-2 shrink-0 rounded-full ${
                                  customer.next_follow_up_type
                                    ? followUpTypeStyles[
                                        customer.next_follow_up_type as FollowUpType
                                      ].dot
                                    : getStatusColor(customer.status)
                                }`}
                                title={`${customer.business_name} - ${getCustomerDisplayName(customer)}`}
                              />
                            ))}
                            {customersOnDay.length > 4 && (
                              <div
                                className="flex h-2 items-center text-xs font-medium text-slate-600"
                                title={`${customersOnDay.length - 4} more`}
                              >
                                +{customersOnDay.length - 4}
                              </div>
                            )}
                          </div>
                          {/* Desktop: Show customer names */}
                          <div className="hidden space-y-0.5 sm:block">
                            {customersOnDay
                              .slice(0, hasTasks ? 1 : 2)
                              .map((customer) => (
                                <div
                                  key={customer.id}
                                  className="flex items-center gap-1"
                                >
                                  <div
                                    className={`truncate rounded px-1.5 py-0.5 text-xs font-medium text-white ${getStatusColor(
                                      customer.status,
                                    )}`}
                                    title={`${customer.business_name || "N/A"} - ${getCustomerDisplayName(customer)}`}
                                  >
                                    {(customer.business_name?.length ?? 0) > 10
                                      ? (customer.business_name ?? "").substring(
                                          0,
                                          10,
                                        ) + "..."
                                      : customer.business_name || "N/A"}
                                  </div>
                                  {customer.next_follow_up_type && (
                                    <span
                                      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-semibold ${
                                        followUpTypeStyles[
                                          customer.next_follow_up_type as FollowUpType
                                        ].badge
                                      }`}
                                    >
                                      <span
                                        className={`h-2 w-2 rounded-full ${
                                          followUpTypeStyles[
                                            customer.next_follow_up_type as FollowUpType
                                          ].dot
                                        }`}
                                      />
                                      {formatFollowUpType(
                                        customer.next_follow_up_type as FollowUpType,
                                      )}
                                    </span>
                                  )}
                                </div>
                              ))}
                            {customersOnDay.length > (hasTasks ? 1 : 2) && (
                              <div className="rounded bg-slate-600 px-1.5 py-0.5 text-center text-xs font-medium text-white">
                                +{customersOnDay.length - (hasTasks ? 1 : 2)}{" "}
                                more
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Hover Details (Desktop Only) */}
                  {hasCustomers && (
                    <div className="pointer-events-none absolute left-full top-0 z-10 ml-2 hidden w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-xl opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 lg:block">
                      <div className="mb-2 text-sm font-semibold text-slate-700">
                        Follow-ups on {currentDate.getMonth() + 1}/{day}/
                        {currentDate.getFullYear()}
                      </div>
                      <div className="space-y-2">
                        {customersOnDay.map((customer) => (
                          <Link
                            key={customer.id}
                            href={`/dashboard/customers/${customer.customer_id}`}
                            className="block rounded-lg border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-orange-300 hover:bg-orange-50"
                          >
                            <div className="mb-2">
                              <div className="font-semibold text-slate-900">
                                {customer.business_name}
                              </div>
                              <div className="text-sm text-slate-600">
                                {getCustomerDisplayName(customer)}
                              </div>
                            </div>

                            {customer.next_follow_up_type && (
                              <div
                                className={`mb-2 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${
                                  followUpTypeStyles[
                                    customer.next_follow_up_type as FollowUpType
                                  ].badge
                                }`}
                              >
                                <span
                                  className={`h-2 w-2 rounded-full ${
                                    followUpTypeStyles[
                                      customer.next_follow_up_type as FollowUpType
                                    ].dot
                                  }`}
                                />
                                {formatFollowUpType(
                                  customer.next_follow_up_type as FollowUpType,
                                )}
                              </div>
                            )}

                            {(customer.city || customer.state) && (
                              <div className="mb-2 flex items-center gap-1 text-xs text-slate-500">
                                <MapPin className="h-3 w-3" />
                                {customer.city}
                                {customer.city && customer.state && ", "}
                                {customer.state}
                              </div>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week View */}
      {viewMode === "week" && (
        <div className="overflow-x-auto p-4">
          <div className="grid min-w-175 grid-cols-7 gap-2">
            {getWeekDays().map((date) => {
              const dayCustomers = getCustomersForDateObj(date);
              const dayTasks = getTasksForDateObj(date);
              const inRange = isInDateRangeObj(date);
              const past = isPastDate(date);
              const today = isTodayDate(date);

              if (!inRange) {
                return (
                  <div
                    key={date.toISOString()}
                    className="min-h-32 rounded-lg border border-slate-100 bg-slate-50/30 p-2 opacity-30"
                  >
                    <div className="mb-2 text-center">
                      <div className="text-xs font-semibold text-slate-400">
                        {date.toLocaleDateString("en-US", { weekday: "short" })}
                      </div>
                      <div className="text-lg text-slate-400">
                        {date.getDate()}
                      </div>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={date.toISOString()}
                  className={`min-h-32 rounded-lg border p-2 ${
                    today
                      ? "border-orange-500 bg-orange-50/50 ring-2 ring-orange-500 ring-opacity-20"
                      : dayCustomers.length > 0 || dayTasks.length > 0
                        ? "border-blue-200 bg-blue-50/30"
                        : "border-slate-200 bg-white"
                  } ${past && (dayCustomers.length > 0 || dayTasks.length > 0) ? "opacity-60" : ""}`}
                >
                  <div className="mb-2 text-center">
                    <div
                      className={`text-xs font-semibold ${
                        today ? "text-orange-600" : "text-slate-600"
                      }`}
                    >
                      {date.toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                    <div
                      className={`text-lg font-bold ${
                        today ? "text-orange-600" : "text-slate-900"
                      }`}
                    >
                      {date.getDate()}
                    </div>
                  </div>

                  {dayTasks.length > 0 && (
                    <div className="mb-2 space-y-1">
                      {dayTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-start gap-1 rounded bg-white px-2 py-1 text-[10px]"
                        >
                          {task.status === "completed" ? (
                            <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0 text-green-600" />
                          ) : task.status === "overdue" || isPastDate(date) ? (
                            <Clock className="mt-0.5 h-3 w-3 shrink-0 text-red-600" />
                          ) : (
                            <Clock className="mt-0.5 h-3 w-3 shrink-0 text-blue-600" />
                          )}
                          <span className="line-clamp-2 flex-1">
                            {task.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {dayCustomers.length > 0 && (
                    <div className="space-y-1">
                      {dayCustomers.map((customer) => (
                        <div
                          key={customer.id}
                          className="flex items-center gap-1.5 rounded bg-white px-2 py-1"
                        >
                          <div
                            className={`h-2 w-2 shrink-0 rounded-full ${getStatusColor(customer.status)}`}
                          />
                          <span className="line-clamp-1 flex-1 text-[10px] font-medium text-slate-700">
                            {customer.business_name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {dayCustomers.length === 0 && dayTasks.length === 0 && (
                    <div className="text-center text-xs text-slate-400">
                      No events
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day View */}
      {viewMode === "day" && (
        <div className="p-4">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            {(() => {
              const dayCustomers = getCustomersForDateObj(currentDate);
              const dayTasks = getTasksForDateObj(currentDate);
              const inRange = isInDateRangeObj(currentDate);

              if (!inRange) {
                return (
                  <div className="py-12 text-center text-slate-400">
                    This date is outside the selected range
                  </div>
                );
              }

              return (
                <>
                  {dayTasks.length > 0 && (
                    <div className="mb-6">
                      <h3 className="mb-3 text-sm font-semibold text-slate-900">
                        Tasks ({dayTasks.length})
                      </h3>
                      <div className="space-y-2">
                        {dayTasks.map((task) => (
                          <div
                            key={task.id}
                            className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-orange-300"
                          >
                            {task.status === "completed" ? (
                              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                            ) : task.status === "overdue" ||
                              isPastDate(currentDate) ? (
                              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                            ) : (
                              <Clock className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                            )}
                            <div className="flex-1">
                              <div className="font-medium text-slate-900">
                                {task.title}
                              </div>
                              {task.description && (
                                <div className="mt-1 text-sm text-slate-600">
                                  {task.description}
                                </div>
                              )}
                              {task.due_time && (
                                <div className="mt-1 text-xs text-slate-500">
                                  {task.due_time}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {dayCustomers.length > 0 && (
                    <div>
                      <h3 className="mb-3 text-sm font-semibold text-slate-900">
                        Follow-ups ({dayCustomers.length})
                      </h3>
                      <div className="space-y-2">
                        {dayCustomers.map((customer) => (
                          <div
                            key={customer.id}
                            className="rounded-lg border border-slate-200 bg-white p-3 transition-colors hover:border-orange-300"
                          >
                            <div className="mb-2 flex items-start justify-between">
                              <div className="flex-1">
                                <Link
                                  href={`/dashboard/customers/${customer.customer_id}`}
                                  className="font-medium text-slate-900 hover:text-orange-600"
                                >
                                  {customer.business_name}
                                </Link>
                                <div className="text-sm text-slate-600">
                                  {getCustomerDisplayName(customer)}
                                </div>
                              </div>
                              <span
                                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${
                                  customer.status === "prospect"
                                    ? "border-blue-200 bg-blue-50 text-blue-800"
                                    : customer.status === "active"
                                      ? "border-green-200 bg-green-50 text-green-800"
                                      : customer.status === "won"
                                        ? "border-amber-200 bg-amber-50 text-amber-800"
                                        : "border-slate-200 bg-slate-50 text-slate-600"
                                }`}
                              >
                                {customer.status}
                              </span>
                            </div>

                            {customer.next_follow_up_type && (
                              <div className="mb-2">
                                <span
                                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                                    followUpTypeStyles[
                                      customer.next_follow_up_type as FollowUpType
                                    ].badge
                                  }`}
                                >
                                  <span
                                    className={`h-1.5 w-1.5 rounded-full ${
                                      followUpTypeStyles[
                                        customer.next_follow_up_type as FollowUpType
                                      ].dot
                                    }`}
                                  />
                                  {formatFollowUpType(
                                    customer.next_follow_up_type as FollowUpType,
                                  )}
                                </span>
                              </div>
                            )}

                            <div className="flex gap-2">
                              <button
                                onClick={() => onQuickAction("call", customer)}
                                className="flex flex-1 items-center justify-center gap-2 rounded bg-green-50 px-3 py-2 text-xs font-medium text-green-700 transition-colors hover:bg-green-100"
                              >
                                <Phone className="h-3.5 w-3.5" />
                                Call
                              </button>
                              <button
                                onClick={() => onQuickAction("email", customer)}
                                className="flex flex-1 items-center justify-center gap-2 rounded bg-blue-50 px-3 py-2 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                              >
                                <Mail className="h-3.5 w-3.5" />
                                Email
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {dayCustomers.length === 0 && dayTasks.length === 0 && (
                    <div className="py-12 text-center">
                      <CalendarIcon className="mx-auto mb-3 h-12 w-12 text-slate-300" />
                      <p className="text-slate-600">No events for this day</p>
                      {onAddTask && (
                        <button
                          onClick={() => onAddTask(currentDate)}
                          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
                        >
                          <Plus className="h-4 w-4" />
                          Add Task
                        </button>
                      )}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Mobile Day Details Modal */}
      {selectedDate && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center"
          onClick={() => setSelectedDate(null)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5 text-orange-500" />
                <div>
                  <h3 className="font-semibold text-slate-900">
                    {selectedDate.date.toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {selectedDate.tasks.length} task
                    {selectedDate.tasks.length !== 1 ? "s" : ""} ·{" "}
                    {selectedDate.customers.length} follow-up
                    {selectedDate.customers.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedDate(null)}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-slate-100"
                aria-label="Close"
              >
                <X className="h-5 w-5 text-slate-500" />
              </button>
            </div>

            {/* Modal Content - Scrollable */}
            <div className="max-h-96 overflow-y-auto p-4">
              <div className="space-y-3">
                {/* Tasks Section */}
                {selectedDate.tasks.length > 0 && (
                  <>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Tasks ({selectedDate.tasks.length})
                    </div>
                    {selectedDate.tasks.map((task) => (
                      <div
                        key={task.id}
                        onClick={() => {
                          if (onTaskClick) {
                            onTaskClick(task);
                            setSelectedDate(null);
                          }
                        }}
                        className="block cursor-pointer rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              {task.status === "completed" ? (
                                <CheckCircle2 className="h-4 w-4 text-green-600" />
                              ) : task.status === "overdue" ? (
                                <Clock className="h-4 w-4 text-red-600" />
                              ) : (
                                <Clock className="h-4 w-4 text-slate-400" />
                              )}
                              <span className="font-semibold text-slate-900">
                                {task.title}
                              </span>
                            </div>
                            {task.description && (
                              <p className="text-sm text-slate-600 line-clamp-2">
                                {task.description}
                              </p>
                            )}
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              <span
                                className={`inline-flex items-center rounded-full px-2 py-1 font-medium ${
                                  task.status === "completed"
                                    ? "bg-green-100 text-green-700"
                                    : task.status === "overdue"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {task.status}
                              </span>
                              {task.due_time && (
                                <span className="text-slate-500">
                                  {task.due_time}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Customers Section */}
                {selectedDate.customers.length > 0 && (
                  <>
                    <div className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Customer Follow-Ups ({selectedDate.customers.length})
                    </div>
                    {selectedDate.customers.map((customer) => (
                      <Link
                        key={customer.id}
                        href={`/dashboard/customers/${customer.customer_id}`}
                        onClick={() => setSelectedDate(null)}
                        className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-orange-300 hover:bg-orange-50"
                      >
                        {/* Customer Info */}
                        <div className="mb-3">
                          <div className="font-semibold text-slate-900">
                            {customer.business_name}
                          </div>
                          <p className="text-sm text-slate-600">
                            {getCustomerDisplayName(customer)}
                          </p>
                          {customer.phone && (
                            <p className="text-sm text-slate-500">
                              {customer.phone}
                            </p>
                          )}
                        </div>

                        {customer.next_follow_up_type && (
                          <div
                            className={`mb-3 inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-semibold ${
                              followUpTypeStyles[
                                customer.next_follow_up_type as FollowUpType
                              ].badge
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                followUpTypeStyles[
                                  customer.next_follow_up_type as FollowUpType
                                ].dot
                              }`}
                            />
                            {formatFollowUpType(
                              customer.next_follow_up_type as FollowUpType,
                            )}
                          </div>
                        )}

                        {/* Location & Industry */}
                        <div className="mb-3 space-y-1 text-sm text-slate-600">
                          {customer.industry && (
                            <div className="flex items-center gap-1.5">
                              <div className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                              {customer.industry}
                            </div>
                          )}
                          {(customer.city || customer.state) && (
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-slate-400" />
                              {customer.city}
                              {customer.city && customer.state && ", "}
                              {customer.state}
                            </div>
                          )}
                        </div>

                        {/* Status Badge */}
                        <div className="mb-3">
                          <span
                            className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${
                              customer.status === "prospect"
                                ? "bg-blue-100 text-blue-800"
                                : customer.status === "active"
                                  ? "bg-green-100 text-green-800"
                                  : customer.status === "won"
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-slate-100 text-slate-800"
                            }`}
                          >
                            {customer.status.charAt(0).toUpperCase() +
                              customer.status.slice(1)}
                          </span>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              onQuickAction("call", customer);
                              setSelectedDate(null);
                            }}
                            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-100 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200 active:bg-slate-300"
                          >
                            <Phone className="h-4 w-4" />
                            Call
                          </button>
                          <button
                            onClick={() => {
                              onQuickAction("email", customer);
                              setSelectedDate(null);
                            }}
                            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-orange-500 text-sm font-medium text-white transition-colors hover:bg-orange-600 active:bg-orange-700"
                          >
                            <Mail className="h-4 w-4" />
                            Email
                          </button>
                        </div>
                      </Link>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="border-t border-slate-200 bg-slate-50 p-4">
        <div className="grid grid-cols-2 gap-3 text-xs text-slate-600 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-orange-500"></div>
            <span>Today</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-red-500"></div>
            <span>Overdue Follow-ups</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-blue-500"></div>
            <span>Prospect</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-green-500"></div>
            <span>Active Client</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-amber-500"></div>
            <span>Won</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-green-500"></div>
            <span>Follow-up: Call</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-blue-500"></div>
            <span>Follow-up: Email</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-teal-500"></div>
            <span>Follow-up: Online Meeting</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded bg-amber-500"></div>
            <span>Follow-up: General</span>
          </div>
        </div>
      </div>
    </div>
  );
}
