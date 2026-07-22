import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Alert, Source } from "../api/schemas";

export function useActiveAlerts(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: ["alerts", "active", params],
    queryFn: () => api.getAlerts(params),
    refetchInterval: 60 * 1000, // Refresh every 60 seconds as per requirements
    staleTime: 30 * 1000,
  });
}

export function useAlertHistory(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: ["alerts", "history", params],
    queryFn: () => api.getAlertHistory(params),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useAlertDetails(id: string | number) {
  return useQuery({
    queryKey: ["alerts", "detail", id],
    queryFn: () => api.getAlertDetails(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSources() {
  return useQuery({
    queryKey: ["sources"],
    queryFn: () => api.getSources(),
    refetchInterval: 2 * 60 * 1000, // Refresh every 2 minutes
    staleTime: 60 * 1000,
  });
}

export function useSummaryMetrics(alerts: Alert[] | undefined, sources: Source[] | undefined) {
  if (!alerts || !sources) return null;

  const active_alerts_count = alerts.filter(a => a.status === "active").length;
  const critical_alerts_count = alerts.filter(a => a.normalized_severity === "critical" && a.status === "active").length;
  
  const affectedDistricts = new Set<string>();
  alerts.forEach(alert => {
    alert.locations?.forEach(loc => {
      if (loc.district) affectedDistricts.add(loc.district);
    });
  });

  const healthy_sources_count = sources.filter(s => s.consecutive_failures === 0 || s.health_status === "healthy").length;
  const unhealthy_sources_count = sources.filter(s => s.consecutive_failures > 0 || s.health_status === "unhealthy").length;

  let latest_update_time = null;
  if (alerts.length > 0) {
    const sorted = [...alerts].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
    latest_update_time = sorted[0].updated_at;
  }

  return {
    active_alerts_count,
    critical_alerts_count,
    affected_districts_count: affectedDistricts.size,
    healthy_sources_count,
    unhealthy_sources_count,
    latest_update_time,
  };
}
