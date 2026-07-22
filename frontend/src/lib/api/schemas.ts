import { z } from "zod";

export const AlertLocationSchema = z.object({
  id: z.number().optional(),
  alert_id: z.number().optional(),
  province: z.string().nullable().optional(),
  district: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  raw_location: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  match_confidence: z.string().nullable().optional(),
});

export const AlertSchema = z.object({
  id: z.number(),
  source_id: z.number().optional(),
  source_alert_id: z.string().nullable().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  hazard_type: z.string(),
  official_severity: z.string().nullable().optional(),
  normalized_severity: z.string(),
  issued_at: z.string().nullable().optional(),
  starts_at: z.string().nullable().optional(),
  expires_at: z.string().nullable().optional(),
  status: z.string(),
  source_url: z.string().nullable().optional(),
  raw_text: z.string().nullable().optional(),
  content_hash: z.string().nullable().optional(),
  validation_errors: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  locations: z.array(AlertLocationSchema).default([]),
  source: z.object({
    name: z.string(),
    base_url: z.string(),
  }).nullable().optional(),
});

export type Alert = z.infer<typeof AlertSchema>;
export type AlertLocation = z.infer<typeof AlertLocationSchema>;

export const SourceSchema = z.object({
  id: z.number(),
  name: z.string(),
  base_url: z.string(),
  scrape_url: z.string(),
  source_type: z.string(),
  is_active: z.boolean(),
  polling_interval_minutes: z.number(),
  last_checked_at: z.string().nullable().optional(),
  last_success_at: z.string().nullable().optional(),
  last_error: z.string().nullable().optional(),
  consecutive_failures: z.number(),
  health_status: z.string().optional(),
});

export type Source = z.infer<typeof SourceSchema>;

export const SummaryMetricsSchema = z.object({
  active_alerts_count: z.number(),
  critical_alerts_count: z.number(),
  affected_districts_count: z.number(),
  healthy_sources_count: z.number(),
  unhealthy_sources_count: z.number(),
  latest_update_time: z.string().nullable().optional(),
});

export type SummaryMetrics = z.infer<typeof SummaryMetricsSchema>;
