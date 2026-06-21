"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import DesktopOnlyView from "@/components/DesktopOnlyView";
import { useIsMobileOrTablet } from "@/lib/hooks/useMediaQuery";
import {
  Upload,
  Download,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  X,
  FileSpreadsheet,
  Info,
  Loader2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type ImportStep = "upload" | "map" | "review" | "importing" | "success";

export default function ImportPage() {
  // Call all hooks FIRST (before any conditional returns)
  const isMobileOrTablet = useIsMobileOrTablet();
  const [step, setStep] = useState<ImportStep>("upload");
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvData, setCsvData] = useState<any[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importStats, setImportStats] = useState({ total: 0, imported: 0, skipped: 0, errors: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>("");

  // Fetch current user ID — must be before any conditional returns
  useEffect(() => {
    const fetchUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    fetchUser();
  }, []);

  // Show desktop-only message on mobile/tablet
  if (isMobileOrTablet) {
    return (
      <DesktopOnlyView
        pageName="Customer Import"
        reason="The multi-step CSV mapping and import process requires a larger screen for accuracy."
        mobileAlternative={{
          href: "/dashboard/customers/list",
          label: "View Customers",
        }}
      />
    );
  }

  // Database fields with user-friendly labels
  // Keep this short and simple — anything else goes to Profile Notes.
  const dbFields = [
    { value: "", label: "— Skip this column —" },
    { value: "_append_notes", label: "Add to Profile Notes" },
    { value: "business_name", label: "Business/Company Name" },
    { value: "first_name", label: "First Name" },
    { value: "last_name", label: "Last Name" },
    { value: "contact_name", label: "Full Contact Name" },
    { value: "phone", label: "Phone Number" },
    { value: "email", label: "Email Address" },
    { value: "url", label: "CRM Link / URL" },
    { value: "notes", label: "Notes" },
  ];

  // Download CSV template
  const downloadTemplate = () => {
    const headers = [
      "business_name",
      "first_name",
      "last_name",
      "phone",
      "email",
      "crm_link",
      "notes",
    ];

    const exampleRows = [
      [
        "ABC Manufacturing",
        "John",
        "Smith",
        "555-123-4567",
        "john@abcmfg.com",
        "https://yourcrm.example.com/contact/12345",
        "Met at trade show - interested in weekly shipments",
      ],
      [
        "XYZ Logistics",
        "Sarah",
        "Johnson",
        "555-987-6543",
        "sarah@xyzlogistics.com",
        "https://yourcrm.example.com/contact/67890",
        "Referral from Tom Wilson",
      ],
    ];

    const csvContent =
      headers.join(",") +
      "\n" +
      exampleRows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "nts-customer-import-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  // Handle file selection
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      await handleFile(e.target.files[0]);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFile(e.dataTransfer.files[0]);
    }
  };

  // Process uploaded file
  const handleFile = async (selectedFile: File) => {
    // Validate file type
    if (!selectedFile.name.match(/\.(csv|xlsx|xls)$/i)) {
      alert("Please upload a CSV or Excel file (.csv, .xlsx, .xls)");
      return;
    }

    setFile(selectedFile);
    await parseFile(selectedFile);
  };

  // Parse CSV file
  const parseFile = async (file: File) => {
    const Papa = (await import("papaparse")).default;

    if (file.name.endsWith(".csv")) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data.length > 0) {
            const headers = Object.keys(results.data[0] as Record<string, any>);
            setCsvHeaders(headers);
            setCsvData(results.data);

            // Smart auto-mapping
            const autoMapping = smartAutoMap(headers);
            setColumnMapping(autoMapping);

            // Move to mapping step
            setStep("map");
          }
        },
        error: (error) => {
          alert("Error parsing CSV: " + error.message);
        },
      });
    } else {
      // Handle Excel files
      const XLSX = await import("xlsx");
      const reader = new FileReader();

      reader.onload = (e) => {
        const data = e.target?.result;
        if (!data) {
          alert("Unable to read Excel file. Please try again.");
          return;
        }

        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        if (!sheetName) {
          alert("No sheets found in this Excel file.");
          return;
        }

        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length > 0) {
          const headers = Object.keys(jsonData[0] as Record<string, any>);
          setCsvHeaders(headers);
          setCsvData(jsonData);

          // Smart auto-mapping
          const autoMapping = smartAutoMap(headers);
          setColumnMapping(autoMapping);

          // Move to mapping step
          setStep("map");
        }
      };

      reader.onerror = () => {
        alert("Error reading Excel file. Please try again.");
      };

      reader.readAsBinaryString(file);
    }
  };

  // Intelligent column auto-mapping
  // Anything we don't explicitly recognize falls back to "_append_notes"
  // so it gets added to the customer's profile notes rather than discarded.
  const smartAutoMap = (headers: string[]): Record<string, string> => {
    const mapping: Record<string, string> = {};

    headers.forEach((header) => {
      const normalized = header.toLowerCase().replace(/[_\s-]/g, "");

      // Business name — "shipper" covers dispatch system exports
      if (normalized.match(/business|company|organization|firm|shipper/)) {
        mapping[header] = "business_name";
      }
      // First name — exact matches only, never "First Dispatch" etc.
      else if (/^(first|firstname|fname)$/.test(normalized)) {
        mapping[header] = "first_name";
      }
      // Last name — exact matches only
      else if (/^(last|lastname|lname|surname)$/.test(normalized)) {
        mapping[header] = "last_name";
      }
      // Full contact name
      else if (normalized.match(/^contactname$|^fullname$|^contact$/)) {
        mapping[header] = "contact_name";
      }
      // Phone
      else if (normalized.match(/phone|mobile|cell|telephone/)) {
        mapping[header] = "phone";
      }
      // Email
      else if (normalized.match(/email|mail/)) {
        mapping[header] = "email";
      }
      // CRM Link / URL — "search" covers dispatch systems that call it "Search"
      // Deliberately excludes "dispatch" so dispatch columns go to notes
      else if (/^(crm|crmlink|search|url|profileurl|profilelink|website|weburl)$/.test(normalized) ||
               normalized.startsWith("crmlink") || normalized.endsWith("url")) {
        mapping[header] = "url";
      }
      // Notes
      else if (normalized.match(/^(note|notes|comment|description|memo)$/)) {
        mapping[header] = "notes";
      }
      // Everything else (dispatch data, dates, locations, etc.) → silently to profile notes
      else {
        mapping[header] = "_append_notes";
      }
    });

    return mapping;
  };

  // Handle import
  const handleImport = async () => {
    setStep("importing");

    const supabase = createClient();

    // Always resolve the current user at import time — never trust stale state
    let userId = currentUserId;
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        alert("Could not verify your account. Please refresh and try again.");
        setStep("review");
        return;
      }
      userId = user.id;
      setCurrentUserId(userId);
    }

    let imported = 0;
    let skipped = 0;
    let errors = 0;
    // Set to true the first time PostgREST rejects `import_source` due to a
    // stale schema cache; subsequent rows then skip the column up-front instead
    // of paying two round trips each.
    let dropImportSource = false;

    const importLabel = file
      ? `${file.name} — ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`
      : `Self Import — ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}`;

    try {
      for (const row of csvData) {
        const customer: any = {
          team_member_id: userId, // Assign to self
          business_name: "",
          contact_name: "",
          status: "inbox",        // Shows in Inbox column on kanban board
          on_kanban_board: true,  // Immediately visible on kanban
          import_source: importLabel,
        };

        // Collect extra columns to append to the customer's notes field
        const noteLines: string[] = [];

        // Map columns
        Object.entries(columnMapping).forEach(([csvCol, dbField]) => {
          const rawValue = row[csvCol];
          if (!dbField || rawValue === undefined || rawValue === null || rawValue === "") {
            return;
          }

          if (dbField === "_append_notes") {
            noteLines.push(`${csvCol}: ${String(rawValue).trim()}`);
          } else if (dbField === "notes") {
            noteLines.push(String(rawValue).trim());
          } else {
            customer[dbField] = rawValue;
          }
        });

        // Combine all notes content into the single notes field
        if (noteLines.length > 0) {
          customer.notes = noteLines.join("\n");
        }

        // Build contact_name from first/last if not provided
        if (!customer.contact_name && customer.first_name) {
          customer.contact_name = `${customer.first_name} ${customer.last_name || ""}`.trim();
        }

        // Fallback: use business_name as contact_name if still empty
        if (!customer.contact_name && customer.business_name) {
          customer.contact_name = customer.business_name;
        }

        // Skip if no business name or contact name
        if (!customer.business_name && !customer.contact_name) {
          skipped++;
          continue;
        }

        // Insert customer
        const payload = dropImportSource
          ? (() => {
              const { import_source: _drop, ...rest } = customer;
              return rest;
            })()
          : customer;
        let { error } = await supabase.from("customers").insert(payload);

        // Defensive retry: if PostgREST schema cache is stale and rejects the
        // optional `import_source` column, drop it and try again so the user's
        // entire import doesn't fail. (See same pattern in delete-team-member route.)
        if (
          error &&
          /column .*import_source.* does not exist/i.test(error.message || "")
        ) {
          dropImportSource = true;
          const { import_source: _drop, ...customerWithoutSource } = customer;
          const retry = await supabase
            .from("customers")
            .insert(customerWithoutSource);
          error = retry.error;
        }

        if (error) {
          errors++;
          console.error("Import error:", error);
        } else {
          imported++;
        }
      }

      // Update stats
      setImportStats({
        total: csvData.length,
        imported,
        skipped,
        errors,
      });

      setStep("success");
    } catch (error) {
      console.error("Import failed:", error);
      alert("Import failed. Please try again.");
      setStep("review");
    }
  };

  // Reset to start over
  const reset = () => {
    setStep("upload");
    setFile(null);
    setCsvHeaders([]);
    setCsvData([]);
    setColumnMapping({});
    setImportStats({ total: 0, imported: 0, skipped: 0, errors: 0 });
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-50 via-orange-50/20 to-slate-50 p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-3xl font-bold text-slate-900">
            Import Your Customer List
          </h1>
          <p className="text-slate-600">
            Upload a CSV file to quickly add your contacts to your CRM
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {/* Step 1 */}
          <div className="flex items-center gap-2">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${
                step === "upload"
                  ? "bg-[#E85D04] text-white"
                  : ["map", "review", "importing", "success"].includes(step)
                    ? "bg-green-500 text-white"
                    : "bg-slate-200 text-slate-600"
              }`}
            >
              {["map", "review", "importing", "success"].includes(step) ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                "1"
              )}
            </div>
            <span className="hidden text-sm font-medium text-slate-700 md:inline">
              Upload
            </span>
          </div>

          <div className="h-0.5 w-12 bg-slate-300 md:w-20" />

          {/* Step 2 */}
          <div className="flex items-center gap-2">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${
                step === "map"
                  ? "bg-[#E85D04] text-white"
                  : ["review", "importing", "success"].includes(step)
                    ? "bg-green-500 text-white"
                    : "bg-slate-200 text-slate-600"
              }`}
            >
              {["review", "importing", "success"].includes(step) ? (
                <CheckCircle className="h-5 w-5" />
              ) : (
                "2"
              )}
            </div>
            <span className="hidden text-sm font-medium text-slate-700 md:inline">
              Map Columns
            </span>
          </div>

          <div className="h-0.5 w-12 bg-slate-300 md:w-20" />

          {/* Step 3 */}
          <div className="flex items-center gap-2">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-full font-semibold ${
                ["review", "importing"].includes(step)
                  ? "bg-[#E85D04] text-white"
                  : step === "success"
                    ? "bg-green-500 text-white"
                    : "bg-slate-200 text-slate-600"
              }`}
            >
              {step === "success" ? <CheckCircle className="h-5 w-5" /> : "3"}
            </div>
            <span className="hidden text-sm font-medium text-slate-700 md:inline">
              Review & Import
            </span>
          </div>
        </div>

        {/* Main Content Card */}
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="rounded-xl bg-white shadow-lg"
        >
          {/* Step 1: Upload */}
          {step === "upload" && (
            <div className="p-6 md:p-8">
              {/* Template Download */}
              <div className="mb-6 rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <p className="mb-1 font-semibold text-blue-900">
                      📋 First time importing?
                    </p>
                    <p className="text-sm text-blue-700">
                      Download our template to see the correct format and required columns
                    </p>
                  </div>
                  <button
                    onClick={downloadTemplate}
                    className="flex shrink-0 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md"
                  >
                    <Download className="h-4 w-4" />
                    Download Template
                  </button>
                </div>
              </div>

              {/* File Upload Area */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`relative rounded-xl border-2 border-dashed p-8 text-center transition-all ${
                  isDragging
                    ? "border-[#E85D04] bg-orange-50"
                    : "border-slate-300 bg-slate-50 hover:border-[#E85D04] hover:bg-orange-50"
                }`}
              >
                <input
                  type="file"
                  id="file-upload"
                  accept=".csv,.xlsx,.xls"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="mb-4 flex justify-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-md ring-2 ring-slate-200 transition-all hover:ring-[#E85D04]">
                      <Upload className="h-10 w-10 text-[#E85D04]" />
                    </div>
                  </div>

                  <h3 className="mb-2 text-xl font-semibold text-slate-900">
                    {isDragging ? "Drop your file here" : "Upload Customer List"}
                  </h3>

                  <p className="mb-4 text-slate-600">
                    Drag and drop your CSV or Excel file, or{" "}
                    <span className="font-semibold text-[#E85D04]">click to browse</span>
                  </p>

                  <div className="flex flex-col items-center justify-center gap-2 text-sm text-slate-500">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>Supports: CSV, XLSX, XLS</span>
                    </div>
                  </div>
                </label>
              </div>

              {/* Help Text */}
              <div className="mt-6 rounded-lg bg-slate-50 p-4">
                <div className="flex items-start gap-3">
                  <Info className="h-5 w-5 shrink-0 text-slate-500" />
                  <div className="text-sm text-slate-700">
                    <p className="mb-2 font-semibold">What happens after upload?</p>
                    <ul className="list-inside list-disc space-y-1 text-slate-600">
                      <li>We'll automatically match your columns to our fields</li>
                      <li>You can review and adjust the mappings</li>
                      <li>Preview your data before importing</li>
                      <li>All customers are added to your personal list</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Map Columns */}
          {step === "map" && (
            <div className="p-6 md:p-8">
              <div className="mb-6">
                <h2 className="mb-2 text-xl font-semibold text-slate-900">
                  Match Your Columns
                </h2>
                <p className="text-sm text-slate-600">
                  We've auto-matched your columns. Review and adjust if needed.
                </p>
              </div>

              {/* Smart mapping info */}
              <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 shrink-0 text-green-600" />
                  <div className="text-sm">
                    <p className="font-semibold text-green-900">
                      Found {Object.values(columnMapping).filter((v) => v && v !== "_append_notes" && v !== "").length} contact fields to import
                    </p>
                    <p className="text-green-700">
                      Only contact information is shown below. Any other columns in your file will automatically be saved to the customer's profile notes.
                    </p>
                  </div>
                </div>
              </div>

              {/* Column Mappings — only show rows that matched a contact field */}
              <div className="space-y-3">
                {csvHeaders.filter((header) => {
                  const mapped = columnMapping[header];
                  return mapped && mapped !== "_append_notes" && mapped !== "";
                }).map((header) => {
                  const sampleValue = csvData[0]?.[header];
                  const isMatched = columnMapping[header] && columnMapping[header] !== "";

                  return (
                    <div
                      key={header}
                      className={`rounded-lg border p-4 transition-all ${
                        isMatched
                          ? "border-green-200 bg-green-50/50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      {/* Mobile-friendly layout */}
                      <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        {/* CSV Column */}
                        <div className="flex-1">
                          <p className="mb-1 text-sm font-semibold text-slate-900">
                            {header}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            Sample: {sampleValue ? String(sampleValue).substring(0, 50) : "—"}
                          </p>
                        </div>

                        {/* Arrow (hidden on mobile) */}
                        <ArrowRight className="hidden h-5 w-5 shrink-0 text-slate-400 md:block" />

                        {/* Database Field Selector */}
                        <div className="md:w-64">
                          <select
                            value={columnMapping[header] || ""}
                            onChange={(e) =>
                              setColumnMapping({
                                ...columnMapping,
                                [header]: e.target.value,
                              })
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium focus:border-[#E85D04] focus:outline-none focus:ring-2 focus:ring-[#E85D04]/20"
                          >
                            {dbFields.map((field) => (
                              <option key={field.value} value={field.value}>
                                {field.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Actions */}
              <div className="mt-8 flex flex-col gap-3 md:flex-row md:justify-end">
                <button
                  onClick={() => setStep("upload")}
                  className="rounded-lg border border-slate-300 px-6 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setStep("review")}
                  className="rounded-lg bg-[#E85D04] px-6 py-2.5 font-medium text-white shadow-sm transition-all hover:bg-[#d14f00] hover:shadow-md"
                >
                  Continue to Review →
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Review */}
          {step === "review" && (
            <div className="p-6 md:p-8">
              <div className="mb-6">
                <h2 className="mb-2 text-xl font-semibold text-slate-900">
                  Review Your Import
                </h2>
                <p className="text-sm text-slate-600">
                  Here's a preview of the first 5 customers. Everything look good?
                </p>
              </div>

              {/* Stats */}
              <div className="mb-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">Total Rows</p>
                  <p className="text-2xl font-bold text-slate-900">{csvData.length}</p>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50 p-4">
                  <p className="text-sm text-green-700">Columns Mapped</p>
                  <p className="text-2xl font-bold text-green-900">
                    {Object.values(columnMapping).filter((v) => v).length}
                  </p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                  <p className="text-sm text-blue-700">Status</p>
                  <p className="text-lg font-semibold text-blue-900">Ready to Import ✓</p>
                </div>
              </div>

              {/* Preview Table */}
              <div className="mb-6 overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Business Name
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Contact Name
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Email
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Phone
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {csvData.slice(0, 5).map((row, idx) => {
                      const businessNameCol = Object.keys(columnMapping).find(
                        (k) => columnMapping[k] === "business_name"
                      );
                      const firstNameCol = Object.keys(columnMapping).find(
                        (k) => columnMapping[k] === "first_name"
                      );
                      const lastNameCol = Object.keys(columnMapping).find(
                        (k) => columnMapping[k] === "last_name"
                      );
                      const contactNameCol = Object.keys(columnMapping).find(
                        (k) => columnMapping[k] === "contact_name"
                      );
                      const emailCol = Object.keys(columnMapping).find(
                        (k) => columnMapping[k] === "email"
                      );
                      const phoneCol = Object.keys(columnMapping).find(
                        (k) => columnMapping[k] === "phone"
                      );

                      const contactName =
                        row[contactNameCol || ""] ||
                        `${row[firstNameCol || ""] || ""} ${row[lastNameCol || ""] || ""}`.trim();

                      return (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-900">
                            {row[businessNameCol || ""] || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-900">{contactName || "—"}</td>
                          <td className="px-4 py-3 text-slate-600">
                            {row[emailCol || ""] || "—"}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {row[phoneCol || ""] || "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <p className="mb-6 text-center text-sm text-slate-500">
                Showing first 5 of {csvData.length} rows
              </p>

              {/* Actions */}
              <div className="flex flex-col gap-3 md:flex-row md:justify-end">
                <button
                  onClick={() => setStep("map")}
                  className="rounded-lg border border-slate-300 px-6 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  ← Back to Mapping
                </button>
                <button
                  onClick={handleImport}
                  className="flex items-center justify-center gap-2 rounded-lg bg-green-600 px-6 py-2.5 font-semibold text-white shadow-md transition-all hover:bg-green-700 hover:shadow-lg"
                >
                  <CheckCircle className="h-5 w-5" />
                  Import {csvData.length} Customers
                </button>
              </div>
            </div>
          )}

          {/* Importing State */}
          {step === "importing" && (
            <div className="flex flex-col items-center justify-center p-12 md:p-20">
              <Loader2 className="mb-4 h-16 w-16 animate-spin text-[#E85D04]" />
              <h3 className="mb-2 text-xl font-semibold text-slate-900">
                Importing Your Customers...
              </h3>
              <p className="text-slate-600">This will only take a moment</p>
            </div>
          )}

          {/* Success State */}
          {step === "success" && (
            <div className="p-6 md:p-12">
              <div className="mb-8 text-center">
                <div className="mb-4 flex justify-center">
                  <div className="flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle className="h-12 w-12 text-green-600" />
                  </div>
                </div>
                <h2 className="mb-2 text-2xl font-bold text-slate-900">
                  Import Complete! 🎉
                </h2>
                <p className="text-slate-600">
                  Your customers have been added to your CRM
                </p>
              </div>

              {/* Import Stats */}
              <div className="mb-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
                  <p className="text-3xl font-bold text-green-900">
                    {importStats.imported}
                  </p>
                  <p className="text-sm text-green-700">Imported</p>
                </div>
                {importStats.skipped > 0 && (
                  <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6 text-center">
                    <p className="text-3xl font-bold text-yellow-900">
                      {importStats.skipped}
                    </p>
                    <p className="text-sm text-yellow-700">Skipped</p>
                  </div>
                )}
                {importStats.errors > 0 && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
                    <p className="text-3xl font-bold text-red-900">{importStats.errors}</p>
                    <p className="text-sm text-red-700">Errors</p>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 md:flex-row md:justify-center">
                <a
                  href="/dashboard/customers"
                  className="rounded-lg bg-[#E85D04] px-8 py-3 text-center font-semibold text-white shadow-md transition-all hover:bg-[#d14f00] hover:shadow-lg"
                >
                  View My Customers →
                </a>
                <button
                  onClick={reset}
                  className="rounded-lg border border-slate-300 px-8 py-3 font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Import More
                </button>
              </div>
            </div>
          )}
        </motion.div>

        {/* Footer Help */}
        <div className="mt-8 text-center text-sm text-slate-600">
          <p>
            Need help?{" "}
            <a href="/dashboard/help#importing-customers" className="font-semibold text-[#E85D04] hover:underline">
              View Import Guide
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
