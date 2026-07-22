import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "Not provided";
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("en-PK", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(date);
  } catch (e) {
    return dateString;
  }
}

export function getRelativeTime(dateString: string | null | undefined): string {
  if (!dateString) return "Not provided";
  try {
    const date = new Date(dateString);
    const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
    const daysDifference = Math.round(
      (date.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (Math.abs(daysDifference) < 1) {
      const hoursDifference = Math.round(
        (date.getTime() - new Date().getTime()) / (1000 * 60 * 60)
      );
      if (Math.abs(hoursDifference) < 1) {
        const minutesDifference = Math.round(
          (date.getTime() - new Date().getTime()) / (1000 * 60)
        );
        return rtf.format(minutesDifference, "minute");
      }
      return rtf.format(hoursDifference, "hour");
    }
    return rtf.format(daysDifference, "day");
  } catch (e) {
    return dateString;
  }
}
