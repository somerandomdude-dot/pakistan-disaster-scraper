"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "../shared/Card";
import { Search, SlidersHorizontal, X } from "lucide-react";

const HAZARD_TYPES = ["flood", "flash_flood", "heavy_rain", "thunderstorm", "cyclone", "heatwave", "earthquake", "landslide", "general_advisory"];
const SEVERITIES = ["critical", "high", "medium", "low", "unknown"];

export default function AlertFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [district, setDistrict] = useState(searchParams.get("district") || "");
  const [hazardType, setHazardType] = useState(searchParams.get("hazard_type") || "");
  const [severity, setSeverity] = useState(searchParams.get("severity") || "");
  
  // Debounce the district search
  useEffect(() => {
    const timer = setTimeout(() => {
      applyFilters();
    }, 500);
    return () => clearTimeout(timer);
  }, [district, hazardType, severity]);

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (district) params.set("district", district);
    else params.delete("district");
    
    if (hazardType) params.set("hazard_type", hazardType);
    else params.delete("hazard_type");
    
    if (severity) params.set("severity", severity);
    else params.delete("severity");
    
    // Only push if params changed
    const currentParamsStr = searchParams.toString();
    const newParamsStr = params.toString();
    
    if (currentParamsStr !== newParamsStr) {
      router.push(`/?${newParamsStr}`, { scroll: false });
    }
  };

  const clearFilters = () => {
    setDistrict("");
    setHazardType("");
    setSeverity("");
    router.push("/", { scroll: false });
  };

  const hasFilters = district || hazardType || severity;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2 text-slate-800 font-semibold">
            <SlidersHorizontal className="h-4 w-4" />
            <h3>Filters</h3>
          </div>
          {hasFilters && (
            <button 
              onClick={clearFilters}
              className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Reset
            </button>
          )}
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Search Location</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="District or City..."
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Hazard Type</label>
            <select
              value={hazardType}
              onChange={(e) => setHazardType(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="">All Hazards</option>
              {HAZARD_TYPES.map(t => (
                <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, l => l.toUpperCase())}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
            >
              <option value="">All Severities</option>
              {SEVERITIES.map(s => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
