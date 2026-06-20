"use client";

import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

export interface TourStep {
  target: string; // CSS selector
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
  action?: (router?: AppRouterInstance) => void; // Optional action to perform when step starts
}

interface TourGuideProps {
  steps: TourStep[];
  isOpen: boolean;
  onComplete: () => void;
  onSkip: () => void;
  router?: AppRouterInstance;
}

export default function TourGuide({
  steps,
  isOpen,
  onComplete,
  onSkip,
  router,
}: TourGuideProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!isOpen || !steps[currentStep]) return;

    const step = steps[currentStep];

    // Execute step action if defined
    if (step.action) {
      step.action(router);
    }

    // Find target element (skip if no target specified)
    if (!step.target) {
      setTargetElement(null);
      return;
    }

    const element = document.querySelector(step.target) as HTMLElement;
    if (!element) {
      console.warn(`Tour target not found: ${step.target}`);
      // Center the card if element not found
      setTargetElement(null);
      return;
    }

    setTargetElement(element);

    // Calculate position
    const updatePosition = () => {
      const rect = element.getBoundingClientRect();
      const placement = step.placement || "bottom";
      const cardWidth = 448; // max-w-md = 28rem = 448px
      const cardHeight = 300; // approximate height
      const padding = 20; // padding from viewport edges

      let top = 0;
      let left = 0;

      switch (placement) {
        case "top":
          top = rect.top + window.scrollY - cardHeight - 20;
          left = rect.left + window.scrollX + rect.width / 2;
          break;
        case "bottom":
          top = rect.bottom + window.scrollY + 20;
          left = rect.left + window.scrollX + rect.width / 2;
          break;
        case "left":
          top = rect.top + window.scrollY + rect.height / 2;
          left = rect.left + window.scrollX - cardWidth / 2 - 20;
          break;
        case "right":
          top = rect.top + window.scrollY + rect.height / 2;
          // For sidebar items, position card completely to the right of the sidebar
          const rightOffset = rect.left < 300 ? 200 : 20;
          left = rect.right + window.scrollX + cardWidth / 2 + rightOffset;
          break;
      }

      // Ensure card stays within viewport bounds
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // Constrain horizontal position
      // For right placement near left edge (sidebar items), ensure card doesn't go off-screen
      let minLeft = padding + cardWidth / 2;

      // If placing to the right of a left-edge element, adjust minimum
      if (placement === "right" && rect.left < 300) {
        // Element is on the left side (likely sidebar), ensure card is completely right of sidebar
        // Sidebar is typically 224px (lg:w-56), card is 448px, so center should be at 224 + 224 + gap
        minLeft = 400 + cardWidth / 2 + 40; // sidebar width + half card + 40px gap
      }

      const maxLeft = viewportWidth - padding - cardWidth / 2;
      left = Math.max(minLeft, Math.min(left, maxLeft));

      // Constrain vertical position (account for scroll)
      const minTop = window.scrollY + padding;
      const maxTop = window.scrollY + viewportHeight - cardHeight - padding;
      top = Math.max(minTop, Math.min(top, maxTop));

      setPosition({ top, left });

      // Scroll element into view
      element.scrollIntoView({ behavior: "smooth", block: "center" });
    };

    updatePosition();

    // Update position on resize/scroll
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    // Highlight element with pulse animation
    element.style.position = "relative";
    element.style.zIndex = "1000";
    element.style.boxShadow = "0 0 0 4px rgba(234, 88, 12, 0.8)";
    element.style.borderRadius = "8px";
    element.style.transition = "all 0.3s ease";
    element.style.animation =
      "tour-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite";

    // Add pulse animation to document if not already added
    if (!document.getElementById("tour-pulse-keyframes")) {
      const style = document.createElement("style");
      style.id = "tour-pulse-keyframes";
      style.textContent = `
        @keyframes tour-pulse {
          0%, 100% {
            box-shadow: 0 0 0 4px rgba(234, 88, 12, 0.8);
          }
          50% {
            box-shadow: 0 0 0 8px rgba(234, 88, 12, 0.4);
          }
        }
      `;
      document.head.appendChild(style);
    }

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);

      // Remove highlight
      element.style.position = "";
      element.style.zIndex = "";
      element.style.boxShadow = "";
      element.style.animation = "";
    };
  }, [currentStep, isOpen, steps]);

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    onSkip();
  };

  if (!isOpen || !steps[currentStep]) return null;

  const step = steps[currentStep];
  const isLastStep = currentStep === steps.length - 1;

  return (
    <>
      {/* Backdrop - Very subtle to see UI elements */}
      <div
        className="fixed inset-0 bg-slate-900/20"
        style={{ zIndex: 9999 }}
        onClick={handleSkip}
      />

      {/* Tour Card */}
      <div
        className="fixed w-full max-w-md -translate-x-1/2 rounded-lg border border-orange-200 bg-white shadow-2xl"
        style={{
          zIndex: 10000,
          top: targetElement ? `${position.top}px` : "120px",
          left: targetElement ? `${position.left}px` : "50%",
          transform: targetElement ? "translateX(-50%)" : "translateX(-50%)",
        }}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 p-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900">
              {step.title}
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              Step {currentStep + 1} of {steps.length}
            </p>
          </div>
          <button
            onClick={handleSkip}
            className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Skip tour"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          <p className="text-sm text-slate-700">{step.content}</p>
        </div>

        {/* Footer */}
        <div className="space-y-3 border-t border-slate-200 p-4">
          {/* Progress & Navigation */}
          <div className="flex items-center justify-between">
            <div className="flex gap-1">
              {steps.map((_, index) => (
                <div
                  key={index}
                  className={`h-1.5 w-8 rounded-full transition-colors ${
                    index === currentStep
                      ? "bg-orange-500"
                      : index < currentStep
                        ? "bg-orange-300"
                        : "bg-slate-200"
                  }`}
                />
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevious}
                disabled={currentStep === 0}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <button
                onClick={handleNext}
                className="flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-orange-600"
              >
                {isLastStep ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Finish
                  </>
                ) : (
                  <>
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Skip Forever Button */}
          <div className="flex items-center justify-center">
            <button
              onClick={handleSkip}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              Don't show this tour again
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
