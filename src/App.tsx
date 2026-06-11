import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  Download,
  FileImage,
  Files,
  Gauge,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  Upload,
  XCircle
} from "lucide-react";
import { ChangeEvent, useMemo, useRef, useState } from "react";
import { extractTextFromImage, isImageFile, isTextLikeFile, OcrProgress } from "./ocr";
import { samples } from "./samples";
import {
  ApplicationData,
  CheckResult,
  CheckStatus,
  Decision,
  emptyApplication,
  GOVERNMENT_WARNING,
  verifyLabel,
  VerificationReport
} from "./verification";

type ViewMode = "single" | "batch";

interface QueueItem {
  id: string;
  name: string;
  text: string;
  report: VerificationReport;
  ocrTimedOut?: boolean;
}

const statusCopy: Record<CheckStatus, string> = {
  pass: "Pass",
  review: "Review",
  fail: "Fail"
};

const decisionCopy: Record<Decision, string> = {
  ready: "Ready",
  needs_review: "Needs review",
  return_for_correction: "Return"
};

const decisionDetail: Record<Decision, string> = {
  ready: "No blocking differences detected.",
  needs_review: "Close or visual-only checks need agent judgment.",
  return_for_correction: "One or more required checks failed."
};

function App() {
  const [mode, setMode] = useState<ViewMode>("single");
  const [application, setApplication] = useState<ApplicationData>(emptyApplication);
  const [labelText, setLabelText] = useState(samples[0].text);
  const [sourceName, setSourceName] = useState("Sample label");
  const [queue, setQueue] = useState<QueueItem[]>(() =>
    samples.map((sample) => ({
      id: sample.id,
      name: sample.name,
      text: sample.text,
      report: verifyLabel(sample.application, sample.text, sample.name)
    }))
  );
  const [ocrProgress, setOcrProgress] = useState<OcrProgress | null>(null);
  const [isReading, setIsReading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const batchInputRef = useRef<HTMLInputElement | null>(null);

  const report = useMemo(
    () => verifyLabel(application, labelText, sourceName),
    [application, labelText, sourceName]
  );

  const reportCounts = useMemo(
    () => ({
      pass: report.checks.filter((check) => check.status === "pass").length,
      review: report.checks.filter((check) => check.status === "review").length,
      fail: report.checks.filter((check) => check.status === "fail").length
    }),
    [report.checks]
  );

  const summary = useMemo(() => {
    const total = queue.length || 1;
    return {
      ready: queue.filter((item) => item.report.decision === "ready").length,
      review: queue.filter((item) => item.report.decision === "needs_review").length,
      return: queue.filter((item) => item.report.decision === "return_for_correction").length,
      averageScore: Math.round(
        queue.reduce((sum, item) => sum + item.report.score, 0) / total
      )
    };
  }, [queue]);

  function updateApplication<K extends keyof ApplicationData>(
    key: K,
    value: ApplicationData[K]
  ) {
    setApplication((current) => ({ ...current, [key]: value }));
  }

  function loadSample(sampleId: string) {
    const sample = samples.find((item) => item.id === sampleId);
    if (!sample) return;
    setApplication(sample.application);
    setLabelText(sample.text);
    setSourceName(sample.name);
  }

  async function handleSingleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setSourceName(file.name);
    await readFileIntoSingle(file);
    event.target.value = "";
  }

  async function readFileIntoSingle(file: File) {
    setIsReading(true);
    setOcrProgress(null);
    try {
      if (isImageFile(file)) {
        const result = await extractTextFromImage(file, setOcrProgress);
        setLabelText(
          result.timedOut
            ? `OCR timed out after ${result.durationMs} ms. Agent review required.`
            : result.text
        );
      } else if (isTextLikeFile(file)) {
        setLabelText(await file.text());
      }
    } finally {
      setIsReading(false);
      setOcrProgress(null);
    }
  }

  async function handleBatchFiles(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;
    setIsReading(true);
    setOcrProgress(null);
    const nextItems: QueueItem[] = [];

    for (const file of files) {
      let text = "";
      let ocrTimedOut = false;
      if (isImageFile(file)) {
        const result = await extractTextFromImage(file, setOcrProgress);
        text = result.text || `OCR timed out after ${result.durationMs} ms.`;
        ocrTimedOut = result.timedOut;
      } else if (isTextLikeFile(file)) {
        text = await file.text();
      } else {
        text = `Unsupported file type: ${file.type || "unknown"}`;
      }

      nextItems.push({
        id: crypto.randomUUID(),
        name: file.name,
        text,
        ocrTimedOut,
        report: verifyLabel(application, text, file.name)
      });
    }

    setQueue((current) => [...nextItems, ...current]);
    setIsReading(false);
    setOcrProgress(null);
    event.target.value = "";
  }

  function addCurrentToBatch() {
    setQueue((current) => [
      {
        id: crypto.randomUUID(),
        name: sourceName,
        text: labelText,
        report
      },
      ...current
    ]);
    setMode("batch");
  }

  function exportBatch() {
    const payload = queue.map((item) => ({
      file: item.name,
      decision: item.report.decision,
      score: item.report.score,
      checks: item.report.checks.map((check) => ({
        field: check.label,
        status: check.status,
        expected: check.expected,
        found: check.found,
        detail: check.detail
      }))
    }));
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "labelcheck-results.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand-block">
          <div className="mark">
            <ShieldCheck aria-hidden="true" size={26} />
          </div>
          <div>
            <p className="eyebrow">TTB prototype</p>
            <h1>LabelCheck AI</h1>
          </div>
        </div>
        <div className="topbar-right">
          <div className={`live-status ${report.decision}`} aria-label="Current result">
            <span className="status-dot" />
            <div>
              <span>Current result</span>
              <strong>{decisionCopy[report.decision]}</strong>
            </div>
          </div>
          <div className="topbar-actions" role="tablist" aria-label="Workspace">
            <button
              className={mode === "single" ? "tab active" : "tab"}
              type="button"
              role="tab"
              aria-selected={mode === "single"}
              onClick={() => setMode("single")}
            >
              <ClipboardCheck aria-hidden="true" size={18} />
              Single review
            </button>
            <button
              className={mode === "batch" ? "tab active" : "tab"}
              type="button"
              role="tab"
              aria-selected={mode === "batch"}
              onClick={() => setMode("batch")}
            >
              <Files aria-hidden="true" size={18} />
              Batch queue
            </button>
          </div>
        </div>
      </header>

      {mode === "single" ? (
        <section className="workspace" aria-label="Single label review">
          <aside className="panel app-panel form-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">COLA application</p>
                <h2>Expected values</h2>
              </div>
              <select
                aria-label="Load sample"
                value=""
                onChange={(event) => loadSample(event.target.value)}
              >
                <option value="" disabled>
                  Load sample
                </option>
                {samples.map((sample) => (
                  <option key={sample.id} value={sample.id}>
                    {sample.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="case-strip" aria-label="Application profile">
              <span>{application.beverageType.replace("_", " ")}</span>
              <span>{application.imported ? "Imported" : "Domestic"}</span>
              <span>{application.netContents || "Net contents missing"}</span>
            </div>

            <div className="form-grid">
              <label>
                <span>Brand name</span>
                <input
                  value={application.brandName}
                  onChange={(event) => updateApplication("brandName", event.target.value)}
                />
              </label>
              <label>
                <span>Class/type</span>
                <input
                  value={application.classType}
                  onChange={(event) => updateApplication("classType", event.target.value)}
                />
              </label>
              <label>
                <span>Alcohol content</span>
                <input
                  value={application.alcoholContent}
                  onChange={(event) =>
                    updateApplication("alcoholContent", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Net contents</span>
                <input
                  value={application.netContents}
                  onChange={(event) => updateApplication("netContents", event.target.value)}
                />
              </label>
              <label className="wide">
                <span>Name and address</span>
                <input
                  value={application.nameAndAddress}
                  onChange={(event) =>
                    updateApplication("nameAndAddress", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Beverage type</span>
                <select
                  value={application.beverageType}
                  onChange={(event) =>
                    updateApplication(
                      "beverageType",
                      event.target.value as ApplicationData["beverageType"]
                    )
                  }
                >
                  <option value="distilled_spirits">Distilled spirits</option>
                  <option value="wine">Wine</option>
                  <option value="malt_beverage">Malt beverage</option>
                </select>
              </label>
              <label className="checkbox-row">
                <input
                  type="checkbox"
                  checked={application.imported}
                  onChange={(event) => updateApplication("imported", event.target.checked)}
                />
                <span>Imported product</span>
              </label>
              {application.imported ? (
                <label className="wide">
                  <span>Country of origin</span>
                  <input
                    value={application.countryOfOrigin}
                    onChange={(event) =>
                      updateApplication("countryOfOrigin", event.target.value)
                    }
                  />
                </label>
              ) : null}
            </div>
          </aside>

          <section className="review-column">
            <div className="panel input-panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">Label artwork text</p>
                  <h2>Input</h2>
                </div>
                <div className="button-row">
                  <input
                    ref={fileInputRef}
                    className="hidden-input"
                    type="file"
                    accept="image/*,.txt,.csv,.json,text/*"
                    onChange={handleSingleFile}
                  />
                  <button
                    className="secondary-button compact"
                    type="button"
                    title="Upload label file"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload aria-hidden="true" size={18} />
                    Upload
                  </button>
                  <button
                    className="secondary-button compact"
                    type="button"
                    title="Add current review to batch"
                    onClick={addCurrentToBatch}
                  >
                    <Files aria-hidden="true" size={18} />
                    Add to batch
                  </button>
                </div>
              </div>

              <textarea
                aria-label="Extracted or pasted label text"
                value={labelText}
                onChange={(event) => setLabelText(event.target.value)}
                spellCheck={false}
              />

              <div className="input-footer">
                <div className="source-pill">
                  <FileImage aria-hidden="true" size={16} />
                  {sourceName}
                </div>
                {isReading ? (
                  <div className="progress-line">
                    <Loader2 aria-hidden="true" size={16} className="spin" />
                    {ocrProgress
                      ? `${ocrProgress.status} ${ocrProgress.progress}%`
                      : "Reading file"}
                  </div>
                ) : null}
              </div>
            </div>

            <ReportPanel report={report} counts={reportCounts} />
          </section>
        </section>
      ) : (
        <section className="batch-layout" aria-label="Batch label review">
          <div className="metric-strip">
            <Metric label="Ready" value={summary.ready} tone="pass" />
            <Metric label="Needs review" value={summary.review} tone="review" />
            <Metric label="Return" value={summary.return} tone="fail" />
            <Metric label="Avg. score" value={`${summary.averageScore}%`} tone="neutral" />
          </div>

          <div className="batch-toolbar">
            <div>
              <p className="eyebrow">Batch intake</p>
              <h2>{queue.length} labels in queue</h2>
            </div>
            <div className="button-row">
              <input
                ref={batchInputRef}
                className="hidden-input"
                type="file"
                multiple
                accept="image/*,.txt,.csv,.json,text/*"
                onChange={handleBatchFiles}
              />
              <button
                className="primary-button"
                type="button"
                onClick={() => batchInputRef.current?.click()}
              >
                <Upload aria-hidden="true" size={18} />
                Upload batch
              </button>
              <button className="secondary-button" type="button" onClick={exportBatch}>
                <Download aria-hidden="true" size={18} />
                Export JSON
              </button>
              <button className="icon-button" type="button" title="Reload samples" onClick={() => {
                setQueue(
                  samples.map((sample) => ({
                    id: sample.id,
                    name: sample.name,
                    text: sample.text,
                    report: verifyLabel(sample.application, sample.text, sample.name)
                  }))
                );
              }}>
                <RefreshCw aria-hidden="true" size={18} />
              </button>
            </div>
          </div>

          {isReading ? (
            <div className="batch-progress">
              <Loader2 aria-hidden="true" size={18} className="spin" />
              {ocrProgress
                ? `${ocrProgress.status} ${ocrProgress.progress}%`
                : "Reading batch files"}
            </div>
          ) : null}

          <div className="queue">
            {queue.map((item) => (
              <article className={`queue-card ${item.report.decision}`} key={item.id}>
                <div className="queue-card-main">
                  <div className={`decision-badge ${item.report.decision}`}>
                    {decisionCopy[item.report.decision]}
                  </div>
                  <div>
                    <h3>{item.name}</h3>
                    <p>{decisionDetail[item.report.decision]}</p>
                  </div>
                </div>
                <div className="queue-score">
                  <Gauge aria-hidden="true" size={18} />
                  {item.report.score}%
                </div>
                <div className="queue-meter" aria-hidden="true">
                  <span style={{ width: `${item.report.score}%` }} />
                </div>
                <div className="mini-checks">
                  {item.report.checks.slice(0, 5).map((check) => (
                    <span key={check.id} className={`mini-check ${check.status}`}>
                      {check.label}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <footer className="reference-bar">
        <Search aria-hidden="true" size={16} />
        Warning rule uses current TTB wording. The visual bold/type-size check is marked for
        manual review when only plain OCR text is available.
      </footer>
    </main>
  );
}

function ReportPanel({
  report,
  counts
}: {
  report: VerificationReport;
  counts: Record<CheckStatus, number>;
}) {
  return (
    <section className="panel report-panel" aria-label="Verification result">
      <div className="result-header">
        <div className="result-copy">
          <p className="eyebrow">Review result</p>
          <h2>{decisionCopy[report.decision]}</h2>
          <p>{decisionDetail[report.decision]}</p>
          <div className="review-pulse" aria-label="Check status summary">
            <span className="pass">
              <strong>{counts.pass}</strong> pass
            </span>
            <span className="review">
              <strong>{counts.review}</strong> review
            </span>
            <span className="fail">
              <strong>{counts.fail}</strong> fail
            </span>
          </div>
        </div>
        <div className="score-card">
          <div className={`score-ring ${report.decision}`}>
            <strong>{report.score}%</strong>
            <span>{report.durationMs} ms</span>
          </div>
          <div className="score-meter" aria-hidden="true">
            <span style={{ width: `${report.score}%` }} />
          </div>
        </div>
      </div>

      <div className="checks">
        {report.checks.map((check) => (
          <CheckRow key={check.id} check={check} />
        ))}
      </div>

      <details className="warning-details">
        <summary>Required warning text</summary>
        <p>{GOVERNMENT_WARNING}</p>
      </details>
    </section>
  );
}

function CheckRow({ check }: { check: CheckResult }) {
  const Icon =
    check.status === "pass" ? CheckCircle2 : check.status === "review" ? AlertCircle : XCircle;

  return (
    <article className={`check-row ${check.status}`}>
      <div className="check-icon">
        <Icon aria-hidden="true" size={20} />
      </div>
      <div>
        <div className="check-title">
          <h3>{check.label}</h3>
          <span>{statusCopy[check.status]}</span>
        </div>
        <p>{check.detail}</p>
        <dl>
          <div>
            <dt>Expected</dt>
            <dd>{check.expected}</dd>
          </div>
          <div>
            <dt>Found</dt>
            <dd>{check.found}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  tone
}: {
  label: string;
  value: string | number;
  tone: "pass" | "review" | "fail" | "neutral";
}) {
  return (
    <div className={`metric ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default App;
