"use client";

import { Suspense, useState } from "react";
import ClaimsListView from "@/components/ClaimsListView";
import ClaimIntakeModal from "@/components/ClaimIntakeModal";
import { useClaims } from "../useClaims";

function ListViewContent() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { claims, isLoading, error, refetch } = useClaims();

  // Show the claim intake modal directly from the list view.
  const handleAddClaim = () => {
    setIsModalOpen(true);
  };

  return (
    <div className="px-4 py-3 sm:px-6">
      <ClaimsListView
        claims={claims}
        isLoading={isLoading}
        error={error}
        onRefresh={refetch}
        onAddClaim={handleAddClaim}
      />
      <ClaimIntakeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

export default function ListViewPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
            <p className="text-sm text-slate-600">Loading claims...</p>
          </div>
        </div>
      }
    >
      <ListViewContent />
    </Suspense>
  );
}
