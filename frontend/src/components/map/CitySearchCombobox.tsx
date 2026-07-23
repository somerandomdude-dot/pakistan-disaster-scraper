"use client";

import { useState, useEffect, useRef, useId } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { searchPakistanCities, CityLocation } from "@/lib/data/pakistanLocations";
import { Search, X, MapPin, Loader2 } from "lucide-react";

interface CitySearchComboboxProps {
  onSelectCity?: (city: CityLocation | null) => void;
  className?: string;
}

export default function CitySearchCombobox({
  onSelectCity,
  className = "",
}: CitySearchComboboxProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const comboboxId = useId();

  const [query, setQuery] = useState(searchParams.get("city") || searchParams.get("district") || "");
  const [suggestions, setSuggestions] = useState<CityLocation[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [isSearching, setIsSearching] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync state with URL params
  useEffect(() => {
    const currentCity = searchParams.get("city") || searchParams.get("district") || "";
    setQuery(currentCity);
  }, [searchParams]);

  // Debounced search logic (~300ms)
  useEffect(() => {
    if (!query.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(() => {
      const results = searchPakistanCities(query, 8);
      setSuggestions(results);
      setIsOpen(true);
      setHighlightedIndex(results.length > 0 ? 0 : -1);
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  // Handle outside click to close dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = (city: CityLocation) => {
    setQuery(city.name);
    setIsOpen(false);
    setHighlightedIndex(-1);

    // Update URL params
    const params = new URLSearchParams(searchParams.toString());
    params.set("city", city.name);
    params.set("district", city.district);
    params.set("province", city.province);

    router.push(`/?${params.toString()}`, { scroll: false });

    if (onSelectCity) {
      onSelectCity(city);
    }
  };

  const handleClear = () => {
    setQuery("");
    setSuggestions([]);
    setIsOpen(false);
    setHighlightedIndex(-1);

    const params = new URLSearchParams(searchParams.toString());
    params.delete("city");
    params.delete("district");
    params.delete("province");

    router.push(`/?${params.toString()}`, { scroll: false });

    if (onSelectCity) {
      onSelectCity(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen || suggestions.length === 0) {
      if (e.key === "ArrowDown" && query.trim()) {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        break;
      case "Enter":
        e.preventDefault();
        if (highlightedIndex >= 0 && highlightedIndex < suggestions.length) {
          handleSelect(suggestions[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <label htmlFor={comboboxId} className="block text-xs font-semibold text-slate-700 mb-1">
        City / Location Search
      </label>
      
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400 pointer-events-none" />
        
        <input
          id={comboboxId}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={`${comboboxId}-listbox`}
          aria-activedescendant={
            highlightedIndex >= 0 ? `${comboboxId}-option-${highlightedIndex}` : undefined
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search city (e.g. Lahore, Karachi, Peshawar)..."
          className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
        />

        {isSearching && (
          <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 text-slate-400 animate-spin" />
        )}

        {!isSearching && query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 p-0.5 rounded-full"
            aria-label="Clear city search"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Autocomplete Dropdown Listbox */}
      {isOpen && (
        <ul
          id={`${comboboxId}-listbox`}
          role="listbox"
          className="absolute z-50 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto py-1 text-sm"
        >
          {suggestions.length > 0 ? (
            suggestions.map((item, index) => {
              const isHighlighted = index === highlightedIndex;
              return (
                <li
                  key={item.id}
                  id={`${comboboxId}-option-${index}`}
                  role="option"
                  aria-selected={isHighlighted}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`px-3 py-2 cursor-pointer flex items-center justify-between text-slate-800 transition-colors ${
                    isHighlighted ? "bg-blue-50 text-blue-900 font-medium" : "hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </div>
                  <span className="text-xs text-slate-500 font-normal shrink-0 ml-2">
                    {item.district}, {item.province}
                  </span>
                </li>
              );
            })
          ) : (
            <li className="px-3 py-3 text-xs text-slate-500 text-center italic">
              No matching city found
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
