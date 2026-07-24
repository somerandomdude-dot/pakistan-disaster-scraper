"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, Clock, Menu, X } from "lucide-react";

export default function AppHeader() {
  const pathname = usePathname();
  const [pktTime, setPktTime] = useState<string>("");
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      // Format to Pakistan Standard Time (Asia/Karachi)
      const formatted = new Intl.DateTimeFormat("en-PK", {
        timeZone: "Asia/Karachi",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }).format(now);
      setPktTime(formatted);
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { label: "Dashboard", href: "/" },
    { label: "Alerts", href: "/alerts" },
    { label: "Map", href: "/map" },
    { label: "Sources", href: "/sources" },
    { label: "History", href: "/history" },
  ];

  return (
    <header className="bg-[#0b172a] text-white sticky top-0 z-40 shadow-[0_1px_0_rgba(255,255,255,.08)]">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">
        
        {/* Brand & Disclaimer */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-red-600 text-white shadow-sm">
              <ShieldAlert className="h-[19px] w-[19px]" strokeWidth={2} />
            </div>
            <div>
              <h1 className="font-semibold text-white text-[15px] leading-none tracking-[-0.01em]">
                Pakistan Disaster Monitor
              </h1>
              <p className="text-[10px] text-slate-400 font-medium tracking-[0.08em] uppercase mt-1.5">
                Public advisory intelligence
              </p>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation Links & PKT Clock */}
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                    isActive
                      ? "bg-white/10 text-white"
                      : "text-slate-300 hover:text-white hover:bg-white/[0.06]"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {pktTime && (
            <div className="hidden xl:flex items-center gap-2 text-[11px] tabular-nums text-slate-300 border-l border-white/10 pl-4 ml-1">
              <Clock className="h-3.5 w-3.5 text-slate-500" />
              <span>{pktTime} PKT</span>
            </div>
          )}
          <button
            type="button"
            className="md:hidden grid h-9 w-9 place-items-center rounded-md text-slate-300 hover:bg-white/10 hover:text-white"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

      </div>
      {menuOpen && (
        <nav className="md:hidden border-t border-white/10 px-4 py-3">
          <div className="max-w-[1440px] mx-auto grid grid-cols-2 gap-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMenuOpen(false)}
                className={`rounded-md px-3 py-2.5 text-sm font-medium ${
                  pathname === item.href ? "bg-white/10 text-white" : "text-slate-300"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
