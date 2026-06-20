"use client";

import { useState, useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Customer } from "@/lib/types";
import { getCustomerDisplayName } from "@/lib/customer-utils";
import {
  MapPin,
  Phone,
  Mail,
  Calendar,
  TrendingUp,
  AlertCircle,
  Filter,
  X,
} from "lucide-react";

// Set your Mapbox token in .env.local: NEXT_PUBLIC_MAPBOX_TOKEN
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface CustomerMapProps {
  customers: Customer[];
  onEditCustomer: (customer: Customer) => void;
  onQuickAction: (
    action: "call" | "email" | "schedule",
    customer: Customer,
  ) => void;
}

// Status colors matching NTS branding
const STATUS_COLORS: Record<string, string> = {
  prospect: "#3B82F6", // Blue
  active: "#10B981", // Green
  won: "#A855F7", // Purple
  lost: "#64748B", // Slate
};

export default function CustomerMap({
  customers,
  onEditCustomer,
  onQuickAction,
}: CustomerMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);

  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    statuses: ["prospect", "active", "won", "lost"] as string[],
    showOverdue: false,
    states: [] as string[],
  });

  // Get geocodable customers (have city and state)
  const geocodableCustomers = customers.filter((c) => c.city && c.state);

  // Apply filters
  const filteredCustomers = geocodableCustomers.filter((customer) => {
    if (!filters.statuses.includes(customer.status)) return false;
    if (
      filters.showOverdue &&
      (!customer.next_follow_up_date ||
        new Date(customer.next_follow_up_date) >= new Date())
    )
      return false;
    if (
      filters.states.length > 0 &&
      !filters.states.includes(customer.state || "")
    )
      return false;
    return true;
  });

  // Get unique states for filter
  const availableStates = Array.from(
    new Set(
      geocodableCustomers
        .map((c) => c.state)
        .filter((state): state is string => Boolean(state)),
    ),
  ).sort();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-98.5795, 39.8283], // Center of USA
      zoom: 3.5,
    });

    map.current.addControl(new mapboxgl.NavigationControl(), "top-right");
  }, []);

  // Update markers when customers or filters change
  useEffect(() => {
    if (!map.current) return;

    // Clear existing markers
    markersRef.current.forEach((marker) => marker.remove());
    markersRef.current = [];

    // Geocode and add markers
    filteredCustomers.forEach(async (customer) => {
      try {
        // Simple geocoding using Mapbox Geocoding API
        const query = `${customer.city}, ${customer.state}`;
        const response = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${mapboxgl.accessToken}&limit=1`,
        );
        const data = await response.json();

        if (data.features && data.features.length > 0) {
          const [lng, lat] = data.features[0].center;

          // Create marker wrapper (Mapbox will position this)
          const wrapper = document.createElement("div");
          wrapper.style.width = "0";
          wrapper.style.height = "0";
          wrapper.style.position = "relative";

          // Create custom marker element (the visible circle)
          const el = document.createElement("div");
          el.className = "customer-marker";
          el.style.position = "absolute";
          el.style.top = "-16px"; // Center vertically (half of 32px)
          el.style.left = "-16px"; // Center horizontally (half of 32px)
          el.style.width = "32px";
          el.style.height = "32px";
          el.style.borderRadius = "50%";
          el.style.border = "3px solid white";
          el.style.backgroundColor = STATUS_COLORS[customer.status];
          el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
          el.style.cursor = "pointer";
          el.style.transition = "all 0.2s ease-in-out";

          // Overdue indicator
          const isOverdue =
            customer.next_follow_up_date &&
            new Date(customer.next_follow_up_date) < new Date();
          if (isOverdue) {
            el.style.border = "3px solid #EF4444";
            el.style.animation = "pulse 2s infinite";
          }

          el.addEventListener("mouseenter", () => {
            el.style.width = "40px";
            el.style.height = "40px";
            el.style.top = "-20px";
            el.style.left = "-20px";
            el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4)";
            el.style.zIndex = "1000";
          });
          el.addEventListener("mouseleave", () => {
            el.style.width = "32px";
            el.style.height = "32px";
            el.style.top = "-16px";
            el.style.left = "-16px";
            el.style.boxShadow = "0 2px 4px rgba(0,0,0,0.3)";
            el.style.zIndex = "auto";
          });

          // Add circle to wrapper
          wrapper.appendChild(el);

          // Create marker with wrapper
          const marker = new mapboxgl.Marker(wrapper)
            .setLngLat([lng, lat])
            .addTo(map.current!);

          // Click handler
          el.addEventListener("click", () => {
            setSelectedCustomer(customer);
            map.current?.flyTo({
              center: [lng, lat],
              zoom: 8,
              duration: 1000,
            });
          });

          markersRef.current.push(marker);
        }
      } catch (error) {
        console.error(
          `Failed to geocode ${customer.city}, ${customer.state}`,
          error,
        );
      }
    });
  }, [filteredCustomers]);

  const toggleStatusFilter = (status: string) => {
    setFilters((prev) => ({
      ...prev,
      statuses: prev.statuses.includes(status)
        ? prev.statuses.filter((s) => s !== status)
        : [...prev.statuses, status],
    }));
  };

  const toggleStateFilter = (state: string) => {
    setFilters((prev) => ({
      ...prev,
      states: prev.states.includes(state)
        ? prev.states.filter((s) => s !== state)
        : [...prev.states, state],
    }));
  };

  const overdueCount = filteredCustomers.filter(
    (c) =>
      c.next_follow_up_date && new Date(c.next_follow_up_date) < new Date(),
  ).length;

  return (
    <div className="relative h-full w-full">
      {/* Map Container */}
      <div ref={mapContainer} className="h-full w-full" />

      {/* Stats Bar */}
      <div className="absolute left-4 top-4 rounded-lg bg-white p-4 shadow-lg">
        <div className="mb-2 text-sm font-semibold text-slate-700">
          Territory Overview
        </div>
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span className="text-slate-600">
              Prospects:{" "}
              {filteredCustomers.filter((c) => c.status === "prospect").length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span className="text-slate-600">
              Active:{" "}
              {filteredCustomers.filter((c) => c.status === "active").length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-amber-500" />
            <span className="text-slate-600">
              Won: {filteredCustomers.filter((c) => c.status === "won").length}
            </span>
          </div>
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 rounded bg-red-50 p-2">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <span className="font-medium text-red-600">
                {overdueCount} Overdue Follow-ups
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Filter Button */}
      <button
        onClick={() => setShowFilters(!showFilters)}
        className="absolute right-4 top-4 flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-medium text-slate-700 shadow-lg hover:bg-slate-50"
      >
        <Filter className="h-4 w-4" />
        <span className="hidden sm:inline">Filters</span>
        {(filters.states.length > 0 || !filters.statuses.includes("lost")) && (
          <div className="h-2 w-2 rounded-full bg-orange-500" />
        )}
      </button>

      {/* Filter Panel */}
      {showFilters && (
        <div className="absolute right-4 top-20 w-80 rounded-lg bg-white p-4 shadow-xl">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Filter Customers</h3>
            <button
              onClick={() => setShowFilters(false)}
              className="rounded p-1 hover:bg-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Status Filters */}
          <div className="mb-4">
            <div className="mb-2 text-sm font-medium text-slate-700">
              Status
            </div>
            <div className="space-y-2">
              {(["prospect", "active", "won", "lost"] as string[]).map(
                (status) => (
                  <label
                    key={status}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={filters.statuses.includes(status)}
                      onChange={() => toggleStatusFilter(status)}
                      className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[status] }}
                    />
                    <span className="text-sm capitalize text-slate-700">
                      {status}
                    </span>
                  </label>
                ),
              )}
            </div>
          </div>

          {/* Overdue Filter */}
          <div className="mb-4">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={filters.showOverdue}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    showOverdue: e.target.checked,
                  }))
                }
                className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
              />
              <span className="text-sm text-slate-700">
                Overdue Follow-ups Only
              </span>
            </label>
          </div>

          {/* State Filters */}
          {availableStates.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-medium text-slate-700">
                States (
                {filters.states.length > 0 ? filters.states.length : "All"})
              </div>
              <div className="max-h-40 space-y-1 overflow-y-auto">
                {availableStates.map((state) => (
                  <label
                    key={state}
                    className="flex cursor-pointer items-center gap-2"
                  >
                    <input
                      type="checkbox"
                      checked={filters.states.includes(state)}
                      onChange={() => toggleStateFilter(state)}
                      className="h-4 w-4 rounded border-slate-300 text-orange-500 focus:ring-orange-500"
                    />
                    <span className="text-sm text-slate-700">{state}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Selected Customer Sidebar */}
      {selectedCustomer && (
        <div className="absolute bottom-0 left-0 right-0 rounded-t-xl bg-white p-6 shadow-2xl sm:bottom-4 sm:left-4 sm:right-auto sm:w-96 sm:rounded-xl">
          <button
            onClick={() => setSelectedCustomer(null)}
            className="absolute right-4 top-4 rounded p-1 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="mb-4">
            <h3 className="text-lg font-bold text-slate-900">
              {selectedCustomer.business_name}
            </h3>
            <p className="text-slate-600">{getCustomerDisplayName(selectedCustomer)}</p>
          </div>

          {/* Customer Details */}
          <div className="mb-4 space-y-2 text-sm">
            {selectedCustomer.industry && (
              <div className="flex items-center gap-2 text-slate-600">
                <TrendingUp className="h-4 w-4" />
                {selectedCustomer.industry}
              </div>
            )}
            <div className="flex items-center gap-2 text-slate-600">
              <MapPin className="h-4 w-4" />
              {selectedCustomer.city}, {selectedCustomer.state}
            </div>
            {selectedCustomer.next_follow_up_date && (
              <div
                className={`flex items-center gap-2 ${
                  new Date(selectedCustomer.next_follow_up_date) < new Date()
                    ? "font-semibold text-red-600"
                    : "text-slate-600"
                }`}
              >
                <Calendar className="h-4 w-4" />
                Follow-up:{" "}
                {new Date(
                  selectedCustomer.next_follow_up_date,
                ).toLocaleDateString()}
                {new Date(selectedCustomer.next_follow_up_date) < new Date() &&
                  " (Overdue)"}
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2">
            <button
              onClick={() => onQuickAction("call", selectedCustomer)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-100 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
            >
              <Phone className="h-4 w-4" />
              Call
            </button>
            <button
              onClick={() => onQuickAction("email", selectedCustomer)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-100 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-200"
            >
              <Mail className="h-4 w-4" />
              Email
            </button>
            <button
              onClick={() => onQuickAction("schedule", selectedCustomer)}
              className="flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-orange-500 text-sm font-medium text-white transition-colors hover:bg-orange-600"
            >
              <Calendar className="h-4 w-4" />
              Schedule
            </button>
          </div>

          <button
            onClick={() => onEditCustomer(selectedCustomer)}
            className="mt-3 w-full rounded-lg border border-slate-200 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            View Full Details
          </button>
        </div>
      )}

      {/* Pulse animation for overdue markers */}
      <style jsx global>{`
        @keyframes pulse {
          0%,
          100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
}
