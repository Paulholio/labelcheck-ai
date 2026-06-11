export type BeverageType = "distilled_spirits" | "wine" | "malt_beverage";
export type CheckStatus = "pass" | "review" | "fail";
export type Decision = "ready" | "needs_review" | "return_for_correction";

export interface ApplicationData {
  brandName: string;
  classType: string;
  alcoholContent: string;
  netContents: string;
  nameAndAddress: string;
  countryOfOrigin: string;
  imported: boolean;
  beverageType: BeverageType;
}

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  expected: string;
  found: string;
  detail: string;
}

export interface VerificationReport {
  id: string;
  sourceName: string;
  decision: Decision;
  score: number;
  durationMs: number;
  checks: CheckResult[];
  labelText: string;
}

interface BeverageRuleProfile {
  classTypeLabel: string;
  alcoholLabel: string;
  netContentsLabel: string;
  proofEquivalentAllowed: boolean;
}

export const GOVERNMENT_WARNING =
  "GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.";

const BEVERAGE_RULES: Record<BeverageType, BeverageRuleProfile> = {
  distilled_spirits: {
    classTypeLabel: "Class/type",
    alcoholLabel: "Alcohol content",
    netContentsLabel: "Net contents",
    proofEquivalentAllowed: true
  },
  wine: {
    classTypeLabel: "Class/type or wine designation",
    alcoholLabel: "Alcohol content",
    netContentsLabel: "Net contents",
    proofEquivalentAllowed: false
  },
  malt_beverage: {
    classTypeLabel: "Class/type or malt beverage designation",
    alcoholLabel: "Alcohol content",
    netContentsLabel: "Net contents",
    proofEquivalentAllowed: false
  }
};

const COMMON_WORDS = new Set([
  "the",
  "and",
  "of",
  "by",
  "for",
  "with",
  "a",
  "an",
  "in",
  "on",
  "llc",
  "inc",
  "company",
  "co"
]);

export function emptyApplication(): ApplicationData {
  return {
    brandName: "OLD TOM DISTILLERY",
    classType: "Kentucky Straight Bourbon Whiskey",
    alcoholContent: "45% Alc./Vol. (90 Proof)",
    netContents: "750 mL",
    nameAndAddress: "Bottled by Old Tom Distillery, Louisville, KY",
    countryOfOrigin: "",
    imported: false,
    beverageType: "distilled_spirits"
  };
}

export function verifyLabel(
  application: ApplicationData,
  labelText: string,
  sourceName = "Label"
): VerificationReport {
  const started = performance.now();
  const text = labelText.trim();
  const rules = BEVERAGE_RULES[application.beverageType];
  const checks: CheckResult[] = [
    matchTextField("brand", "Brand name", application.brandName, text),
    matchTextField("class-type", rules.classTypeLabel, application.classType, text),
    checkAlcoholContent(application.alcoholContent, text, rules),
    checkNetContents(application.netContents, text, rules),
    checkNameAndAddress(application.nameAndAddress, text)
  ];

  if (application.imported) {
    checks.push(
      matchTextField(
        "country-origin",
        "Country of origin",
        application.countryOfOrigin,
        text
      )
    );
  }

  checks.push(checkGovernmentWarningText(text));
  checks.push(checkGovernmentWarningFormat(text));

  const requiredFailures = checks.filter((check) => check.status === "fail").length;
  const reviewCount = checks.filter((check) => check.status === "review").length;
  const score = Math.round(
    (checks.reduce((total, check) => {
      if (check.status === "pass") return total + 1;
      if (check.status === "review") return total + 0.5;
      return total;
    }, 0) /
      checks.length) *
      100
  );

  return {
    id: crypto.randomUUID(),
    sourceName,
    decision:
      requiredFailures > 0
        ? "return_for_correction"
        : reviewCount > 0
          ? "needs_review"
          : "ready",
    score,
    durationMs: Math.round(performance.now() - started),
    checks,
    labelText: text
  };
}

export function createIntakeReviewReport(
  sourceName: string,
  detail: string,
  labelText = ""
): VerificationReport {
  return {
    id: crypto.randomUUID(),
    sourceName,
    decision: "needs_review",
    score: 50,
    durationMs: 0,
    labelText,
    checks: [
      {
        id: "intake",
        label: "File intake",
        status: "review",
        expected: "Readable label text",
        found: sourceName,
        detail
      }
    ]
  };
}

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, "\"")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9.%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compact(value: string): string {
  return normalize(value).replace(/[^a-z0-9]+/g, "");
}

function matchTextField(
  id: string,
  label: string,
  expected: string,
  rawText: string
): CheckResult {
  if (!expected.trim()) {
    return blankRequired(id, label);
  }

  const expectedNormalized = normalize(expected);
  const textNormalized = normalize(rawText);

  if (textNormalized.includes(expectedNormalized)) {
    return {
      id,
      label,
      status: "pass",
      expected,
      found: bestSurfaceMatch(rawText, expected) || expected,
      detail: exactSurfaceContains(rawText, expected)
        ? "Exact text appears on the label."
        : "Equivalent text appears after normalizing case, punctuation, or spacing."
    };
  }

  const similarityScore = bestTokenWindowSimilarity(expectedNormalized, textNormalized);
  const found = bestTokenWindow(expectedNormalized, textNormalized);
  if (similarityScore >= 0.86) {
    return {
      id,
      label,
      status: "review",
      expected,
      found,
      detail: `Close match detected (${Math.round(similarityScore * 100)}%). Human judgment recommended.`
    };
  }

  const expectedTokens = expectedNormalized
    .split(" ")
    .filter((token) => token.length > 2 && !COMMON_WORDS.has(token));
  const hits = expectedTokens.filter((token) => textNormalized.includes(token));
  if (hits.length > 0 && hits.length >= Math.ceil(expectedTokens.length * 0.5)) {
    return {
      id,
      label,
      status: "review",
      expected,
      found: hits.join(", "),
      detail: "Several distinctive words are present, but the full field does not match."
    };
  }

  return {
    id,
    label,
    status: "fail",
    expected,
    found: "No reliable match found",
    detail: "The application value was not found on the label text."
  };
}

function checkNameAndAddress(expected: string, rawText: string): CheckResult {
  const base = matchTextField("name-address", "Name and address", expected, rawText);
  if (base.status !== "pass") return base;

  const rolePhrase =
    /\b(bottled|produced|imported|distilled|brewed|vinted|packed)\s+by\b/iu.test(rawText);
  if (!rolePhrase) {
    return {
      ...base,
      status: "review",
      found: base.found,
      detail:
        "Responsible party text matches, but the role phrase such as 'Bottled by' or 'Produced by' was not detected."
    };
  }

  return base;
}

function checkAlcoholContent(
  expected: string,
  rawText: string,
  rules: BeverageRuleProfile
): CheckResult {
  if (!expected.trim()) {
    return blankRequired("alcohol", rules.alcoholLabel);
  }

  const expectedAbv = firstAbvValue(expected);
  const labelValues = allAbvValues(rawText, rules.proofEquivalentAllowed);
  const expectedNormalized = normalize(expected);
  const textNormalized = normalize(rawText);

  if (expectedAbv == null && textNormalized.includes(expectedNormalized)) {
    return {
      id: "alcohol",
      label: rules.alcoholLabel,
      status: "pass",
      expected,
      found: expected,
      detail: "Alcohol statement text appears on the label."
    };
  }

  if (expectedAbv == null) {
    return {
      id: "alcohol",
      label: rules.alcoholLabel,
      status: "review",
      expected,
      found: "Could not parse expected ABV",
      detail: "The application alcohol statement is present but not machine-parseable."
    };
  }

  const matching = labelValues.find((value) => Math.abs(value - expectedAbv) <= 0.1);
  if (matching != null) {
    return {
      id: "alcohol",
      label: rules.alcoholLabel,
      status: "pass",
      expected,
      found: `${trimNumber(matching)}% ABV`,
      detail: "The label contains the expected ABV or equivalent proof value."
    };
  }

  if (labelValues.length > 0) {
    return {
      id: "alcohol",
      label: rules.alcoholLabel,
      status: "fail",
      expected: `${trimNumber(expectedAbv)}% ABV`,
      found: labelValues.map((value) => `${trimNumber(value)}% ABV`).join(", "),
      detail: "Alcohol value is present but does not match the application."
    };
  }

  return {
    id: "alcohol",
    label: rules.alcoholLabel,
    status: "fail",
    expected: `${trimNumber(expectedAbv)}% ABV`,
    found: "No ABV or proof statement found",
    detail: "The label text does not include a machine-readable alcohol content statement."
  };
}

function checkNetContents(
  expected: string,
  rawText: string,
  rules: BeverageRuleProfile
): CheckResult {
  if (!expected.trim()) {
    return blankRequired("net-contents", rules.netContentsLabel);
  }

  const expectedMl = firstVolumeMl(expected);
  const labelVolumes = allVolumeMl(rawText);

  if (expectedMl == null && normalize(rawText).includes(normalize(expected))) {
    return {
      id: "net-contents",
      label: rules.netContentsLabel,
      status: "pass",
      expected,
      found: expected,
      detail: "Net contents statement text appears on the label."
    };
  }

  if (expectedMl == null) {
    return {
      id: "net-contents",
      label: rules.netContentsLabel,
      status: "review",
      expected,
      found: "Could not parse expected volume",
      detail: "The application net contents value is present but not machine-parseable."
    };
  }

  const matching = labelVolumes.find((value) => Math.abs(value - expectedMl) <= 1);
  if (matching != null) {
    return {
      id: "net-contents",
      label: rules.netContentsLabel,
      status: "pass",
      expected,
      found: formatMl(matching),
      detail: "The label contains the expected net contents."
    };
  }

  if (labelVolumes.length > 0) {
    return {
      id: "net-contents",
      label: rules.netContentsLabel,
      status: "fail",
      expected: formatMl(expectedMl),
      found: labelVolumes.map(formatMl).join(", "),
      detail: "A net contents value is present but does not match the application."
    };
  }

  return {
    id: "net-contents",
    label: rules.netContentsLabel,
    status: "fail",
    expected: formatMl(expectedMl),
    found: "No volume statement found",
    detail: "The label text does not include a machine-readable net contents statement."
  };
}

function checkGovernmentWarningText(rawText: string): CheckResult {
  const exactLabel = warningSurface(rawText);

  if (exactLabel.includes(GOVERNMENT_WARNING)) {
    return {
      id: "warning-text",
      label: "Government warning wording",
      status: "pass",
      expected: GOVERNMENT_WARNING,
      found: "Required warning text found",
      detail: "The full warning statement appears with the required wording."
    };
  }

  const required = normalize(GOVERNMENT_WARNING);
  const label = normalize(rawText);
  const warningStart = label.indexOf("government warning");
  if (warningStart >= 0) {
    const candidate = label.slice(warningStart, warningStart + required.length + 80);
    const similarityScore = similarity(required, candidate.slice(0, required.length));
    return {
      id: "warning-text",
      label: "Government warning wording",
      status: similarityScore >= 0.9 ? "review" : "fail",
      expected: GOVERNMENT_WARNING,
      found: candidate.slice(0, 220),
      detail:
        similarityScore >= 0.9
          ? `Warning text is close but not exact (${Math.round(similarityScore * 100)}%).`
          : "Warning heading appears, but the required wording is materially different."
    };
  }

  return {
    id: "warning-text",
    label: "Government warning wording",
    status: "fail",
    expected: GOVERNMENT_WARNING,
    found: "No government warning found",
    detail: "All alcohol beverage labels need the required health warning statement."
  };
}

function checkGovernmentWarningFormat(rawText: string): CheckResult {
  const hasUppercaseHeading = /GOVERNMENT\s+WARNING\s*:/u.test(rawText);
  const hasTitlecaseHeading = /Government\s+Warning\s*:/u.test(rawText);
  const hasBoldSignal =
    /\*\*\s*GOVERNMENT\s+WARNING\s*:\s*\*\*/u.test(rawText) ||
    /<(strong|b)>\s*GOVERNMENT\s+WARNING\s*:\s*<\/(strong|b)>/iu.test(rawText);

  if (hasUppercaseHeading && hasBoldSignal) {
    return {
      id: "warning-format",
      label: "Government warning format",
      status: "pass",
      expected: "Uppercase, bold GOVERNMENT WARNING: heading",
      found: "Uppercase bold heading signal found",
      detail: "The supplied text includes an explicit bold marker for the required heading."
    };
  }

  if (hasUppercaseHeading) {
    return {
      id: "warning-format",
      label: "Government warning format",
      status: "review",
      expected: "Uppercase, bold GOVERNMENT WARNING: heading",
      found: "Uppercase heading found; bold cannot be confirmed from plain OCR text",
      detail: "Plain OCR does not preserve font weight, so an agent should confirm bold styling and type size."
    };
  }

  return {
    id: "warning-format",
    label: "Government warning format",
    status: "fail",
    expected: "Uppercase, bold GOVERNMENT WARNING: heading",
    found: hasTitlecaseHeading ? "Title case heading found" : "Required heading not found",
    detail: hasTitlecaseHeading
      ? "The heading must use all capital letters."
      : "The required warning heading is missing."
  };
}

function blankRequired(id: string, label: string): CheckResult {
  return {
    id,
    label,
    status: "fail",
    expected: "Application value required",
    found: "Missing from application",
    detail: "The application field is blank, so the label cannot be verified."
  };
}

function warningSurface(value: string): string {
  return value
    .replace(/<\/?(strong|b)>/giu, "")
    .replace(/\*\*/gu, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function firstAbvValue(value: string): number | null {
  return allAbvValues(value, true)[0] ?? null;
}

function allAbvValues(value: string, includeProof: boolean): number[] {
  const values: number[] = [];
  const abvPatterns = [
    /(\d{1,3}(?:\.\d+)?)\s*%\s*(?:alc(?:ohol)?\.?\s*\/?\s*vol\.?|abv|alcohol\s+by\s+volume)?/giu,
    /(?:alc(?:ohol)?\.?\s*\/?\s*vol\.?|abv|alcohol\s+by\s+volume)\s*(\d{1,3}(?:\.\d+)?)\s*%?/giu
  ];

  for (const pattern of abvPatterns) {
    for (const match of value.matchAll(pattern)) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 100) {
        values.push(parsed);
      }
    }
  }

  if (includeProof) {
    for (const match of value.matchAll(/(\d{1,3}(?:\.\d+)?)\s*proof/giu)) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > 0 && parsed <= 200) {
        values.push(parsed / 2);
      }
    }
  }

  return uniqueNumbers(values);
}

function firstVolumeMl(value: string): number | null {
  return allVolumeMl(value)[0] ?? null;
}

function allVolumeMl(value: string): number[] {
  const values: number[] = [];
  const patterns = [
    /(\d{1,5}(?:\.\d+)?)\s*(?:ml|milliliters?|millilitres?)\b/giu,
    /(\d{1,3}(?:\.\d+)?)\s*(?:l|liters?|litres?)\b/giu,
    /(\d{1,4}(?:\.\d+)?)\s*(?:fl\.?\s*oz\.?|fluid\s+ounces?)\b/giu
  ];

  for (const match of value.matchAll(patterns[0])) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) values.push(parsed);
  }

  for (const match of value.matchAll(patterns[1])) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) values.push(parsed * 1000);
  }

  for (const match of value.matchAll(patterns[2])) {
    const parsed = Number(match[1]);
    if (Number.isFinite(parsed)) values.push(parsed * 29.5735);
  }

  return uniqueNumbers(values);
}

function uniqueNumbers(values: number[]): number[] {
  return Array.from(new Set(values.map((value) => Math.round(value * 100) / 100)));
}

function formatMl(value: number): string {
  if (value >= 1000 && value % 1000 === 0) return `${value / 1000} L`;
  return `${trimNumber(value)} mL`;
}

function trimNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/u, "").replace(/\.$/u, "");
}

function exactSurfaceContains(rawText: string, expected: string): boolean {
  return rawText.includes(expected);
}

function bestSurfaceMatch(rawText: string, expected: string): string | null {
  const expectedCompact = compact(expected);
  const lines = rawText.split(/\n+/u).map((line) => line.trim());
  return (
    lines.find((line) => compact(line).includes(expectedCompact)) ??
    lines.find((line) => similarity(compact(line), expectedCompact) > 0.85) ??
    null
  );
}

function bestTokenWindowSimilarity(expectedNormalized: string, textNormalized: string): number {
  const window = bestTokenWindow(expectedNormalized, textNormalized);
  if (!window) return 0;
  return similarity(expectedNormalized, window);
}

function bestTokenWindow(expectedNormalized: string, textNormalized: string): string {
  const expectedTokens = expectedNormalized.split(" ").filter(Boolean);
  const labelTokens = textNormalized.split(" ").filter(Boolean);
  if (expectedTokens.length === 0 || labelTokens.length === 0) return "";

  const windowSize = Math.min(labelTokens.length, Math.max(1, expectedTokens.length));
  let best = "";
  let bestScore = 0;

  for (let index = 0; index <= labelTokens.length - windowSize; index += 1) {
    const window = labelTokens.slice(index, index + windowSize).join(" ");
    const score = similarity(expectedNormalized, window);
    if (score > bestScore) {
      best = window;
      bestScore = score;
    }
  }

  return best;
}

export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function levenshtein(a: string, b: string): number {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[b.length];
}
