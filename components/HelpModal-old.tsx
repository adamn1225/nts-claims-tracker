"use client";

import {
  X,
  Book,
  Users,
  CheckSquare,
  Calendar,
  Search,
  ExternalLink,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function HelpModal({ isOpen, onClose }: HelpModalProps) {
  const router = useRouter();

  if (!isOpen) return null;

  const quickHelpTopics = [
    {
      icon: <Users className="h-5 w-5 text-orange-500" />,
      title: "Managing Customers",
      description:
        "Add customers, track status, and organize your book of business",
      tips: [
        "Click '+ New Customer' to add prospects and clients",
        "Drag and drop cards between columns to update status",
        "Pin important customers to keep them visible at the top",
      ],
    },
    {
      icon: <CheckSquare className="h-5 w-5 text-orange-500" />,
      title: "Task Management",
      description: "Never miss a follow-up with task reminders and templates",
      tips: [
        "Set task priority (Urgent, High, Normal, Low)",
        "Add due dates to get email and in-app notifications",
        "Use quick templates to create common tasks faster",
      ],
    },
    {
      icon: <Search className="h-5 w-5 text-orange-500" />,
      title: "Global Search",
      description: "Quickly find any customer across your entire book",
      tips: [
        "Search by customer name, contact, email, or phone",
        "Use the filter dropdown to narrow your search",
        "Click any result to jump directly to that customer",
      ],
    },
    {
      icon: <Calendar className="h-5 w-5 text-orange-500" />,
      title: "Calendar & Reminders",
      description:
        "Stay on top of follow-ups with calendar views and notifications",
      tips: [
        "View all tasks and follow-ups in calendar format",
        "Overdue tasks create DAILY reminders until completed",
        "Check the notification bell for upcoming and overdue tasks",
      ],
    },
  ];

  const handleViewFullHelp = () => {
    router.push("/dashboard/help");
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 h-screen bg-black/30"
        style={{ zIndex: 100 }}
        onClick={handleClose}
      />

      {/* Modal Panel */}
      <div
        className="fixed right-0 top-0 h-screen w-full max-w-md overflow-y-auto bg-white shadow-2xl"
        style={{ zIndex: 101 }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
                <Book className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Quick Help
                </h2>
                <p className="text-sm text-slate-600">
                  Common tips and shortcuts
                </p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close help"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        {/* Content */}
        <div className="px-6 py-4">
          {/* Introduction */}
          <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4">
            <p className="text-sm text-slate-700">
              <strong className="text-orange-900">
                Welcome to NTS Claims Tracker!
              </strong>
              <br />
              This CRM helps freight team members manage customer relationships,
              track tasks, and never miss a follow-up. Here are some quick tips
              to get started.
            </p>
          </div>

          {/* Quick Help Topics */}
          <div className="space-y-6">
            {quickHelpTopics.map((topic, index) => (
              <div
                key={index}
                className="rounded-lg border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="mt-0.5">{topic.icon}</div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">
                      {topic.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      {topic.description}
                    </p>
                  </div>
                </div>
                <ul className="ml-8 space-y-1.5">
                  {topic.tips.map((tip, tipIndex) => (
                    <li
                      key={tipIndex}
                      className="text-sm text-slate-700 before:mr-2 before:content-['•']"
                    >
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Keyboard Shortcuts Hint */}
          <div className="mt-6 rounded-lg bg-slate-50 p-4">
            <h3 className="mb-2 flex items-center gap-2 font-semibold text-slate-900">
              💡 Pro Tips
            </h3>
            <ul className="space-y-1.5 text-sm text-slate-700">
              <li className="before:mr-2 before:content-['•']">
                Use the global search (top bar) to find customers quickly
              </li>
              <li className="before:mr-2 before:content-['•']">
                Pin your most important customers to keep them at the top
              </li>
              <li className="before:mr-2 before:content-['•']">
                Set task priorities to focus on what matters most
              </li>
              <li className="before:mr-2 before:content-['•']">
                Restart the interactive tour from the full Help page
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 border-t border-slate-200 bg-white px-6 py-4">
          <button
            onClick={handleViewFullHelp}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-3 font-medium text-white transition-colors hover:bg-orange-600"
          >
            <Book className="h-4 w-4" />
            <span>View Full Help Documentation</span>
            <ExternalLink className="h-4 w-4" />
          </button>
          <p className="mt-3 text-center text-xs text-slate-500">
            Need more help? Visit the full help page for detailed guides, video
            tutorials, and best practices.
          </p>
        </div>
      </div>
    </>
  );
}
