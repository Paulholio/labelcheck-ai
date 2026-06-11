import { describe, expect, it } from "vitest";
import {
  createIntakeReviewReport,
  emptyApplication,
  GOVERNMENT_WARNING,
  verifyLabel
} from "./verification";

describe("verifyLabel", () => {
  it("passes exact required fields and explicit warning bold marker", () => {
    const app = emptyApplication();
    const report = verifyLabel(
      app,
      `OLD TOM DISTILLERY
Kentucky Straight Bourbon Whiskey
45% Alc./Vol. (90 Proof)
750 mL
Bottled by Old Tom Distillery, Louisville, KY
${GOVERNMENT_WARNING.replace("GOVERNMENT WARNING:", "**GOVERNMENT WARNING:**")}`
    );

    expect(report.decision).toBe("ready");
    expect(report.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("accepts brand case differences and proof equivalent to ABV", () => {
    const app = {
      ...emptyApplication(),
      brandName: "Stone's Throw",
      classType: "Straight Rye Whiskey",
      alcoholContent: "50% Alc./Vol.",
      nameAndAddress: "Bottled by North River Spirits, Albany, NY"
    };
    const report = verifyLabel(
      app,
      `STONE'S THROW
Straight Rye Whisky
100 Proof
750ml
Bottled by North River Spirits, Albany, NY
${GOVERNMENT_WARNING}`
    );

    expect(report.checks.find((check) => check.id === "brand")?.status).toBe("pass");
    expect(report.checks.find((check) => check.id === "alcohol")?.status).toBe("pass");
    expect(report.decision).toBe("needs_review");
  });

  it("fails material warning and alcohol mismatches", () => {
    const report = verifyLabel(
      emptyApplication(),
      `OLD TOM DISTILLERY
Kentucky Straight Bourbon Whiskey
40% Alc./Vol.
Government Warning: Do not drink and drive.`
    );

    expect(report.decision).toBe("return_for_correction");
    expect(report.checks.find((check) => check.id === "alcohol")?.status).toBe("fail");
    expect(report.checks.find((check) => check.id === "warning-format")?.status).toBe("fail");
  });

  it("requires name and address from the application", () => {
    const report = verifyLabel(
      { ...emptyApplication(), nameAndAddress: "" },
      `OLD TOM DISTILLERY
Kentucky Straight Bourbon Whiskey
45% Alc./Vol.
750 mL
${GOVERNMENT_WARNING}`
    );

    expect(report.decision).toBe("return_for_correction");
    expect(report.checks.find((check) => check.id === "name-address")?.status).toBe("fail");
  });

  it("requires country of origin for imported products", () => {
    const report = verifyLabel(
      { ...emptyApplication(), imported: true, countryOfOrigin: "" },
      `OLD TOM DISTILLERY
Kentucky Straight Bourbon Whiskey
45% Alc./Vol.
750 mL
Bottled by Old Tom Distillery, Louisville, KY
${GOVERNMENT_WARNING}`
    );

    expect(report.decision).toBe("return_for_correction");
    expect(report.checks.find((check) => check.id === "country-origin")?.status).toBe("fail");
  });

  it("parses fluid ounces for malt beverage net contents", () => {
    const report = verifyLabel(
      {
        ...emptyApplication(),
        brandName: "HARBOR LIGHT",
        classType: "Lager",
        alcoholContent: "5% ABV",
        netContents: "12 fl oz",
        nameAndAddress: "Brewed by Harbor Light Brewing, Portland, ME",
        beverageType: "malt_beverage"
      },
      `HARBOR LIGHT
Lager
5% ABV
12 FL OZ
Brewed by Harbor Light Brewing, Portland, ME
${GOVERNMENT_WARNING}`
    );

    expect(report.checks.find((check) => check.id === "net-contents")?.status).toBe("pass");
  });

  it("does not pass warning wording unless canonical case and punctuation match", () => {
    const report = verifyLabel(
      emptyApplication(),
      `OLD TOM DISTILLERY
Kentucky Straight Bourbon Whiskey
45% Alc./Vol.
750 mL
Bottled by Old Tom Distillery, Louisville, KY
${GOVERNMENT_WARNING.toLowerCase()}`
    );

    expect(report.checks.find((check) => check.id === "warning-text")?.status).toBe("review");
  });

  it("creates manual-review intake reports for OCR and file errors", () => {
    const report = createIntakeReviewReport("bad.png", "OCR timed out.");

    expect(report.decision).toBe("needs_review");
    expect(report.checks).toHaveLength(1);
    expect(report.checks[0].status).toBe("review");
  });
});
