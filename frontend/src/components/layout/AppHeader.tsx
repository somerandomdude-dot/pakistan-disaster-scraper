"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldAlert, Clock } from "lucide-react";

export default function AppHeader() {
  const pathname = usePathname();
  const [pktTime, setPktTime] = useState<string>("");

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
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Brand & Disclaimer */}
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="p-1.5 bg-blue-900 text-white rounded-md group-hover:bg-blue-800 transition-colors">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 text-base leading-none tracking-tight">
                Disaster Alert Pakistan
              </h1>
              <p className="text-[10px] text-slate-500 font-medium tracking-wide mt-0.5">
                Unofficial alert dashboard using publicly available official sources
              </p>
            </div>
          </Link>
        </div>

        {/* Desktop Navigation Links & PKT Clock */}
        <div className="flex items-center gap-4">
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                    isActive
                      ? "bg-slate-100 text-blue-900"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {pktTime && (
            <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded">
              <Clock className="h-3 w-3 text-slate-500" />
              <span>{pktTime} PKT</span>
            </div>
          )}
        </div>

      </div>
    </header>
  );
}
