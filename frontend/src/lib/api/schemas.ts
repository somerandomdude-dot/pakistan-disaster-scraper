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
  location_id: z.string().nullable().optional(),
  entity_type: z.string().nullable().optional(),
  canonical_name: z.string().nullable().optional(),
  tehsil: z.string().nullable().optional(),
  matched_text: z.string().nullable().optional(),
  text_source: z.string().nullable().optional(),
  match_method: z.string().nullable().optional(),
  start_offset: z.number().nullable().optional(),
  end_offset: z.number().nullable().optional(),
  evidence_score: z.number().nullable().optional(),
});

export const RiverConditionSchema = z.object({
  river: z.string(),
  station: z.string().nullable().optional(),
  level: z.string().nullable().optional(),
  forecast_level: z.string().nullable().optional(),
  trend: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  current_inflow: z.number().nullable().optional(),
  current_outflow: z.number().nullable().optional(),
});

export const StructuredAdvisorySchema = z.object({
  parser_name: z.string(),
  validation_status: z.string(),
  missing_sections: z.array(z.string()).default([]),
  title: z.string().nullable().optional(),
  advisory_type: z.string().nullable().optional(),
  highest_reported_level: z.string().nullable().optional(),
  bulletin: z.object({
    number: z.string().nullable().optional(),
    issue_date: z.string().nullable().optional(),
    issue_time: z.string().nullable().optional(),
    page: z.string().nullable().optional(),
    issuing_department: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    division: z.string().nullable().optional(),
    office_address: z.string().nullable().optional(),
    email: z.string().nullable().optional(),
    telephone: z.string().nullable().optional(),
  }).default({}),
  river_conditions: z.array(RiverConditionSchema).default([]),
  rainfall_forecast: z.object({
    next_24_hours: z.string().nullable().optional(),
    next_48_hours: z.string().nullable().optional(),
  }).default({}),
  hydrological_summary: z.array(z.string()).default([]),
  warning: z.object({
    text: z.string(),
    expected_timing: z.array(z.string()).default([]),
    rivers: z.array(z.string()).default([]),
    expected_flood_ranges: z.array(z.string()).default([]),
  }).nullable().optional(),
  source: z.object({
    name: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    department: z.string().nullable().optional(),
    document_type: z.string().nullable().optional(),
  }).default({}),
});

export const PrimaryLocationSchema = z.object({
  district: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  source: z.string().nullable().optional(),
  confidence: z.string().nullable().optional(),
  is_inferred: z.boolean().nullable().optional(),
  label: z.string().nullable().optional(),
  method: z.string().nullable().optional(),
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
  structured_advisory: StructuredAdvisorySchema.nullable().optional(),
  content_hash: z.string().nullable().optional(),
  validation_errors: z.string().nullable().optional(),
  created_at: z.string().nullable().optional(),
  updated_at: z.string().nullable().optional(),
  resolved_district: z.string().nullable().optional(),
  resolved_city: z.string().nullable().optional(),
  resolved_province: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  resolution_source: z.string().nullable().optional(),
  resolution_confidence: z.string().nullable().optional(),
  is_inferred: z.boolean().nullable().optional(),
  primary_location: PrimaryLocationSchema.nullable().optional(),
  locations: z.array(AlertLocationSchema).default([]),
  location_resolution: z.record(z.any()).nullable().optional(),
  source: z.object({
    name: z.string(),
    base_url: z.string(),
  }).nullable().optional(),
});

export type PrimaryLocation = z.infer<typeof PrimaryLocationSchema>;
export type Alert = z.infer<typeof AlertSchema>;
export type AlertLocation = z.infer<typeof AlertLocationSchema>;
export type StructuredAdvisory = z.infer<typeof StructuredAdvisorySchema>;
export type RiverCondition = z.infer<typeof RiverConditionSchema>;

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
