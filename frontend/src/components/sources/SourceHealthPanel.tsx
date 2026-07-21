import { Source } from "@/lib/api/schemas";
import { Card, CardContent } from "../shared/Card";
import { Badge } from "../shared/Badge";
import { Activity, Clock, ServerCrash, CheckCircle2 } from "lucide-react";
import { getRelativeTime } from "@/lib/utils";

export default function SourceHealthPanel({ sources }: { sources: Source[] }) {
  if (!sources || sources.length === 0) return null;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-slate-800 font-semibold mb-4">
          <Activity className="h-4 w-4" />
          <h3>Source Health</h3>
        </div>
        
        <div className="space-y-3">
          {sources.map(source => {
            const isHealthy = source.consecutive_failures === 0 && source.health_status !== "unhealthy";
            
            return (
              <div key={source.id} className="flex flex-col gap-1 pb-3 border-b border-slate-100 last:border-0 last:pb-0">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-slate-900 truncate pr-2">{source.name}</span>
                  <Badge variant={isHealthy ? "healthy" : "unhealthy"} className="text-[10px] shrink-0">
                    {isHealthy ? "HEALTHY" : "UNHEALTHY"}
                  </Badge>
                </div>
                
                <div className="flex items-center text-xs text-slate-500 gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />
                  <span>Checked {getRelativeTime(source.last_checked_at)}</span>
                </div>
                
                {!isHealthy && source.consecutive_failures > 0 && (
                  <div className="flex items-start text-xs text-red-600 gap-1 mt-1 bg-red-50 p-1.5 rounded-sm">
                    <ServerCrash className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>Failing ({source.consecutive_failures}x): {source.last_error?.split('\n')[0] || "Unknown error"}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
