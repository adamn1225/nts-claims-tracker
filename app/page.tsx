import Link from "next/link";
import { TrendingUp, Target, Zap } from "lucide-react";
import Image from "next/image";

export default function Home() {
  return (
    <div className="relative flex h-screen w-full flex-col items-center justify-center overflow-hidden bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 px-4 sm:px-6 lg:px-8">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-4 top-1/4 h-72 w-72 rounded-full bg-[#E85D04]/10 blur-3xl" />
        <div className="absolute -right-4 bottom-1/4 h-96 w-96 rounded-full bg-[#FFA726]/10 blur-3xl" />
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center justify-center text-center max-w-4xl">
        {/* Logo */}
        <div className="mx-auto mb-6 flex items-center justify-center sm:mb-8">
          <div className="relative h-24 w-24 sm:h-32 sm:w-32 md:h-56 md:w-56">
        <Image
          src="/NTS-logo.svg"
          alt="NTS Logo"
          fill
          className="object-contain drop-shadow-2xl"
          priority
        />
          </div>
        </div>

        {/* Headline */}
        <h1 className="mb-3 bg-linear-to-r from-white via-slate-100 to-slate-300 bg-clip-text text-3xl font-extrabold tracking-tight text-transparent sm:mb-4 sm:text-5xl lg:text-6xl">
          NTS Claims Tracker
        </h1>

        <p className="mb-2 text-base font-semibold text-[#FFA726] sm:mb-3 sm:text-xl">
          Nationwide Transport Services
        </p>

        <p className="mx-auto mb-8 max-w-2xl px-2 text-sm leading-relaxed text-slate-300 sm:mb-10 sm:text-lg">
          Turn every customer interaction into opportunity. Track your book of
          business, never miss a follow-up, and close more deals—all in one
          powerful platform.
        </p>

        {/* Feature highlights */}
        <div className="mb-8 w-full max-w-lg gap-3 space-y-3 sm:mb-10 sm:grid sm:grid-cols-3 sm:space-y-0 sm:gap-6">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 backdrop-blur-sm sm:p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E85D04]/20 shrink-0">
          <Target className="h-5 w-5 text-[#E85D04]" />
        </div>
        <p className="text-xs font-semibold text-white sm:text-sm">Stay Organized</p>
        <p className="text-xs text-slate-400">
          Never lose track of a prospect
        </p>
          </div>

          <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 backdrop-blur-sm sm:p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E85D04]/20 shrink-0">
          <Zap className="h-5 w-5 text-[#E85D04]" />
        </div>
        <p className="text-xs font-semibold text-white sm:text-sm">Work Smarter</p>
        <p className="text-xs text-slate-400">Automate your follow-ups</p>
          </div>

          <div className="flex flex-col items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/30 p-3 backdrop-blur-sm sm:p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E85D04]/20 shrink-0">
          <TrendingUp className="h-5 w-5 text-[#E85D04]" />
        </div>
        <p className="text-xs font-semibold text-white sm:text-sm">Close More Deals</p>
        <p className="text-xs text-slate-400">
          Convert prospects to customers
        </p>
          </div>
        </div>

        {/* CTA Button */}
        <div className="w-full max-w-sm px-2">
          <Link
        href="/auth/login"
        className="group relative inline-flex w-full items-center justify-center overflow-hidden rounded-lg bg-linear-to-r from-[#E85D04] to-[#FFA726] px-6 py-3 text-base font-bold text-white shadow-2xl transition-all duration-300 active:scale-95 hover:scale-105 hover:shadow-[#E85D04]/50 focus:outline-none focus:ring-4 focus:ring-[#E85D04]/50 sm:px-10 sm:py-4 sm:text-lg"
          >
        <span className="relative z-10">Start Tracking Sales</span>
        <div className="absolute inset-0 bg-linear-to-r from-[#C74E03] to-[#E85D04] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          </Link>
        </div>

        {/* Footer */}
        <p className="mt-8 px-2 text-xs text-slate-500 sm:mt-10">
          © 2026 Nationwide Transport Services. All rights reserved.
        </p>
      </div>
    </div>
  );
}
