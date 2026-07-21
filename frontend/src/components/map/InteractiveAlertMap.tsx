"use client";

import dynamic from "next/dynamic";
import { Alert } from "@/lib/api/schemas";

// Dynamic import with ssr: false to prevent Next.js from rendering Leaflet on the server
const MapWithNoSSR = dynamic(() => import("./MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full min-h-[400px] bg-slate-100 flex items-center justify-center border border-slate-200 rounded-md">
      <div className="text-slate-500 animate-pulse font-medium">Loading Map...</div>
    </div>
  ),
});

export default function InteractiveAlertMap({ alerts }: { alerts: Alert[] }) {
  return <MapWithNoSSR alerts={alerts} />;
}
