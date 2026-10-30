import { describe, expect, it } from "vitest";
import { fireEvent, recordedWrites, renderExtension, screen } from "@/lib/sdk/testing";
import SectorExposure from "./index";

describe("Sector exposure", () => {
  it("shows each broad sector with its fund hold", () => {
    renderExtension(<SectorExposure />);
    // Closed and active deals: business services 115+140+95+110+70+125, healthcare 80, software 100+60.
    expect(screen.getByRole("row", { name: /Business services/ }).textContent).toContain("$655.0M");
    expect(screen.getByRole("row", { name: /Software/ }).textContent).toContain("$160.0M");
    expect(screen.getByText("9 deals · fund hold $895.0M")).toBeTruthy();
  });

  it("flags business services as a concentration", () => {
    renderExtension(<SectorExposure />);
    expect(screen.getAllByText(/Concentration/)).toHaveLength(1);
  });

  it("leaves out passed and lost deals", () => {
    renderExtension(<SectorExposure />);
    expect(screen.queryByText("Project Ember")).toBeNull();
    expect(screen.queryByText("Project Vale")).toBeNull();
  });

  it("can show only the closed book", () => {
    renderExtension(<SectorExposure />);
    fireEvent.click(screen.getByRole("button", { name: "Closed book" }));
    expect(screen.getByText("3 deals · fund hold $305.0M")).toBeTruthy();
    expect(screen.queryByText("Project Larch")).toBeNull();
  });

  it("only reads data", () => {
    renderExtension(<SectorExposure />);
    expect(recordedWrites()).toEqual([]);
  });
});
