"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "../shared/Card";
import CitySearchCombobox from "../map/CitySearchCombobox";
import { CityLocation } from "@/lib/data/pakistanLocations";
import { SlidersHorizontal, RotateCcw } from "lucide-react";

const PROVINCES = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Gilgit-Baltistan",
  "Azad Jammu & Kashmir",
  "Islamabad Capital Territory",
];

const HAZARD_TYPES = [
  "flood",
  "flash_flood",
  "heavy_rain",
  "thunderstorm",
  "cyclone",
  "heatwave",
  "earthquake",
  "landslide",
  "general_advisory",
];

const SEVERITIES = ["critical", "high", "medium", "low", "unknown"];

interface AlertFiltersProps {
  onSelectCityCoords?: (coords: { lat: number; lng: number } | null) => void;
}

export default function AlertFilters({ onSelectCityCoords }: AlertFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [province, setProvince] = useState(searchParams.get("province") || "");
  const [hazardType, setHazardType] = useState(searchParams.get("hazard_type") || "");
  const [severity, setSeverity] = useState(searchParams.get("severity") || "");
  const [status, setStatus] = useState(searchParams.get("status") || "");

  // Update state when URL searchParams change
  useEffect(() => {
    setProvince(searchParams.get("province") || "");
    setHazardType(searchParams.get("hazard_type") || "");
    setSeverity(searchParams.get("severity") || "");
    setStatus(searchParams.get("status") || "");
  }, [searchParams]);

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/?${params.toString()}`, { scroll: false });
  };

  const handleCitySelect = (city: CityLocation | null) => {
    if (city && city.latitude && city.longitude && onSelectCityCoords) {
      onSelectCityCoords({ lat: city.latitude, lng: city.longitude });
    } else if (onSelectCityCoords) {
      onSelectCityCoords(null);
    }
  };

  const handleReset = () => {
    setProvince("");
    setHazardType("");
    setSeverity("");
    setStatus("");

    router.push("/", { scroll: false });

    if (onSelectCityCoords) {
      onSelectCityCoords(null);
    }
  };

  const hasActiveFilters =
    searchParams.has("city") ||
    searchParams.has("district") ||
    searchParams.has("province") ||
    searchParams.has("hazard_type") ||
    searchParams.has("severity") ||
    searchParams.has("status");

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2 text-slate-900 font-semibold text-sm">
            <SlidersHorizontal className="h-4 w-4 text-slate-500" />
            <h3>Filter advisories</h3>
          </div>
          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="text-xs text-slate-500 hover:text-slate-900 flex items-center gap-1 font-medium transition-colors"
            >
              <RotateCcw className="h-3 w-3" /> Reset
            </button>
          )}
        </div>

        {/* City Search Combobox */}
        <CitySearchCombobox onSelectCity={handleCitySelect} />

        {/* Province Select */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Province / Region
          </label>
          <select
            value={province}
            onChange={(e) => updateParam("province", e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
          >
            <option value="">All Provinces</option>
            {PROVINCES.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        </div>

        {/* Hazard Type Select */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Hazard Category
          </label>
          <select
            value={hazardType}
            onChange={(e) => updateParam("hazard_type", e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
          >
            <option value="">All Hazard Types</option>
            {HAZARD_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        {/* Severity Select */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Severity Level
          </label>
          <select
            value={severity}
            onChange={(e) => updateParam("severity", e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
          >
            <option value="">All Severities</option>
            {SEVERITIES.map((s) => (
              <option key={s} value={s}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </option>
            ))}
          </select>
        </div>

        {/* Status Select */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Alert Status
          </label>
          <select
            value={status}
            onChange={(e) => updateParam("status", e.target.value)}
            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 transition-all"
          >
            <option value="">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="expired">Expired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

      </CardContent>
    </Card>
  );
}
