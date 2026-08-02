import { describe, it, expect } from "vitest";
import {
  getEffectiveAlertTimestamp,
  isAlertInSevenDayWindow,
  filterMapAlertsForSevenDays,
  formatPakistanDateTime,
  formatPakistanDateRange,
  SEVEN_DAYS_MS,
} from "../lib/utils/alertTime";
import { Alert } from "../lib/api/schemas";

describe("alertTime Utilities - 7-Day Rolling Window Map Filter", () => {
  const FIXED_NOW = new Date("2026-08-02T11:00:00.000Z"); // 16:00 PKT on 2 Aug 2026

  const baseAlert: Alert = {
    id: 1,
    title: "Heavy Rainfall Warning",
    description: "Flooding risk in river basins",
    hazard_type: "flood",
    official_severity: "High",
    normalized_severity: "high",
    status: "active",
    issued_at: "2026-08-01T10:00:00.000Z", // 1 day ago
    latitude: 33.6844,
    longitude: 73.0479, // Islamabad
    locations: [
      {
        id: 101,
        alert_id: 1,
        raw_location: "Islamabad",
        province: "Federal",
        district: "Islamabad",
        latitude: 33.6844,
        longitude: 73.0479,
      },
    ],
  };

  describe("getEffectiveAlertTimestamp", () => {
    it("prioritizes effective_event_at over issued_at, starts_at, and created_at", () => {
      const alert: Partial<Alert> = {
        effective_event_at: "2026-08-01T08:00:00.000Z",
        issued_at: "2026-07-30T08:00:00.000Z",
        starts_at: "2026-07-29T08:00:00.000Z",
        created_at: "2026-07-28T08:00:00.000Z",
        updated_at: "2026-08-02T10:55:00.000Z", // Stale edit, must NOT be used
      };
      const result = getEffectiveAlertTimestamp(alert);
      expect(result?.toISOString()).toBe("2026-08-01T08:00:00.000Z");
    });

    it("falls back to issued_at when effective_event_at is missing", () => {
      const alert: Partial<Alert> = {
        issued_at: "2026-07-31T05:00:00.000Z",
        starts_at: "2026-07-29T05:00:00.000Z",
      };
      const result = getEffectiveAlertTimestamp(alert);
      expect(result?.toISOString()).toBe("2026-07-31T05:00:00.000Z");
    });

    it("falls back to starts_at when issued_at is missing", () => {
      const alert: Partial<Alert> = {
        starts_at: "2026-07-30T12:00:00.000Z",
      };
      const result = getEffectiveAlertTimestamp(alert);
      expect(result?.toISOString()).toBe("2026-07-30T12:00:00.000Z");
    });

    it("falls back to created_at when other event timestamps are missing", () => {
      const alert: Partial<Alert> = {
        created_at: "2026-07-29T12:00:00.000Z",
      };
      const result = getEffectiveAlertTimestamp(alert);
      expect(result?.toISOString()).toBe("2026-07-29T12:00:00.000Z");
    });

    it("NEVER uses updated_at even if updated_at is recent and all other timestamps are old", () => {
      const oldAlert: Partial<Alert> = {
        issued_at: "2026-07-01T00:00:00.000Z", // 32 days ago
        updated_at: "2026-08-02T10:00:00.000Z", // 1 hour ago
      };
      const result = getEffectiveAlertTimestamp(oldAlert);
      expect(result?.toISOString()).toBe("2026-07-01T00:00:00.000Z");
    });

    it("returns null if no timestamps are present or if invalid", () => {
      expect(getEffectiveAlertTimestamp(null)).toBeNull();
      expect(getEffectiveAlertTimestamp({})).toBeNull();
      expect(getEffectiveAlertTimestamp({ issued_at: "not-a-valid-date" })).toBeNull();
    });
  });

  describe("isAlertInSevenDayWindow", () => {
    it("returns true for an alert issued 1 day ago", () => {
      const alert = { ...baseAlert, issued_at: "2026-08-01T11:00:00.000Z" };
      expect(isAlertInSevenDayWindow(alert, FIXED_NOW)).toBe(true);
    });

    it("returns true for an alert issued exactly on cutoff boundary (7 days ago)", () => {
      const exactly7DaysAgo = new Date(FIXED_NOW.getTime() - SEVEN_DAYS_MS).toISOString();
      const alert = { ...baseAlert, issued_at: exactly7DaysAgo };
      expect(isAlertInSevenDayWindow(alert, FIXED_NOW)).toBe(true);
    });

    it("returns false for an alert issued 7 days and 10 minutes ago", () => {
      const pastCutoff = new Date(FIXED_NOW.getTime() - SEVEN_DAYS_MS - 10 * 60 * 1000).toISOString();
      const alert = { ...baseAlert, issued_at: pastCutoff };
      expect(isAlertInSevenDayWindow(alert, FIXED_NOW)).toBe(false);
    });

    it("returns false for an alert issued 30 days ago", () => {
      const oldAlert = { ...baseAlert, issued_at: "2026-07-02T11:00:00.000Z" };
      expect(isAlertInSevenDayWindow(oldAlert, FIXED_NOW)).toBe(false);
    });

    it("returns true for near-future alerts within clock skew tolerance (e.g. 5 min future)", () => {
      const nearFuture = new Date(FIXED_NOW.getTime() + 5 * 60 * 1000).toISOString();
      const alert = { ...baseAlert, issued_at: nearFuture };
      expect(isAlertInSevenDayWindow(alert, FIXED_NOW)).toBe(true);
    });

    it("returns false for far-future anomaly alerts (e.g. 2 hours future)", () => {
      const farFuture = new Date(FIXED_NOW.getTime() + 2 * 60 * 60 * 1000).toISOString();
      const alert = { ...baseAlert, issued_at: farFuture };
      expect(isAlertInSevenDayWindow(alert, FIXED_NOW)).toBe(false);
    });
  });

  describe("filterMapAlertsForSevenDays", () => {
    it("filters out alerts older than 7 days, keeping recent ones", () => {
      const recentAlert: Alert = {
        ...baseAlert,
        id: 1,
        issued_at: "2026-08-01T10:00:00.000Z", // 1 day ago
      };
      const oldAlert: Alert = {
        ...baseAlert,
        id: 2,
        issued_at: "2026-07-20T10:00:00.000Z", // 13 days ago
      };

      const result = filterMapAlertsForSevenDays([recentAlert, oldAlert], {
        referenceDate: FIXED_NOW,
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it("filters out rejected, invalid, and cancelled alerts", () => {
      const activeAlert: Alert = { ...baseAlert, id: 1, status: "active" };
      const pendingAlert: Alert = { ...baseAlert, id: 2, status: "pending" };
      const rejectedAlert: Alert = { ...baseAlert, id: 3, status: "rejected" };
      const invalidAlert: Alert = { ...baseAlert, id: 4, status: "invalid" };
      const cancelledAlert: Alert = { ...baseAlert, id: 5, status: "cancelled" };

      const result = filterMapAlertsForSevenDays(
        [activeAlert, pendingAlert, rejectedAlert, invalidAlert, cancelledAlert],
        { referenceDate: FIXED_NOW }
      );
      expect(result).toHaveLength(2);
      expect(result.map((a) => a.id)).toEqual([1, 2]);
    });

    it("includes cancelled alerts if showCancelled is explicitly true", () => {
      const cancelledAlert: Alert = { ...baseAlert, id: 5, status: "cancelled" };
      const result = filterMapAlertsForSevenDays([cancelledAlert], {
        referenceDate: FIXED_NOW,
        showCancelled: true,
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(5);
    });

    it("filters out alerts with coordinates outside Pakistan bounds or at (0,0)", () => {
      const validPakAlert: Alert = {
        ...baseAlert,
        id: 1,
        latitude: 31.5204,
        longitude: 74.3587, // Lahore
        locations: [],
      };
      const nullIslandAlert: Alert = {
        ...baseAlert,
        id: 2,
        latitude: 0,
        longitude: 0,
        locations: [],
      };
      const londonAlert: Alert = {
        ...baseAlert,
        id: 3,
        latitude: 51.5074,
        longitude: -0.1278, // London
        locations: [],
      };

      const result = filterMapAlertsForSevenDays(
        [validPakAlert, nullIslandAlert, londonAlert],
        { referenceDate: FIXED_NOW }
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  describe("Time Formatting (PKT)", () => {
    it("formats timestamp in Pakistan Standard Time (UTC+5)", () => {
      const formatted = formatPakistanDateTime(FIXED_NOW);
      // 11:00 UTC is 16:00 (4:00 PM) PKT
      expect(formatted).toContain("PKT");
      expect(formatted).toContain("2026");
      expect(formatted).toContain("04:00 pm");
    });

    it("formats 7-day rolling date range in PKT", () => {
      const range = formatPakistanDateRange(FIXED_NOW);
      expect(range).toContain("PKT");
      expect(range).toContain("to");
    });
  });
});
