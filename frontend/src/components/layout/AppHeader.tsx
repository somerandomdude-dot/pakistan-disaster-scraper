import Link from "next/link";
import { ShieldAlert } from "lucide-react";

export default function AppHeader() {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ShieldAlert className="h-6 w-6 text-blue-600" />
          <div>
            <h1 className="font-semibold text-slate-900 text-lg leading-tight">
              Disaster Alert Pakistan
            </h1>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide font-medium">
              Unofficial Dashboard
            </p>
          </div>
        </div>
        
        <nav className="hidden md:flex gap-6">
          <Link href="/" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            Dashboard
          </Link>
          <Link href="/alerts" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            All Alerts
          </Link>
          <Link href="/map" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            Map
          </Link>
          <Link href="/sources" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            Sources
          </Link>
          <Link href="/history" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
            History
          </Link>
        </nav>
      </div>
    </header>
  );
}
