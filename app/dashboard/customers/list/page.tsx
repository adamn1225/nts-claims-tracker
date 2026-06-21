"use client";

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import ClaimsListView from "@/components/ClaimsListView";
import { useClaims } from "../useClaims";

function ListViewContent() {
  const router = useRouter();
  const { claims, isLoading, error, refetch } = useClaims();

  // Same intake flow as the kanban view — claims enter through the public
  // intake form → triage queue → promote. The internal "create claim" modal
  // will replace this in a follow-up.
  const handleAddClaim = () => {
    router.push("/dashboard/claims/intake");
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
