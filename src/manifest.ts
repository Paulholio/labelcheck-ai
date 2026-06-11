import { ApplicationData, BeverageType, emptyApplication } from "./verification";

export interface ManifestLabel {
  sourceName: string;
  labelText: string;
  application: ApplicationData;
}

type RawRecord = Record<string, unknown>;

const beverageTypes = new Set<BeverageType>([
  "distilled_spirits",
  "wine",
  "malt_beverage"
]);

export function parseManifest(
  content: string,
  fileName: string,
  fallbackApplication: ApplicationData
): ManifestLabel[] {
  const rows = fileName.toLowerCase().endsWith(".json")
    ? parseJsonManifest(content)
    : parseCsvManifest(content);

  return rows.map((row, index) => {
    const applicationSource = isRecord(row.application) ? row.application : row;
    const application = applicationFromRecord(applicationSource, fallbackApplication);
    const sourceName =
      stringValue(row, ["sourceName", "source", "fileName", "file", "name"]) ||
      application.brandName ||
      `${fileName} row ${index + 1}`;
    const labelText = stringValue(row, [
      "labelText",
      "label_text",
      "text",
      "ocrText",
      "label"
    ]);

    return {
      sourceName,
      labelText,
      application
    };
  });
}

export function looksLikeManifest(fileName: string, content: string): boolean {
  const lowerName = fileName.toLowerCase();
  if (lowerName.endsWith(".json")) {
    try {
      return parseJsonManifest(content).some(hasManifestLabelText);
    } catch {
      return false;
    }
  }

  if (!lowerName.endsWith(".csv")) return false;
  const [header = ""] = content.split(/\r?\n/u);
  const normalizedHeaders = header.split(",").map(normalizeKey);
  return normalizedHeaders.some((headerName) =>
    ["labeltext", "label_text", "ocrtext", "text"].includes(headerName)
  );
}

function parseJsonManifest(content: string): RawRecord[] {
  const parsed = JSON.parse(content) as unknown;
  if (Array.isArray(parsed)) return parsed.filter(isRecord);
  if (isRecord(parsed) && Array.isArray(parsed.labels)) return parsed.labels.filter(isRecord);
  if (isRecord(parsed) && Array.isArray(parsed.items)) return parsed.items.filter(isRecord);
  if (isRecord(parsed) && hasManifestLabelText(parsed)) return [parsed];
  throw new Error("JSON manifest must be an array or contain labels/items.");
}

function parseCsvManifest(content: string): RawRecord[] {
  const rows = parseCsvRows(content).filter((row) => row.some((cell) => cell.trim()));
  const [headers, ...records] = rows;
  if (!headers || records.length === 0) return [];

  return records.map((record) =>
    headers.reduce<RawRecord>((row, header, index) => {
      row[header.trim()] = record[index] ?? "";
      return row;
    }, {})
  );
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (char === "\"" && inQuotes && next === "\"") {
      cell += "\"";
      index += 1;
    } else if (char === "\"") {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function applicationFromRecord(
  record: RawRecord,
  fallbackApplication: ApplicationData
): ApplicationData {
  const fallback = { ...emptyApplication(), ...fallbackApplication };
  const beverageType = normalizeBeverageType(
    stringValue(record, ["beverageType", "beverage_type", "typeCategory"]),
    fallback.beverageType
  );

  return {
    brandName: stringValue(record, ["brandName", "brand", "brand_name"]) || fallback.brandName,
    classType:
      stringValue(record, ["classType", "class", "class_type", "designation"]) ||
      fallback.classType,
    alcoholContent:
      stringValue(record, ["alcoholContent", "abv", "alcohol", "alcohol_content"]) ||
      fallback.alcoholContent,
    netContents:
      stringValue(record, ["netContents", "net", "volume", "net_contents"]) ||
      fallback.netContents,
    nameAndAddress:
      stringValue(record, ["nameAndAddress", "responsibleParty", "address", "name_address"]) ||
      fallback.nameAndAddress,
    countryOfOrigin:
      stringValue(record, ["countryOfOrigin", "country", "origin", "country_origin"]) ||
      fallback.countryOfOrigin,
    imported: booleanValue(record, ["imported", "isImported"]) ?? fallback.imported,
    beverageType
  };
}

function stringValue(record: RawRecord, keys: string[]): string {
  const normalized = normalizedRecord(record);
  for (const key of keys) {
    const value = normalized.get(normalizeKey(key));
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

function booleanValue(record: RawRecord, keys: string[]): boolean | null {
  const value = stringValue(record, keys).toLowerCase();
  if (["true", "yes", "y", "1", "imported"].includes(value)) return true;
  if (["false", "no", "n", "0", "domestic"].includes(value)) return false;
  return null;
}

function normalizeBeverageType(value: string, fallback: BeverageType): BeverageType {
  const normalized = value.toLowerCase().replace(/[\s-]+/gu, "_");
  if (normalized === "beer" || normalized === "malt") return "malt_beverage";
  if (beverageTypes.has(normalized as BeverageType)) return normalized as BeverageType;
  return fallback;
}

function normalizedRecord(record: RawRecord): Map<string, unknown> {
  const map = new Map<string, unknown>();
  for (const [key, value] of Object.entries(record)) {
    map.set(normalizeKey(key), value);
  }
  return map;
}

function normalizeKey(value: string): string {
  return value.trim().replace(/[^a-z0-9_]/giu, "").toLowerCase();
}

function hasManifestLabelText(record: RawRecord): boolean {
  return Boolean(stringValue(record, ["labelText", "label_text", "text", "ocrText", "label"]));
}

function isRecord(value: unknown): value is RawRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
