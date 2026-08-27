"use client";

import {
  X,
  Book,
  Users,
  CheckSquare,
  FileText,
  FolderInput,
  Building2,
} from "lucide-react";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPath?: string;
}

type HelpTopic = {
  icon: React.ReactNode;
  title: string;
  description: string;
  tips: string[];
};

/**
 * HelpModal — context-aware quick help for claims workflows.
 * Content adapts to the current route (kanban, list, intake, companies).
 */
export default function HelpModal({
  isOpen,
  onClose,
  currentPath = "/dashboard",
}: HelpModalProps) {
  if (!isOpen) return null;

  const getHelpTopics = (path: string): HelpTopic[] => {
    if (path.includes("/kanban")) {
      return [
        {
          icon: <Users className="h-5 w-5 text-primary" />,
          title: "Managing Claims",
          description: "Track claims through every stage",
          tips: [
            "Drag cards between columns to update claim status",
            "Pin high-exposure claims to keep them visible",
            "Click a card to open the full claim detail",
          ],
        },
        {
          icon: <CheckSquare className="h-5 w-5 text-primary" />,
          title: "Filtering & Search",
          description: "Find claims quickly",
          tips: [
            "Filter by claim stage using the column headers",
            "Filter by intake source (FreightClaims.com, email, phone)",
            "Use search to find by claim number, BOL, or party name",
          ],
        },
      ];
    }

    if (path.includes("/claims/intake")) {
      return [
        {
          icon: <FolderInput className="h-5 w-5 text-primary" />,
          title: "Reviewing Intake",
          description: "Triage new claim submissions",
          tips: [
            "Review each submission and its attachments",
            "Promote valid claims to the board, or reject duplicates",
            "Promotion creates the claim, parties, and documents",
          ],
        },
      ];
    }

    if (path.includes("/claims/") && path.includes("/list")) {
      return [
        {
          icon: <FileText className="h-5 w-5 text-primary" />,
          title: "Claims List",
          description: "FreightClaims-style table of all claims",
          tips: [
            "Sort and filter by owner, stage, value bucket, and dates",
            "Use bulk assign to hand claims to the right person",
            "Open any row for the full claim detail",
          ],
        },
      ];
    }

    if (path.includes("/companies")) {
      return [
        {
          icon: <Building2 className="h-5 w-5 text-primary" />,
          title: "Companies",
          description: "Shippers, carriers, factoring, and insurers",
          tips: [
            "View carrier holds (Do Not Pay, payment/dispatch holds)",
            "Link a company to claims as a party",
            "Add notes to keep the team aligned",
          ],
        },
      ];
    }

    if (path.includes("/claims/")) {
      return [
        {
          icon: <FileText className="h-5 w-5 text-primary" />,
          title: "Claim Detail",
          description: "Everything about one claim",
          tips: [
            "Assign an owner from the header to route the claim",
            "Use the Tasks section to create and assign follow-ups",
            "Log transactions, upload documents, and post activity",
          ],
        },
      ];
    }

    // Default — dashboard / general
    return [
      {
        icon: <Users className="h-5 w-5 text-primary" />,
        title: "Claims Board",
        description: "Your pipeline at a glance",
        tips: [
          "Columns mirror the SOP: Intake → Documenting → Investigating → Carrier Review → Settlement → Closed",
          "Legal and Denied are side states tracked separately",
          "Pinned claims surface high-exposure work at the top",
        ],
      },
      {
        icon: <CheckSquare className="h-5 w-5 text-primary" />,
        title: "Tasks",
        description: "Per-claim follow-ups and checklists",
        tips: [
          "Open a claim and use its Tasks section to add follow-ups",
          "Assign each task to a team member",
          "Overdue tasks highlight in red so nothing slips",
        ],
      },
      {
        icon: <FolderInput className="h-5 w-5 text-primary" />,
        title: "Documents",
        description: "BOLs, PODs, photos, estimates, and more",
        tips: [
          "Click any image or PDF to preview it in-place",
          "Use Extract to pull structured fields from images with AI",
          "Required evidence is tracked per claim",
        ],
      },
      {
        icon: <Building2 className="h-5 w-5 text-primary" />,
        title: "Carrier Holds",
        description: "Do Not Pay and dispatch holds",
        tips: [
          "Placing an active hold requires manager approval",
          "Every hold writes an audit entry",
          "Holds surface on the carrier's company profile",
        ],
      },
    ];
  };

  const quickHelpTopics = getHelpTopics(currentPath);

  const getPageName = (path: string): string => {
    if (path.includes("/kanban")) return "Claims Board";
    if (path.includes("/claims/intake")) return "Claim Intake";
    if (path.includes("/claims/list")) return "Claims List";
    if (path.includes("/companies")) return "Companies";
    if (path.includes("/claims/")) return "Claim Detail";
    return "Dashboard";
  };

  const pageName = getPageName(currentPath);

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 h-screen bg-black/30"
        style={{ zIndex: 100 }}
        onClick={onClose}
      />

      {/* Modal Panel */}
      <div
        className="fixed right-0 top-0 h-screen w-full max-w-md overflow-y-auto bg-white shadow-2xl"
        style={{ zIndex: 101 }}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Book className="h-5 w-5 text-primary-text" />
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
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close help"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-4">
          {/* Page Context Badge */}
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary-text">
            <span className="h-2 w-2 rounded-full bg-primary"></span>
            Help for: {pageName}
          </div>

          {/* Introduction */}
          <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm text-slate-700">
              <strong className="text-slate-900">
                Welcome to NTS Claims Tracker!
              </strong>
              <br />
              Track cargo and transportation claims through their full lifecycle
              — intake, documentation, investigation, carrier review, settlement,
              and closure.
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
              Pro Tips
            </h3>
            <ul className="space-y-1.5 text-sm text-slate-700">
              <li className="before:mr-2 before:content-['•']">
                Open a claim to see its tasks, documents, and correspondence
              </li>
              <li className="before:mr-2 before:content-['•']">
                Assign claims to a team member from the claim header
              </li>
              <li className="before:mr-2 before:content-['•']">
                Preview images and PDFs in-place by clicking them
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
