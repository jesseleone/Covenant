import { describe, expect, it } from "vitest";
import { recordedWrites, renderExtension, screen } from "@/lib/sdk/testing";
import UpcomingICs from "./index";

describe("Upcoming ICs", () => {
  it("lists active deals with a meeting coming up, soonest first", () => {
    renderExtension(<UpcomingICs />);
    const names = screen.getAllByRole("link").map((l) => l.textContent);
    expect(names).toContain("Project Beacon");
    expect(names.indexOf("Project Osprey")).toBeGreaterThan(names.indexOf("Project Beacon"));
  });

  it("leaves out deals with no upcoming meeting, and passed or lost deals", () => {
    renderExtension(<UpcomingICs />);
    for (const name of ["Project Fjord", "Project Ember", "Project Vale", "Project Alder"]) {
      expect(screen.queryByText(name)).toBeNull();
    }
  });

  it("shows the deal lead and facility size", () => {
    renderExtension(<UpcomingICs />);
    const row = screen.getByRole("row", { name: /Project Beacon/ }).textContent;
    expect(row).toContain("Elena");
    expect(row).toContain("$175.0M");
  });

  it("only reads data", () => {
    renderExtension(<UpcomingICs />);
    expect(recordedWrites()).toEqual([]);
  });
});
