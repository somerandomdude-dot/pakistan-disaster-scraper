"use client";

import { useSources } from "@/lib/hooks/queries";
import SourceHealthPanel from "@/components/sources/SourceHealthPanel";

export default function SourcesPage() {
  const { data: sources, isLoading, error } = useSources();

  return (
    <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 leading-tight">Connected Data Sources</h1>
        <p className="text-slate-500 mt-1">Status of the automated scraper connections to official government websites.</p>
      </div>
      
      <div className="max-w-3xl">
        {isLoading ? (
          <div className="p-8 text-center animate-pulse bg-white border border-slate-200 rounded-md">Loading sources...</div>
        ) : error ? (
          <div className="p-8 text-center text-red-500 bg-white border border-slate-200 rounded-md">Failed to load sources.</div>
        ) : (
          <SourceHealthPanel sources={sources || []} />
        )}
      </div>
    </div>
  );
}
