"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "lucide-react";

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
  showIcon?: boolean;
  iconClassName?: string;
}

export default function Tooltip({
  content,
  children,
  position = "top",
  showIcon = true,
  iconClassName = "",
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Detect mobile devices
    setIsMobile(window.innerWidth < 768);
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const updatePosition = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      
      let top = 0;
      let left = 0;
      
      switch (position) {
        case "top":
          top = rect.top + scrollY - 8; // 8px gap
          left = rect.left + scrollX + rect.width / 2;
          break;
        case "bottom":
          top = rect.bottom + scrollY + 8;
          left = rect.left + scrollX + rect.width / 2;
          break;
        case "left":
          top = rect.top + scrollY + rect.height / 2;
          left = rect.left + scrollX - 8;
          break;
        case "right":
          top = rect.top + scrollY + rect.height / 2;
          left = rect.right + scrollX + 8;
          break;
      }
      
      setTooltipPos({ top, left });
    }
  };

  const handleMouseEnter = () => {
    if (!isMobile) {
      updatePosition();
      timeoutRef.current = setTimeout(() => setIsVisible(true), 200);
    }
  };

  const handleMouseLeave = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const handleClick = () => {
    if (isMobile) {
      updatePosition();
      setIsVisible(!isVisible);
    }
  };

  const getPositionClasses = () => {
    switch (position) {
      case "top":
        return "-translate-x-1/2 -translate-y-full";
      case "bottom":
        return "-translate-x-1/2";
      case "left":
        return "-translate-x-full -translate-y-1/2";
      case "right":
        return "-translate-y-1/2";
      default:
        return "";
    }
  };

  const arrowClasses = {
    top: "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-slate-800",
    bottom:
      "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-slate-800",
    left: "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-slate-800",
    right:
      "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-slate-800",
  };

  const tooltipContent = isVisible && (
    <>
      {/* Overlay for mobile to close tooltip */}
      {isMobile && (
        <div
          className="fixed inset-0 z-9998"
          onClick={() => setIsVisible(false)}
        />
      )}

      {/* Tooltip */}
      <div
        className={`fixed z-9999 max-w-sm rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-lg ${getPositionClasses()} animate-in fade-in-0 zoom-in-95 duration-200`}
        style={{ 
          top: `${tooltipPos.top}px`,
          left: `${tooltipPos.left}px`,
          whiteSpace: "normal"
        }}
      >
        {content}
        {/* Arrow */}
        <div
          className={`absolute h-0 w-0 border-4 ${arrowClasses[position]}`}
        />
      </div>
    </>
  );

  return (
    <>
      <div 
        ref={triggerRef}
        className="inline-flex items-center"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        <div className="cursor-help">
          {children || (
            <HelpCircle
              className={`h-4 w-4 text-slate-400 hover:text-slate-600 transition-colors ${iconClassName}`}
            />
          )}
        </div>
      </div>

      {typeof window !== 'undefined' && createPortal(tooltipContent, document.body)}
    </>
  );
}
