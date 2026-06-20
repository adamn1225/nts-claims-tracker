"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

interface CustomerSearchContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string[];
  setStatusFilter: (statuses: string[]) => void;
  toggleStatus: (status: string) => void;
  sourceFilter: string[];
  setSourceFilter: (sources: string[]) => void;
  toggleSource: (source: string) => void;
  timezoneFilter: string;
  setTimezoneFilter: (timezone: string) => void;
  timezoneMode: "address" | "phone";
  setTimezoneMode: (mode: "address" | "phone") => void;
}

const CustomerSearchContext = createContext<
  CustomerSearchContextType | undefined
>(undefined);

export function CustomerSearchProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [timezoneFilter, setTimezoneFilter] = useState<string>("all");
  const [timezoneMode, setTimezoneMode] = useState<"address" | "phone">("address");

  const toggleStatus = (status: string) => {
    setStatusFilter((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status]
    );
  };

  const toggleSource = (source: string) => {
    setSourceFilter((prev) =>
      prev.includes(source)
        ? prev.filter((s) => s !== source)
        : [...prev, source]
    );
  };

  return (
    <CustomerSearchContext.Provider
      value={{ 
        searchQuery, 
        setSearchQuery, 
        statusFilter, 
        setStatusFilter, 
        toggleStatus,
        sourceFilter,
        setSourceFilter,
        toggleSource,
        timezoneFilter,
        setTimezoneFilter,
        timezoneMode,
        setTimezoneMode,
      }}
    >
      {children}
    </CustomerSearchContext.Provider>
  );
}

export function useCustomerSearch() {
  const context = useContext(CustomerSearchContext);
  if (context === undefined) {
    throw new Error(
      "useCustomerSearch must be used within a CustomerSearchProvider",
    );
  }
  return context;
}
