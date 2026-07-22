import axios from "axios";
import { AlertSchema, SourceSchema } from "./schemas";
import { z } from "zod";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const api = {
  getAlerts: async (params?: Record<string, string | number>) => {
    const response = await apiClient.get("/alerts/active", { params });
    const parsed = z.array(AlertSchema).safeParse(response.data);
    if (!parsed.success) {
      console.error("Zod Schema Validation Error on getAlerts:", parsed.error);
      return response.data; // Fallback to raw response data if schema validation has minor mismatch
    }
    return parsed.data;
  },

  getAlertHistory: async (params?: Record<string, string | number>) => {
    const response = await apiClient.get("/alerts/history", { params });
    const parsed = z.array(AlertSchema).safeParse(response.data);
    if (!parsed.success) {
      console.error("Zod Schema Validation Error on getAlertHistory:", parsed.error);
      return response.data;
    }
    return parsed.data;
  },

  getAlertDetails: async (id: number | string) => {
    const response = await apiClient.get(`/alerts/${id}`);
    const parsed = AlertSchema.safeParse(response.data);
    if (!parsed.success) {
      console.error("Zod Schema Validation Error on getAlertDetails:", parsed.error);
      return response.data;
    }
    return parsed.data;
  },

  getSources: async () => {
    const response = await apiClient.get("/sources/");
    const parsed = z.array(SourceSchema).safeParse(response.data);
    if (!parsed.success) {
      console.error("Zod Schema Validation Error on getSources:", parsed.error);
      return response.data;
    }
    return parsed.data;
  },
  
  getHealth: async () => {
    const response = await apiClient.get("/health");
    return response.data;
  }
};
