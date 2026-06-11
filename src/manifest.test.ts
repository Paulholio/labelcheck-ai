import { describe, expect, it } from "vitest";
import { parseManifest } from "./manifest";
import { emptyApplication } from "./verification";

describe("parseManifest", () => {
  it("parses JSON rows with per-label application records", () => {
    const rows = parseManifest(
      JSON.stringify([
        {
          sourceName: "wine-1",
          brandName: "CASA LUNA",
          classType: "Red Wine",
          alcoholContent: "13.5% Alc./Vol.",
          netContents: "750 mL",
          nameAndAddress: "Imported by North Star Imports, New York, NY",
          countryOfOrigin: "Product of Italy",
          imported: "yes",
          beverageType: "wine",
          labelText: "CASA LUNA Red Wine"
        }
      ]),
      "labels.json",
      emptyApplication()
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].sourceName).toBe("wine-1");
    expect(rows[0].application.brandName).toBe("CASA LUNA");
    expect(rows[0].application.imported).toBe(true);
    expect(rows[0].application.beverageType).toBe("wine");
  });

  it("parses quoted CSV label text", () => {
    const rows = parseManifest(
      `sourceName,brandName,classType,alcoholContent,netContents,nameAndAddress,beverageType,labelText
"beer, can",HARBOR LIGHT,Lager,5% ABV,12 fl oz,"Brewed by Harbor Light Brewing, Portland, ME",beer,"HARBOR LIGHT
Lager
12 FL OZ"`,
      "labels.csv",
      emptyApplication()
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].sourceName).toBe("beer, can");
    expect(rows[0].application.beverageType).toBe("malt_beverage");
    expect(rows[0].labelText).toContain("12 FL OZ");
  });
});
