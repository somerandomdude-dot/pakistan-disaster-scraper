import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import { Alert, Source } from "../api/schemas";
import { parseApiDate } from "../utils";

export function useActiveAlerts(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: ["alerts", "active", params],
    queryFn: () => api.getAlerts(params),
    refetchInterval: 10 * 1000, // Near instant auto-refetch every 10 seconds
    staleTime: 5 * 1000,
  });
}

export function useAlertHistory(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: ["alerts", "history", params],
    queryFn: () => api.getAlertHistory(params),
    staleTime: 30 * 1000,
  });
}

export function useAlertDetails(id: string | number) {
  return useQuery({
    queryKey: ["alerts", "detail", id],
    queryFn: () => api.getAlertDetails(id),
    enabled: !!id,
    staleTime: 30 * 1000,
  });
}

export function useSources() {
  return useQuery({
    queryKey: ["sources"],
    queryFn: () => api.getSources(),
    refetchInterval: 15 * 1000, // Auto-refetch source health every 15 seconds
    staleTime: 5 * 1000,
  });
}

export function useSummaryMetrics(alerts: Alert[] | undefined, sources: Source[] | undefined) {
  if (!alerts || !sources) return null;

  const active_alerts_count = alerts.filter((a: Alert) => a.status === "active").length;
  const critical_alerts_count = alerts.filter(
    (a: Alert) => a.normalized_severity === "critical" && a.status === "active"
  ).length;

  const affectedDistricts = new Set<string>();
  alerts.forEach((alert: Alert) => {
    alert.locations?.forEach((loc) => {
      if (loc.district) affectedDistricts.add(loc.district);
    });
  });

  const healthy_sources_count = sources.filter(
    (s: Source) => s.consecutive_failures === 0 && s.health_status !== "unhealthy"
  ).length;
  const unhealthy_sources_count = sources.filter(
    (s: Source) => s.consecutive_failures > 0 || s.health_status === "unhealthy"
  ).length;

  let latest_update_time: string | null | undefined = null;
  // Use the most recent last_checked_at timestamp across active sources
  const checkedTimes = sources
    .map((s: Source) => s.last_checked_at)
    .filter((t): t is string => Boolean(t));

  if (checkedTimes.length > 0) {
    const sorted = [...checkedTimes].sort(
      (a, b) => parseApiDate(b).getTime() - parseApiDate(a).getTime()
    );
    latest_update_time = sorted[0];
  } else if (alerts.length > 0) {
    const sorted = [...alerts].sort(
      (a: Alert, b: Alert) =>
        new Date(b.updated_at || b.issued_at || 0).getTime() -
        new Date(a.updated_at || a.issued_at || 0).getTime()
    );
    latest_update_time = sorted[0].updated_at || sorted[0].issued_at;
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
