import { fireEvent, render, screen } from "@testing-library/react";
import AdvisoryInformation from "@/components/advisory/AdvisoryInformation";
import { Alert } from "@/lib/api/schemas";
import { api } from "@/lib/api/client";


const alert: Alert = {
  id: 55,
  source_id: 4,
  source_alert_id: "FFD-039-26",
  title: "Flood Forecasting Division Bulletin",
  description: "This should not be rendered as one large default paragraph.",
  hazard_type: "flood",
  official_severity: "High",
  normalized_severity: "high",
  issued_at: "2026-07-23T12:15:00+05:00",
  starts_at: null,
  expires_at: null,
  status: "active",
  source_url: "https://ffd.pmd.gov.pk/bulletin/50/download",
  raw_text: "ORIGINAL SOURCE CONTENT WITH ADMINISTRATIVE FOOTER",
  content_hash: "test-hash",
  validation_errors: null,
  created_at: "2026-07-23T12:20:00+05:00",
  updated_at: null,
  locations: [
    {
      id: 1,
      alert_id: 55,
      raw_location: "Khanki",
      canonical_name: "Khanki",
      entity_type: "TOWN",
      text_source: "RAW_TEXT",
      location_id: "geonames:1174167",
      latitude: 32.4,
      longitude: 73.9,
    },
  ],
  location_resolution: null,
  source: {
    name: "FFD Bulletins",
    base_url: "https://ffd.pmd.gov.pk/",
  },
  structured_advisory: {
    parser_name: "ffd-deterministic-v4",
    validation_status: "structured",
    missing_sections: [],
    title: "Daily Flood Bulletin",
    advisory_type: "Daily Flood Bulletin",
    highest_reported_level: "High",
    bulletin: {
      number: "039/26",
      issue_date: "23 July 2026",
      issue_time: "12:15 PST",
      page: "1 of 8",
      issuing_department: "Flood Forecasting Division",
      department: "Pakistan Meteorological Department",
      email: "ffdlhr@yahoo.com",
    },
    river_conditions: [
      {
        river: "Chenab",
        station: "Khanki",
        level: "High",
        forecast_level: "Medium to High",
        trend: "Decreasing",
        notes: "Expected to decrease during the next 24 hours.",
        current_inflow: 261.5,
        current_outflow: 256.1,
      },
      {
        river: "Kabul",
        station: null,
        level: "Low",
        forecast_level: "Low to Medium",
        trend: null,
        notes: null,
        current_inflow: 78.5,
        current_outflow: 78.5,
      },
    ],
    rainfall_forecast: {
      next_24_hours: "Widespread rain is expected over major river catchments.",
      next_48_hours: "Wet spell is likely to continue.",
    },
    hydrological_summary: [
      "River Chenab at Khanki is in High flood level.",
    ],
    warning: {
      text: "River flows are likely to increase significantly up to 25 July.",
      expected_timing: ["up to 25 July"],
      rivers: ["Chenab", "Kabul"],
      expected_flood_ranges: ["High flows"],
    },
    source: {
      name: "Flood Forecasting Division",
      url: "https://ffd.pmd.gov.pk/bulletin/50/download",
      department: "Pakistan Meteorological Department",
      document_type: "PDF",
    },
  },
};


describe("AdvisoryInformation", () => {
  test("renders structured sections, semantic river table, and mobile cards", () => {
    render(<AdvisoryInformation alert={alert} />);

    expect(screen.getByRole("heading", { name: "Daily Flood Bulletin" })).toBeInTheDocument();
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "River" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "24-hour forecast" })).toBeInTheDocument();
    expect(screen.getAllByText("Expected to decrease during the next 24 hours.")).toHaveLength(2);
    expect(screen.getAllByText("Medium to High").length).toBeGreaterThan(0);
    expect(screen.getByTestId("river-status-mobile")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rainfall forecast" })).toBeInTheDocument();
    expect(screen.getByText("Wet spell is likely to continue.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Warning and expected impact" })).toBeInTheDocument();
    expect(screen.getByText("Khanki", { selector: "span.font-medium" })).toBeInTheDocument();
  });

  test("keeps raw text lazy and collapsed until requested", async () => {
    render(<AdvisoryInformation alert={alert} />);

    expect(screen.queryByText("ORIGINAL SOURCE CONTENT WITH ADMINISTRATIVE FOOTER")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("View original extracted text"));
    expect(await screen.findByText("ORIGINAL SOURCE CONTENT WITH ADMINISTRATIVE FOOTER")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Copy original extracted text" })).toBeInTheDocument();
  });

  test("fetches raw text only when a list alert disclosure is opened", async () => {
    const rawTextRequest = vi
      .spyOn(api, "getAlertRawText")
      .mockResolvedValue("LAZY RAW BULLETIN TEXT");
    render(<AdvisoryInformation alert={{ ...alert, raw_text: null }} />);

    expect(rawTextRequest).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText("View original extracted text"));
    expect(await screen.findByText("LAZY RAW BULLETIN TEXT")).toBeInTheDocument();
    expect(rawTextRequest).toHaveBeenCalledOnce();
    expect(rawTextRequest).toHaveBeenCalledWith(alert.id);
  });

  test("links to the official source safely", () => {
    render(<AdvisoryInformation alert={alert} />);
    const link = screen.getByRole("link", { name: "View Official Source" });
    expect(link).toHaveAttribute("href", alert.source_url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("falls back honestly when parsing is unavailable", () => {
    render(
      <AdvisoryInformation
        alert={{ ...alert, structured_advisory: null, description: "Available source sentence." }}
      />,
    );
    expect(
      screen.getByText("Some bulletin sections could not be structured automatically."),
    ).toBeInTheDocument();
    expect(screen.getByText("Available source sentence.")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Official Source" })).toBeInTheDocument();
  });

  test("labels aggregate river conditions without inventing a station", () => {
    render(<AdvisoryInformation alert={alert} />);
    expect(screen.getAllByText("River-wide summary").length).toBeGreaterThan(0);
  });
});
