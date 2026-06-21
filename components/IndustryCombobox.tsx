"use client";

import { useState, useRef, useEffect, useId } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { INDUSTRIES } from "@/lib/constants/industries";

interface IndustryComboboxProps {
  value: string;
  onChange: (value: string) => void;
  id?: string;
  name?: string;
  placeholder?: string;
  /** Extra list entries injected before the canonical list (e.g. legacy DB values) */
  extraOptions?: string[];
}

export default function IndustryCombobox({
  value,
  onChange,
  id,
  name,
  placeholder = "Search or type an industry...",
  extraOptions = [],
}: IndustryComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const autoId = useId();
  const inputId = id ?? autoId;

  // Build full option list: inject any legacy value not already present
  const allOptions = [
    ...extraOptions.filter((e) => !INDUSTRIES.includes(e)),
    ...INDUSTRIES,
  ];

  const filtered =
    query.trim() === ""
      ? allOptions
      : allOptions.filter((opt) =>
          opt.toLowerCase().includes(query.toLowerCase()),
        );

  // When the dropdown opens, seed the search field with current value to allow
  // immediate narrowing, but keep full list visible if no query yet.
  const handleOpen = () => {
    setQuery("");
    setActiveIndex(-1);
    setOpen(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSelect = (opt: string) => {
    onChange(opt);
    setOpen(false);
    setQuery("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setOpen(false);
    setQuery("");
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex >= 0 && filtered[activeIndex]) {
        handleSelect(filtered[activeIndex]);
      } else if (query.trim()) {
        // Allow freeform entry
        handleSelect(query.trim());
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const item = listRef.current.children[activeIndex] as HTMLElement;
      item?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  return (
    <div ref={containerRef} className="relative">
      {/* Hidden input for form submission compatibility */}
      {name && (
        <input type="hidden" name={name} value={value} />
      )}

      {/* Trigger button — shows selected value */}
      {!open ? (
        <button
          type="button"
          id={inputId}
          onClick={handleOpen}
          className="flex h-11 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm transition-colors hover:border-slate-300 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          aria-haspopup="listbox"
          aria-expanded={false}
        >
          <span className={value ? "text-slate-900" : "text-slate-400"}>
            {value || "Select one"}
          </span>
          <div className="flex shrink-0 items-center gap-1">
            {value && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleClear}
                onKeyDown={(e) => e.key === "Enter" && handleClear(e as any)}
                className="rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Clear industry"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </div>
        </button>
      ) : (
        /* Search input — shown while dropdown is open */
        <div className="flex h-11 items-center gap-2 rounded-lg border border-primary bg-white px-3 ring-2 ring-primary/20">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
            autoComplete="off"
            aria-autocomplete="list"
            aria-controls={`${inputId}-listbox`}
            aria-activedescendant={
              activeIndex >= 0 ? `${inputId}-opt-${activeIndex}` : undefined
            }
          />
          <button
            type="button"
            onClick={() => { setOpen(false); setQuery(""); }}
            className="shrink-0 rounded p-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            tabIndex={-1}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Dropdown list */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <ul
            ref={listRef}
            id={`${inputId}-listbox`}
            role="listbox"
            className="max-h-64 overflow-y-auto py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-sm text-slate-500">
                No matches.{" "}
                {query.trim() && (
                  <button
                    type="button"
                    onClick={() => handleSelect(query.trim())}
                    className="font-medium text-primary-text underline-offset-2 hover:underline"
                  >
                    Use &ldquo;{query.trim()}&rdquo;
                  </button>
                )}
              </li>
            ) : (
              filtered.map((opt, i) => (
                <li
                  key={opt}
                  id={`${inputId}-opt-${i}`}
                  role="option"
                  aria-selected={opt === value}
                  onMouseDown={(e) => {
                    e.preventDefault(); // prevent blur before click
                    handleSelect(opt);
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`cursor-pointer px-4 py-2.5 text-sm transition-colors ${
                    i === activeIndex
                      ? "bg-primary/10 text-primary-text"
                      : opt === value
                        ? "bg-slate-50 font-medium text-slate-900"
                        : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {opt}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
