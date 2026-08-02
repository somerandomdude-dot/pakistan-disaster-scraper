import { Alert } from "../api/schemas";
import { isValidPakistanCoordinate } from "./mapUtils";

export const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
export const DEFAULT_CLOCK_SKEW_TOLERANCE_MS = 15 * 60 * 1000; // 15 minutes tolerance for clock drift

/**
 * Determine the primary effective event timestamp for an alert using strict priority:
 * 1. effective_event_at
 * 2. issued_at
 * 3. starts_at
 * 4. created_at
 *
 * CRITICAL RULE: updated_at MUST NEVER be used as the primary date,
 * ensuring editing an old alert cannot make it appear recent again.
 */
export function getEffectiveAlertTimestamp(
  alert?: Partial<Alert> | null
): Date | null {
  if (!alert) return null;

  const candidates = [
    alert.effective_event_at,
    alert.issued_at,
    alert.starts_at,
    alert.created_at,
  ];

  for (const candidate of candidates) {
    if (candidate) {
      const d = new Date(candidate);
      if (!Number.isNaN(d.getTime())) {
        return d;
      }
    }
  }

  return null;
}

/**
 * Checks if an alert has at least one valid coordinate inside Pakistan boundary.
 */
export function alertHasValidPakistanCoordinates(alert: Partial<Alert>): boolean {
  if (
    alert.latitude != null &&
    alert.longitude != null &&
    isValidPakistanCoordinate(alert.latitude, alert.longitude)
  ) {
    return true;
  }

  if (Array.isArray(alert.locations)) {
    return alert.locations.some(
      (loc) =>
        loc &&
        loc.latitude != null &&
        loc.longitude != null &&
        isValidPakistanCoordinate(loc.latitude, loc.longitude)
    );
  }

  return false;
}

/**
 * Checks if an alert is strictly within the rolling 7-day window.
 */
export function isAlertInSevenDayWindow(
  alert: Partial<Alert>,
  referenceDate: Date = new Date(),
  skewToleranceMs: number = DEFAULT_CLOCK_SKEW_TOLERANCE_MS
): boolean {
  const effectiveDate = getEffectiveAlertTimestamp(alert);
  if (!effectiveDate) return false;

  const effectiveMs = effectiveDate.getTime();
  const refMs = referenceDate.getTime();
  const cutoffMs = refMs - SEVEN_DAYS_MS;
  const maxFutureMs = refMs + skewToleranceMs;

  return effectiveMs >= cutoffMs && effectiveMs <= maxFutureMs;
}

export interface MapFilterOptions {
  showCancelled?: boolean;
  referenceDate?: Date;
  skewToleranceMs?: number;
}

/**
 * Filters alerts for the map to guarantee only verified, rolling 7-day alerts
 * with valid Pakistan coordinates are displayed.
 *
 * This acts as both the primary frontend map filter and a safety boundary
 * for markers, clusters, and map summaries.
 */
export function filterMapAlertsForSevenDays(
  alerts: Alert[] | undefined | null,
  options?: MapFilterOptions
): Alert[] {
  if (!alerts || !Array.isArray(alerts)) return [];

  const refDate = options?.referenceDate ?? new Date();
  const skewMs = options?.skewToleranceMs ?? DEFAULT_CLOCK_SKEW_TOLERANCE_MS;
  const showCancelled = options?.showCancelled ?? false;

  return alerts.filter((alert) => {
    if (!alert) return false;

    // 1. Status exclusion
    if (alert.status === "rejected" || alert.status === "invalid") {
      return false;
    }
    if (!showCancelled && alert.status === "cancelled") {
      return false;
    }

    // 2. Rolling 7-day timestamp window check
    if (!isAlertInSevenDayWindow(alert, refDate, skewMs)) {
      return false;
    }

    // 3. Coordinate validity in Pakistan
    if (!alertHasValidPakistanCoordinates(alert)) {
      return false;
    }

    return true;
  });
}

/**
 * Formats a timestamp into Pakistan Standard Time (PKT / UTC+5).
 * Example output: "2 Aug 2026, 04:00 PM PKT"
 */
export function formatPakistanDateTime(
  dateInput?: Date | string | number | null
): string {
  if (!dateInput) return "N/A";
  const date = typeof dateInput === "object" ? dateInput : new Date(dateInput);
  if (Number.isNaN(date.getTime())) return "N/A";

  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Karachi",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
    return `${formatter.format(date)} PKT`;
  } catch (e) {
    // Fallback if Intl timeZone is unsupported
    return `${date.toUTCString()}`;
  }
}

/**
 * Formats the rolling 7-day range label in Pakistan Standard Time.
 * Example output: "26 Jul 2026, 04:00 PM to 2 Aug 2026, 04:00 PM PKT"
 */
export function formatPakistanDateRange(
  referenceDate: Date = new Date()
): string {
  const refMs = referenceDate.getTime();
  const start = new Date(refMs - SEVEN_DAYS_MS);
  const end = new Date(refMs);

  const startFormatted = formatPakistanDateTime(start).replace(" PKT", "");
  const endFormatted = formatPakistanDateTime(end);

  return `${startFormatted} to ${endFormatted}`;
}
