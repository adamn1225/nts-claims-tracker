"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";

type Option = { id: string; name: string };

type ComboboxFieldProps = {
    label: string;
    /** Hidden input carrying the selected option's id. */
    name: string;
    /** Hidden input carrying free text when nothing in the list matched. */
    fallbackName: string;
    options: Option[];
    placeholder?: string;
    hint?: string;
};

/**
 * Type-to-search selector for long lists (the rep roster is 100+ names).
 * Submits the chosen option's id, or — if the customer types a name that
 * isn't in the list — that raw text under `fallbackName` so the claims team
 * still sees who they meant.
 */
export default function ComboboxField({
    label,
    name,
    fallbackName,
    options,
    placeholder,
    hint,
}: ComboboxFieldProps) {
    const inputId = useId();
    const listId = `${inputId}-list`;
    const hintId = hint ? `${inputId}-hint` : undefined;

    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<Option | null>(null);
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const matches = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((o) => o.name.toLowerCase().includes(q));
    }, [options, query]);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    useEffect(() => {
        if (!open) return;
        listRef.current
            ?.querySelector(`[data-index="${highlight}"]`)
            ?.scrollIntoView({ block: "nearest" });
    }, [highlight, open]);

    function choose(option: Option) {
        setSelected(option);
        setQuery(option.name);
        setOpen(false);
    }

    function clear() {
        setSelected(null);
        setQuery("");
        setOpen(false);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            if (!open) {
                setOpen(true);
                return;
            }
            setHighlight((i) => {
                const next = e.key === "ArrowDown" ? i + 1 : i - 1;
                if (next < 0) return matches.length - 1;
                if (next >= matches.length) return 0;
                return next;
            });
        } else if (e.key === "Enter") {
            if (open && matches[highlight]) {
                e.preventDefault();
                choose(matches[highlight]);
            }
        } else if (e.key === "Escape") {
            setOpen(false);
        }
    }

    return (
        <div className="block" ref={wrapperRef}>
            <label
                htmlFor={inputId}
                className="block text-sm font-medium text-slate-700"
            >
                {label}
            </label>

            <div className="relative mt-1">
                <input
                    id={inputId}
                    type="text"
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-autocomplete="list"
                    aria-describedby={hintId}
                    autoComplete="off"
                    value={query}
                    placeholder={placeholder}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        setSelected(null);
                        setHighlight(0);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    onKeyDown={handleKeyDown}
                    className="block w-full rounded-md border border-slate-300 bg-white py-2 pl-3 pr-16 text-sm text-slate-900 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                />

                <div className="absolute inset-y-0 right-0 flex items-center gap-0.5 pr-2">
                    {query && (
                        <button
                            type="button"
                            onClick={clear}
                            aria-label="Clear selection"
                            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}
                    <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setOpen((v) => !v)}
                        aria-label="Show options"
                        className="inline-flex h-7 w-6 items-center justify-center rounded text-slate-400 hover:text-slate-600"
                    >
                        <ChevronDown className="h-4 w-4" />
                    </button>
                </div>

                {open && (
                    <ul
                        id={listId}
                        ref={listRef}
                        role="listbox"
                        className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
                    >
                        {matches.length === 0 ? (
                            <li className="px-3 py-2 text-sm text-slate-500">
                                No match — we&apos;ll pass along &quot;{query.trim()}&quot; as typed.
                            </li>
                        ) : (
                            matches.map((option, i) => (
                                <li key={option.id} data-index={i}>
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={selected?.id === option.id}
                                        onMouseEnter={() => setHighlight(i)}
                                        onClick={() => choose(option)}
                                        className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm ${i === highlight ? "bg-primary/5 text-slate-900" : "text-slate-700"
                                            }`}
                                    >
                                        <span className="min-w-0 wrap-break-word">{option.name}</span>
                                        {selected?.id === option.id && (
                                            <Check className="h-4 w-4 shrink-0 text-primary" />
                                        )}
                                    </button>
                                </li>
                            ))
                        )}
                    </ul>
                )}
            </div>

            <input type="hidden" name={name} value={selected?.id ?? ""} />
            <input
                type="hidden"
                name={fallbackName}
                value={selected ? "" : query.trim()}
            />

            {hint && hintId && (
                <span id={hintId} className="mt-1 block text-xs text-slate-500">
                    {hint}
                </span>
            )}
        </div>
    );
}
