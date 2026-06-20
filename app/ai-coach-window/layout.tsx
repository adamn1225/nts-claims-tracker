import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Sales Coach - NTS Claims Tracker",
  description: "AI-powered sales coaching assistant",
};

/**
 * Minimal layout for pop-out AI Coach window
 * No navigation, no sidebar - just the coach interface
 */
export default function AiCoachWindowLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
