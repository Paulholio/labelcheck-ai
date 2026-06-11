# LabelCheck AI

AI-assisted prototype for alcohol label verification. It compares a COLA-style application record against uploaded, OCR-extracted, or pasted label text and returns field-level pass, review, or return decisions.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. For production build checks:

```bash
npm test
npm run build
```

## Deploy

The app is a static Vite build. Any static host can serve `dist/` after `npm run build`.

Vercel:

```bash
npm install
npm run build
npx vercel deploy --prebuilt --prod
```

Render static site:

- Build command: `npm install && npm run build`
- Publish directory: `dist`

## What it does

- Verifies brand name, class/type, alcohol content, net contents, name/address, country of origin when imported, and the government health warning.
- Handles common human-review nuance with normalization and fuzzy matching, so case and punctuation differences such as `STONE'S THROW` vs. `Stone's Throw` are not treated as hard failures.
- Converts proof to ABV for alcohol matching, for example `90 Proof` equals `45% ABV`.
- Supports a single-review workflow plus a batch queue for many label files.
- Runs OCR in the browser with Tesseract.js, local OCR assets under `public/ocr/`, uncompressed English trained data, and a 5-second timeout. If OCR is too slow, the item is marked for manual review rather than blocking the workflow.
- Stores no label data on a server. All processing in this prototype happens in the browser.

## Approach

The prototype deliberately avoids cloud AI APIs because the stakeholder notes call out government network restrictions and blocked outbound ML endpoints. The "AI-powered" behavior is local OCR plus deterministic/fuzzy verification:

- `src/ocr.ts` extracts text from image uploads using browser OCR loaded from same-origin files in `public/ocr/`.
- `src/verification.ts` contains the testable rule engine.
- `src/App.tsx` provides the agent-facing single and batch review workflows.

The UI is intentionally direct: application values on the left, label text and results on the right, large status badges, no hidden navigation, and sample cases for quick testing.

## TTB references used

TTB's distilled spirits health warning guidance states that the required warning is:

> GOVERNMENT WARNING: (1) According to the Surgeon General, women should not drink alcoholic beverages during pregnancy because of the risk of birth defects. (2) Consumption of alcoholic beverages impairs your ability to drive a car or operate machinery, and may cause health problems.

The same guidance says the warning must appear separate from other information, `GOVERNMENT WARNING` must be capitalized and bold, and the statement must be a continuous paragraph. It also lists type-size and legibility requirements. For mandatory distilled spirits label information, TTB guidance identifies brand name, alcohol content, and class/type as same-field-of-vision items, with other mandatory items such as name/address, net contents, and health warning allowed on any label.

Sources:

- https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-health-warning
- https://www.ttb.gov/regulated-commodities/beverage-alcohol/distilled-spirits/ds-labeling-home/ds-brand-label

## Assumptions and limitations

- This is a standalone proof of concept, not a COLA integration.
- Plain OCR text cannot reliably prove bold styling, type size, contrast, or same-field-of-vision layout. The app marks those visual checks for manual review when the uploaded text lacks explicit markup.
- The rule engine focuses on the common distilled spirits example in the prompt while keeping beverage type as an application field for future rule branching.
- OCR quality depends on image clarity. Poor lighting, glare, extreme skew, or decorative fonts may still require an agent to request a better image.
- Batch files use the currently entered application data for comparison. A production batch workflow would import one application record per label from COLA or a structured manifest.
