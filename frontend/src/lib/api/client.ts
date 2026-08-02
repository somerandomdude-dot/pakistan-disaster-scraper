import { AlertSchema, SourceSchema } from "./schemas";
import { z } from "zod";
import { supabase } from "./supabaseClient";

export const api = {
  getAlerts: async (params?: Record<string, string | number>) => {
    let query = supabase.from("alerts").select("*, locations:alert_locations(*), source:sources(*)");
    // add filters if params has active=true
    if (params?.active === "true") {
      query = query.eq("status", "active");
    }
    const { data, error } = await query;
    if (error) {
      console.error("Supabase Error on getAlerts:", error);
      throw error;
    }
    
    // Zod parsing (optional, but good for safety)
    const parsed = z.array(AlertSchema).safeParse(data);
    if (!parsed.success) {
      console.error("Zod Schema Validation Error on getAlerts:", parsed.error);
      return data;
    }
    return parsed.data;
  },

  getAlertHistory: async (params?: Record<string, string | number>) => {
    let query = supabase.from("alerts").select("*, locations:alert_locations(*), source:sources(*)").eq("status", "expired");
    const { data, error } = await query;
    if (error) throw error;

    const parsed = z.array(AlertSchema).safeParse(data);
    if (!parsed.success) {
      console.error("Zod Schema Validation Error on getAlertHistory:", parsed.error);
      return data;
    }
    return parsed.data;
  },

  getAlertDetails: async (id: number | string) => {
    const { data, error } = await supabase
      .from("alerts")
      .select("*, locations:alert_locations(*), source:sources(*)")
      .eq("id", id)
      .single();
    
    if (error) throw error;

    const parsed = AlertSchema.safeParse(data);
    if (!parsed.success) {
      console.error("Zod Schema Validation Error on getAlertDetails:", parsed.error);
      return data;
    }
    return parsed.data;
  },

  getAlertRawText: async (id: number | string): Promise<string | null> => {
    const { data, error } = await supabase
      .from("alerts")
      .select("raw_text")
      .eq("id", id)
      .single();
    if (error) return null;
    return data?.raw_text || null;
  },

  getSources: async () => {
    const { data, error } = await supabase.from("sources").select("*");
    if (error) throw error;

    const parsed = z.array(SourceSchema).safeParse(data);
    if (!parsed.success) {
      console.error("Zod Schema Validation Error on getSources:", parsed.error);
      return data;
    }
    return parsed.data;
  },
  
  getHealth: async () => {
    const { count, error } = await supabase.from("sources").select("*", { count: 'exact', head: true });
    if (error) return { status: "unhealthy", error: error.message };
    return { status: "ok", message: "Supabase connection successful", source_count: count };
  }
};
