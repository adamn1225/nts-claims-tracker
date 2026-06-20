"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  Book,
  Users,
  Upload,
  CheckSquare,
  Calendar,
  Bell,
  Settings,
  Search,
  Plus,
  Pin,
  Edit,
  Trash2,
  Phone,
  Mail,
  MessageSquare,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
  Video,
  TrendingUp,
  Target,
  RefreshCw,
  Lightbulb,
  ExternalLink,
  PlayCircle,
  Key,
  Code,
  Lock,
} from "lucide-react";

interface HelpSection {
  id: string;
  title: string;
  icon: React.ReactNode;
  content: {
    subtitle: string;
    steps?: string[];
    tips?: string[];
    description?: string;
  }[];
}

const helpSections: HelpSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: <Book className="h-5 w-5" />,
    content: [
      {
        subtitle: "Welcome to NTS Claims Tracker",
        description:
          "This CRM helps you manage customer relationships, track tasks, and never miss a follow-up. It's designed specifically for freight brokers and sales teams.",
      },
      {
        subtitle: "Dashboard Overview",
        steps: [
          "Left sidebar: Navigate between Customers, Tasks, Calendar, and Settings",
          "Customers has 3 views: Kanban (focused), List (all contacts), Calendar",
          "Kanban Board - Your focused workspace for active deals",
          "List View - ALL contacts, searchable database",
          "Top search bar: Quickly find any customer by name, email, or phone",
          "Notification bell: View overdue tasks and reminders",
          "Feedback button: Send us your thoughts and suggestions",
        ],
      },
      {
        subtitle: "Your First Steps",
        steps: [
          "Add your first customer using the '+ New Customer' button",
          "It appears in List View - click green Kanban icon to add to board",
          "Create a follow-up task for that customer",
          "Set up your notification preferences in Settings",
          "Explore the two customer views (List = all, Kanban = focused)",
        ],
      },
    ],
  },
  {
    id: "customers",
    title: "Managing Customers",
    icon: <Users className="h-5 w-5" />,
    content: [
      {
        subtitle: "Understanding the Two Views",
        description:
          "The CRM has two main views for managing contacts:",
        steps: [
          "List View - Shows ALL your contacts in a searchable table",
          "Kanban Board - Your FOCUSED workspace for active deals",
          "New customers start in List View only",
          "Add customers to Kanban Board to focus on them",
          "Remove from board when done to keep it clean",
        ],
        tips: [
          "Think of List View as your contact database",
          "Think of Kanban as your active work-in-progress board",
          "Keep 10-20 contacts max on the board for best focus",
        ],
      },
      {
        subtitle: "Adding a New Customer",
        steps: [
          "Click '+ New Customer' button (orange button at top)",
          "Fill in required fields: Business Name, Contact Name",
          "Add contact details: Phone and Email (at least one required)",
          "Select Industry to categorize the customer",
          "Choose Status: Prospect, Active Client, Won, or Lost",
          "Set Shipping Frequency to estimate potential business",
          "Add Social Media links to stay connected",
          "Click 'Add Customer' to save",
        ],
        tips: [
          "New customers appear in List View only",
          "Use TMS References to link to your existing TMS system",
          "The Customer ID (NS-XXXX) is automatically generated",
        ],
      },
      {
        subtitle: "List View - Your Customer Database",
        steps: [
          "Click 'List View' tab to see ALL customers in a table",
          "Sort by clicking column headers (Name, Status, Frequency, etc.)",
          "Use search bar to filter customers instantly",
          "Click green Kanban icon (📊) to add customer to your board",
          "Click customer name/ID to view full profile",
        ],
        tips: [
          "This is where ALL your contacts live",
          "Import bulk contacts from CSV - they start here",
          "Add high-priority contacts to Kanban for focused work",
        ],
      },
      {
        subtitle: "Kanban Board - Your Focused Workspace",
        steps: [
          "Only shows contacts YOU added from List View",
          "Drag and drop cards between columns to change status",
          "Pin important customers to keep them at the top",
          "Click X button (on hover) to remove from board",
          "Use quick actions: 📞 Call, ✉️ Email, 📝 Notes",
          "Removing from board doesn't delete - returns to List",
        ],
        tips: [
          "Keep board clean - only active deals you're working NOW",
          "10-20 contacts max keeps you focused",
          "When deal is done (won/lost), remove from board",
          "Search for contacts in List View when board is cluttered",
        ],
      },
      {
        subtitle: "Customer Profile Page",
        steps: [
          "Click customer name or ID to open their profile",
          "View all contact information and notes",
          "See complete interaction history",
          "Access social media links directly",
          "Edit customer details using the 'Edit' button",
        ],
      },
    ],
  },
  {
    id: "importing-customers",
    title: "Importing Customers",
    icon: <Upload className="h-5 w-5" />,
    content: [
      {
        subtitle: "Import Overview",
        description:
          "Use the Import page to upload a CSV or Excel file of customers instead of entering each contact manually. Imported customers are added to your customer list and can be reviewed before they are worked on from the Kanban board.",
      },
      {
        subtitle: "Preparing Your File",
        steps: [
          "Go to the Import page from the dashboard navigation",
          "Click 'Download Template' if you want an example file to start from",
          "Include useful customer details such as business name, contact name, phone, email, industry, city, state, shipping frequency, website, LinkedIn, and notes",
          "Save the file as CSV, XLSX, or XLS before uploading",
        ],
        tips: [
          "Business name or contact name is required for each imported row",
          "Clean column names make the automatic matching step easier",
          "You can skip columns you do not want to import",
        ],
      },
      {
        subtitle: "Uploading and Matching Columns",
        steps: [
          "Drag your file into the upload box, or click the box to browse your computer",
          "Review the auto-matched columns on the mapping screen",
          "Use the dropdown beside each spreadsheet column to choose where that data should go in SalesTrack",
          "Choose 'Skip this column' for any column you do not need",
          "Click 'Continue to Review' when the mapping looks correct",
        ],
      },
      {
        subtitle: "Reviewing and Importing",
        steps: [
          "Review the preview table to confirm the first few rows look correct",
          "Click 'Back to Mapping' if anything needs to be adjusted",
          "Click 'Import Customers' when you are ready",
          "After the import finishes, SalesTrack will show how many customers were imported, skipped, or had errors",
        ],
      },
      {
        subtitle: "Where Imported Customers Go",
        description:
          "Imported customers are added to your customer list with an import source label. On the Kanban board, use the Inbox area to review imported customers, filter by import source, clean up details, and move the right contacts into the correct sales stage when ready.",
        tips: [
          "The Inbox keeps large imports separate from your active working board",
          "Use the import source filter to focus on one uploaded list at a time",
          "Review imported customers before moving them into active sales columns",
        ],
      },
    ],
  },
  {
    id: "tasks",
    title: "Task Management",
    icon: <CheckSquare className="h-5 w-5" />,
    content: [
      {
        subtitle: "Creating a Task",
        steps: [
          "Click '+ New Task' button on Tasks page",
          "Choose an Action Type (this is a Quick Template)",
          "The template will auto-fill title, description, and priority",
          "Select a customer (optional for general reminders)",
          "Set Due Date and optionally Due Time",
          "Choose Priority: Urgent, High, Medium, or Low",
          "Set Reminder Days (when to get notified before due date)",
          "Click 'Add Task' to save",
        ],
      },
      {
        subtitle: "Quick Task Templates",
        description:
          "Save time with pre-built task templates that auto-fill details:",
        steps: [
          "Decision Day - Customer's deadline to decide on your proposal",
          "Price Check In - Provide a quote to the customer",
          "Rate Re-Evaluation - Review and update existing pricing",
          "Reactivate Past Customer - Re-engage inactive customers",
          "LinkedIn Connection - Send connection request",
          "LinkedIn Message - Follow up via LinkedIn",
          "Video Shoutout - Record personal video message",
          "Service Feedback - Check on recent shipment quality",
        ],
        tips: [
          "Templates automatically set the right priority level",
          "You can edit any auto-filled field before saving",
          "Templates only auto-fill for NEW tasks, not when editing",
        ],
      },
      {
        subtitle: "Managing Tasks",
        steps: [
          "View tasks by filter: All, Today, Overdue, Upcoming",
          "Click checkmark ✓ to mark task as completed",
          "Click edit icon ✏️ to modify task details",
          "Click trash icon 🗑️ to archive (cancel) task",
          "Overdue tasks turn red and show days overdue",
        ],
        tips: [
          "Overdue tasks generate DAILY notifications until completed",
          "Use 'Same Day' reminder for tasks due today",
          "Combine multiple reminder days for important tasks",
        ],
      },
    ],
  },
  {
    id: "calendar",
    title: "Calendar & Follow-Ups",
    icon: <Calendar className="h-5 w-5" />,
    content: [
      {
        subtitle: "Using the Calendar",
        steps: [
          "View all tasks and follow-ups in calendar format",
          "Click on a date to see tasks due that day",
          "Different colors represent different task types",
          "Click on a task to view or edit details",
        ],
      },
      {
        subtitle: "Scheduling Follow-Ups",
        steps: [
          "Create a task and link it to a customer",
          "Set a specific due date for the follow-up",
          "Choose the follow-up type: Call, Email, Meeting, etc.",
          "The customer card will show the next follow-up date",
          "Calendar view will display the scheduled follow-up",
        ],
        tips: [
          "Set follow-ups based on shipping frequency",
          "Weekly shippers should be contacted every 1-2 weeks",
          "Monthly shippers need follow-up every 2-4 weeks",
          "Use 'Reactivation' template for customers you haven't contacted in 60+ days",
        ],
      },
    ],
  },
  {
    id: "notifications",
    title: "Notifications & Reminders",
    icon: <Bell className="h-5 w-5" />,
    content: [
      {
        subtitle: "How Notifications Work",
        steps: [
          "Overdue tasks create DAILY notifications until completed",
          "Notifications appear in the bell icon (top right)",
          "Red pulsing badge shows unread notification count",
          "Click bell to open notification panel",
          "Mark notifications as read by clicking them",
        ],
      },
      {
        subtitle: "Email Notifications (Optional)",
        steps: [
          "Go to Settings page",
          "Toggle 'Email Notifications' ON",
          "Select which events trigger emails",
          "Emails send in addition to in-app notifications",
        ],
        tips: [
          "Enable email for critical reminders you can't afford to miss",
          "Check spam folder if emails aren't arriving",
          "Disable email notifications if they're overwhelming",
        ],
      },
      {
        subtitle: "Managing Notification Overload",
        tips: [
          "Complete or archive old tasks to stop daily reminders",
          "Adjust task due dates if priorities change",
          "Use priority levels to focus on what matters most",
          "Mark non-critical notifications as read to clear them",
        ],
      },
    ],
  },
  {
    id: "tips",
    title: "Tips & Best Practices",
    icon: <Lightbulb className="h-5 w-5" />,
    content: [
      {
        subtitle: "For New Brokers",
        tips: [
          "Start by adding all your current customers (they go to List View)",
          "Classify them by status (Prospect vs Active)",
          "Add your top 10-15 active deals to Kanban Board",
          "Set follow-up tasks for each one based on shipping frequency",
          "Pin your most urgent deals on the Kanban board",
          "Use List View search to quickly find anyone",
        ],
      },
      {
        subtitle: "Daily Workflow",
        steps: [
          "Check Notifications first thing (overdue tasks)",
          "Review Kanban Board - your focused workspace for today",
          "Complete or reschedule overdue tasks",
          "Add notes after each customer interaction",
          "Schedule follow-ups immediately after calls",
          "Remove completed deals from Kanban to keep it clean",
          "Add new hot prospects to Kanban from List View",
          "End day by planning tomorrow's priorities",
        ],
      },
      {
        subtitle: "Winning More Business",
        tips: [
          "Keep active proposals on your Kanban Board",
          "Set Decision Day tasks for every proposal sent",
          "Follow up 1-2 days before Decision Day",
          "Use Video Shoutouts to stand out from competition",
          "Connect on LinkedIn with all prospects",
          "Track service feedback after each shipment",
          "Reactivate old customers quarterly (find them in List View)",
          "Set reminders based on shipping patterns",
        ],
      },
      {
        subtitle: "Keyboard Shortcuts",
        steps: [
          "Ctrl+S or ⌘S - Save form (in modals)",
          "Esc - Close modal or panel",
          "Use global search instead of clicking through menus",
        ],
      },
      {
        subtitle: "Keep Your Kanban Board Clean",
        tips: [
          "Only add contacts you're ACTIVELY working on",
          "Remove deals when won/lost - they stay in List View",
          "Import bulk contacts to List View, add best ones to Board",
          "If your board has 50+ contacts, you're doing it wrong",
          "Think: 'Am I working this deal THIS WEEK?' → Kanban",
          "Think: 'Need to keep their info' → List View only",
        ],
      },
      {
        subtitle: "Mobile Access",
        tips: [
          "The CRM works on your phone/tablet",
          "Urgent tasks happen 24/7 - check on the go",
          "Add customers from the road after meetings",
          "Mark tasks complete from anywhere",
        ],
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting & FAQ",
    icon: <Settings className="h-5 w-5" />,
    content: [
      {
        subtitle: "Common Issues",
        steps: [
          "Can't find a customer? Use the search bar at the top",
          "Task not showing? Check if it's archived (cancelled status)",
          "Notification not clearing? Mark it as read manually",
          "Changes not saving? Check your internet connection",
          "Page not loading? Try refreshing (Ctrl+R or ⌘R)",
        ],
      },
      {
        subtitle: "FAQ",
        steps: [
          "Q: What's the difference between List and Kanban? A: List shows ALL contacts, Kanban shows only your focused workspace",
          "Q: Where do new customers appear? A: List View only - add them to Kanban using the green icon",
          "Q: Does removing from Kanban delete the customer? A: No, they return to List View",
          "Q: How many contacts should be on Kanban? A: 10-20 max for best focus",
          "Q: Can I delete a customer? A: No, but you can move them to 'Lost' status",
          "Q: Can I delete a task? A: Tasks are archived (cancelled), not deleted",
          "Q: How do I stop daily overdue notifications? A: Complete or archive the task",
          "Q: Can I change the customer ID format? A: No, it's auto-generated (NS-XXXX)",
          "Q: Can other brokers see my customers? A: No, you only see your own data",
          "Q: Can I export my data? A: Contact support for data export",
        ],
      },
      {
        subtitle: "Need More Help?",
        description:
          "Click the 'Feedback' button (top right) to send us a message. We're here to help!",
      },
    ],
  },
  {
    id: "api-integration",
    title: "API Integration",
    icon: <Key className="h-5 w-5" />,
    content: [
      {
        subtitle: "Overview",
        description:
          "The NTS Claims Tracker provides a REST API for programmatic access to customers, tasks, and unassigned contacts. Use API tokens to integrate with automation tools, scripts, and third-party applications.",
      },
      {
        subtitle: "Quick Start",
        steps: [
          "Go to Admin Dashboard → API Tokens tab",
          "Click 'Create New API Token'",
          "Enter a descriptive name (e.g., 'Zapier Integration')",
          "Select permissions (preset or custom scopes)",
          "Copy the token - it only shows once!",
          "Use the token in Authorization header: Bearer nts_live_...",
        ],
      },
      {
        subtitle: "Available Resources",
        steps: [
          "Customers - Create, read, update, delete customer records",
          "Tasks - Manage follow-ups and task schedules",
          "Unassigned Contacts - Access import pool for distribution",
        ],
        description: "All endpoints support pagination, filtering, and searching.",
      },
      {
        subtitle: "Complete Documentation",
        description:
          "For full API documentation including all endpoints, object schemas, field references, rate limits, security best practices, code examples, and troubleshooting:",
        tips: [
          "Includes complete field reference for Customer, Task, and Unassigned Contact objects",
          "Interactive code examples in curl, JavaScript, and Python",
          "Comprehensive security and error handling guides",
          "Rate limiting and pagination documentation",
        ],
      },
    ],
  },
];

export default function HelpPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [expandedSections, setExpandedSections] = useState<string[]>([
    "getting-started",
  ]);
  const [searchQuery, setSearchQuery] = useState("");

  // Check if user is logged in (Help is available to ALL users)
  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        const user = data?.user;
        if (!user || error) {
          router.push("/auth/login");
          return;
        }
        
        setIsAuthenticated(true);
      } finally {
        setLoading(false);
      }
    };
    checkAccess();
  }, [router, supabase]);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash || !helpSections.some((section) => section.id === hash)) return;

    setExpandedSections((prev) =>
      prev.includes(hash) ? prev : [...prev, hash],
    );

    window.requestAnimationFrame(() => {
      document.getElementById(hash)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  }, []);

  const toggleSection = (sectionId: string) => {
    setExpandedSections((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId],
    );
  };

  const expandAll = () => {
    setExpandedSections(helpSections.map((s) => s.id));
  };

  const collapseAll = () => {
    setExpandedSections([]);
  };

  const restartTour = () => {
    // Clear skip flag and reset login count to trigger tour
    localStorage.removeItem("tour-skipped");
    localStorage.setItem("login-count", "0");
    window.location.href = "/dashboard";
  };

  // Filter sections based on search
  const filteredSections = searchQuery
    ? helpSections.filter(
        (section) =>
          section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          section.content.some(
            (c) =>
              c.subtitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
              c.description
                ?.toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
              c.steps?.some((s) =>
                s.toLowerCase().includes(searchQuery.toLowerCase()),
              ) ||
              c.tips?.some((t) =>
                t.toLowerCase().includes(searchQuery.toLowerCase()),
              ),
          ),
      )
    : helpSections;

  // Loading state
  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-slate-500">
        Checking access…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-100">
              <Book className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Help Center</h1>
              <p className="text-sm text-slate-600">
                Learn how to use NTS Claims Tracker effectively
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="mt-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search help articles..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 py-3 pl-11 pr-4 text-sm focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              />
            </div>
          </div>

          {/* Quick Actions */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <button
                onClick={restartTour}
                className="flex items-center justify-center gap-2 whitespace-nowrap rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
              >
                <PlayCircle className="h-4 w-4" />
                Restart Tour
              </button>
              <p className="text-xs text-slate-500">
                {filteredSections.length} section
                {filteredSections.length !== 1 ? "s" : ""} available
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={expandAll}
                className="text-xs text-orange-600 hover:text-orange-700 whitespace-nowrap"
              >
                Expand All
              </button>
              <span className="text-xs text-slate-300">•</span>
              <button
                onClick={collapseAll}
                className="text-xs text-orange-600 hover:text-orange-700 whitespace-nowrap"
              >
                Collapse All
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="space-y-4">
          {filteredSections.map((section) => {
            const isExpanded = expandedSections.includes(section.id);

            return (
              <div
                key={section.id}
                id={section.id}
                className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
              >
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(section.id)}
                  className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
                      {section.icon}
                    </div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {section.title}
                    </h2>
                  </div>
                  {isExpanded ? (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  )}
                </button>

                {/* Section Content */}
                {isExpanded && (
                  <div className="border-t border-slate-100 p-5 space-y-6">
                    {section.content.map((item, idx) => (
                      <div key={idx}>
                        <h3 className="mb-3 font-semibold text-slate-900">
                          {item.subtitle}
                        </h3>

                        {item.description && (
                          <p className="mb-3 text-sm text-slate-600">
                            {item.description}
                          </p>
                        )}

                        {/* Special case for API docs link */}
                        {section.id === "api-integration" && item.subtitle === "Complete Documentation" && (
                          <Link
                            href="/docs/api"
                            className="mb-4 inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-orange-700 transition-colors"
                          >
                            <Code className="h-4 w-4" />
                            View Full API Documentation
                            <ExternalLink className="h-4 w-4" />
                          </Link>
                        )}

                        {item.steps && (
                          <ol className="space-y-2">
                            {item.steps.map((step, stepIdx) => (
                              <li
                                key={stepIdx}
                                className="flex items-start gap-3 text-sm text-slate-700"
                              >
                                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-semibold text-orange-700">
                                  {stepIdx + 1}
                                </span>
                                <span className="pt-0.5">{step}</span>
                              </li>
                            ))}
                          </ol>
                        )}

                        {item.tips && (
                          <div className="mt-3 rounded-lg bg-blue-50 p-4">
                            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-900">
                              <Lightbulb className="h-4 w-4" />
                              Pro Tips
                            </p>
                            <ul className="space-y-1.5">
                              {item.tips.map((tip, tipIdx) => (
                                <li
                                  key={tipIdx}
                                  className="flex items-start gap-2 text-sm text-blue-800"
                                >
                                  <span className="mt-1 text-blue-500">•</span>
                                  <span>{tip}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* No Results */}
        {searchQuery && filteredSections.length === 0 && (
          <div className="rounded-lg border border-slate-200 bg-white p-12 text-center">
            <Search className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-4 text-lg font-semibold text-slate-900">
              No results found
            </h3>
            <p className="mt-2 text-sm text-slate-600">
              Try a different search term or browse all sections
            </p>
            <button
              onClick={() => setSearchQuery("")}
              className="mt-4 text-sm text-orange-600 hover:text-orange-700"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Contact Support */}
        <div className="mt-8 rounded-lg border border-orange-200 bg-orange-50 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500">
              <MessageSquare className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">Still need help?</h3>
              <p className="mt-1 text-sm text-slate-700">
                Can't find what you're looking for? Click the "Feedback" button
                in the top right corner to send us a message. We're here to
                help!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
