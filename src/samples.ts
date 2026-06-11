import { ApplicationData, GOVERNMENT_WARNING } from "./verification";

export interface SampleLabel {
  id: string;
  name: string;
  application: ApplicationData;
  text: string;
}

const baseApplication: ApplicationData = {
  brandName: "OLD TOM DISTILLERY",
  classType: "Kentucky Straight Bourbon Whiskey",
  alcoholContent: "45% Alc./Vol. (90 Proof)",
  netContents: "750 mL",
  nameAndAddress: "Bottled by Old Tom Distillery, Louisville, KY",
  countryOfOrigin: "",
  imported: false,
  beverageType: "distilled_spirits"
};

const warningWithBoldHeading = GOVERNMENT_WARNING.replace(
  "GOVERNMENT WARNING:",
  "**GOVERNMENT WARNING:**"
);

export const samples: SampleLabel[] = [
  {
    id: "clean-bourbon",
    name: "Clean bourbon label",
    application: baseApplication,
    text: `OLD TOM DISTILLERY
Kentucky Straight Bourbon Whiskey
45% Alc./Vol. (90 Proof)
750 mL
Bottled by Old Tom Distillery, Louisville, KY
${warningWithBoldHeading}`
  },
  {
    id: "case-variant",
    name: "Case and punctuation variant",
    application: {
      ...baseApplication,
      brandName: "Stone's Throw",
      classType: "Straight Rye Whiskey",
      alcoholContent: "50% Alc./Vol.",
      netContents: "750 mL",
      nameAndAddress: "Bottled by North River Spirits, Albany, NY"
    },
    text: `STONE'S THROW
Straight Rye Whisky
100 Proof
750ml
Bottled by North River Spirits, Albany, NY
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.`
  },
  {
    id: "bad-warning",
    name: "Warning and volume problems",
    application: baseApplication,
    text: `OLD TOM DISTILLERY
Kentucky Straight Bourbon Whiskey
40% Alc./Vol. (80 Proof)
Government Warning: Pregnant women should avoid alcohol. Do not drive after drinking.
Bottled by Old Tom Distillery, Louisville, KY`
  },
  {
    id: "imported-wine",
    name: "Imported wine label",
    application: {
      ...baseApplication,
      brandName: "CASA LUNA",
      classType: "Red Wine",
      alcoholContent: "13.5% Alc./Vol.",
      netContents: "750 ML",
      nameAndAddress: "Imported by North Star Imports, New York, NY",
      countryOfOrigin: "Product of Italy",
      imported: true,
      beverageType: "wine"
    },
    text: `CASA LUNA
Red Wine
13.5% Alc./Vol.
750 mL
Product of Italy
Imported by North Star Imports, New York, NY
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.`
  },
  {
    id: "malt-fl-oz",
    name: "Malt beverage with fluid ounces",
    application: {
      ...baseApplication,
      brandName: "HARBOR LIGHT",
      classType: "Lager",
      alcoholContent: "5% ABV",
      netContents: "12 fl oz",
      nameAndAddress: "Brewed by Harbor Light Brewing, Portland, ME",
      beverageType: "malt_beverage"
    },
    text: `HARBOR LIGHT
Lager
5% ABV
12 FL OZ
Brewed by Harbor Light Brewing, Portland, ME
GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.`
  }
];
