"use client";

import { Suspense, useState } from "react";
import ClaimsKanbanBoard from "@/components/ClaimsKanbanBoard";
import ClaimIntakeModal from "@/components/ClaimIntakeModal";
import { useClaims } from "../useClaims";

function KanbanViewContent() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { claims, isLoading, error, refetch, moveClaimToStatus } = useClaims();

  // Show the new claim intake modal directly from the board.
  const handleAddClaim = () => {
    setIsModalOpen(true);
  };

  return (
    <div className="h-[calc(100vh-3.5rem)] px-4 py-3 sm:px-6">
      <ClaimsKanbanBoard
        claims={claims}
        isLoading={isLoading}
        error={error}
        onRefresh={refetch}
        onAddClaim={handleAddClaim}
        onMoveClaim={moveClaimToStatus}
      />
      <ClaimIntakeModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default export
// ---------------------------------------------------------------------------

export default function KanbanView() {
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
      <KanbanViewContent />
    </Suspense>
  );
}

