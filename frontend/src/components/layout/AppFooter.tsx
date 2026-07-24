import Link from "next/link";
import { ShieldAlert, ExternalLink } from "lucide-react";

export default function AppFooter() {
  return (
    <footer className="bg-[#0b172a] border-t border-slate-800 mt-12 py-10 px-4 sm:px-6 lg:px-8 text-xs text-slate-400">
      <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row justify-between items-start gap-8">
        
        <div className="space-y-1 max-w-xl">
          <div className="flex items-center gap-2 font-semibold text-white text-sm">
            <ShieldAlert className="h-4 w-4 text-red-500" />
            <span>Pakistan Disaster Monitor</span>
          </div>
          <p className="leading-relaxed">
            Unofficial public information platform collecting disaster advisories from publicly available official sources (NDMA, PMD, NSMC, FFD). Always verify critical emergency information through the linked official sources.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-10 text-slate-400 font-medium">
          <div className="space-y-1">
            <span className="block font-semibold text-slate-200 text-[11px] uppercase tracking-wider">Connected sources</span>
            <ul className="space-y-1">
              <li><a href="http://www.pmd.gov.pk/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-900 inline-flex items-center gap-1">PMD Pakistan <ExternalLink className="h-3 w-3" /></a></li>
              <li><a href="http://www.ndma.gov.pk/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-900 inline-flex items-center gap-1">NDMA Official <ExternalLink className="h-3 w-3" /></a></li>
              <li><a href="http://ffd.pmd.gov.pk/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-900 inline-flex items-center gap-1">Flood Forecasting Division <ExternalLink className="h-3 w-3" /></a></li>
            </ul>
          </div>

          <div className="space-y-1">
            <span className="block font-semibold text-slate-200 text-[11px] uppercase tracking-wider">Navigation</span>
            <ul className="space-y-1">
              <li><Link href="/" className="hover:text-blue-900">Dashboard</Link></li>
              <li><Link href="/alerts" className="hover:text-blue-900">All Active Advisories</Link></li>
              <li><Link href="/map" className="hover:text-blue-900">Interactive Map</Link></li>
              <li><Link href="/sources" className="hover:text-blue-900">Scraper Source Health</Link></li>
              <li><Link href="/history" className="hover:text-blue-900">Historical Log</Link></li>
            </ul>
          </div>
        </div>

      </div>

      <div className="max-w-[1440px] mx-auto border-t border-white/10 mt-8 pt-5 flex flex-col sm:flex-row justify-between items-center text-[11px] text-slate-500 gap-2">
        <span>Data updated directly from connected scraper backends.</span>
        <span>Built for public safety and civic awareness.</span>
      </div>
    </footer>
  );
}
