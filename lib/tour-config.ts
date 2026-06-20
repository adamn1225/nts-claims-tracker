import type { TourStep } from "@/components/TourGuide";

export const dashboardTour: TourStep[] = [
  {
    target: "", // No target - will use top-center fallback position
    title: "Welcome to NTS Claims Tracker! 👋",
    content:
      "This quick tour will show you the basics of managing your customers and tasks. You can skip this tour anytime or restart it from the Help page.",
    placement: "bottom",
  },
  {
    target: "[data-tour='search']",
    title: "Global Search",
    content:
      "Quickly find any customer by typing their name, email, or phone number. Use the dropdown to filter your search by specific fields.",
    placement: "bottom",
  },
  {
    target: "[data-tour='notifications']",
    title: "Notifications Bell",
    content:
      "Get notified about overdue tasks and upcoming follow-ups. Overdue tasks create DAILY reminders until you complete them!",
    placement: "bottom",
  },
  {
    target: "[data-tour='nav-customers']",
    title: "Your Book of Business",
    content:
      "Manage all your customers and prospects here. Click this link to view your book of business in different formats.",
    placement: "right",
    action: (router) => {
      router?.push("/dashboard/customers");
    },
  },
  {
    target: "[data-tour='nav-tasks']",
    title: "Task Management",
    content:
      "Never miss a follow-up! Create tasks with reminders and use quick templates to save time.",
    placement: "right",
    action: (router) => {
      router?.push("/dashboard/tasks");
    },
  },
  {
    target: "[data-tour='nav-help']",
    title: "Need Help?",
    content:
      "Visit the Help page anytime for detailed guides, tips, and best practices. You can also send feedback using the button in the top right corner.",
    placement: "right",
    action: (router) => {
      router?.push("/dashboard/help");
    },
  },
  {
    target: "[data-tour='new-customer']",
    title: "Add Your First Customer",
    content:
      "Click here to add a new customer. Fill in their business name, contact info, and categorize them by status (Prospect, Active, Won, Lost).",
    placement: "bottom",
    action: (router) => {
      router?.push("/dashboard/customers");
    },
  },
  {
    target: "[data-tour='kanban-board']",
    title: "Kanban Board",
    content:
      "Drag and drop customers between columns to change their status. Pin important customers to keep them at the top. Use quick action buttons to call, email, or add notes.",
    placement: "top",
    // No action needed - already on the customers page from previous step
  },
];
