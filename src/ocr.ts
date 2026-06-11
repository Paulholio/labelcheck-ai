import { recognize } from "tesseract.js";

export interface OcrProgress {
  status: string;
  progress: number;
}

export interface OcrResult {
  text: string;
  durationMs: number;
  timedOut: boolean;
}

export async function extractTextFromImage(
  file: File,
  onProgress: (progress: OcrProgress) => void,
  timeoutMs = 5000
): Promise<OcrResult> {
  const started = performance.now();
  let timeoutId: number | undefined;

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error("OCR_TIMEOUT"));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([
      recognize(file, "eng", {
        workerPath: "/ocr/worker.min.js",
        corePath: "/ocr/core",
        langPath: "/ocr/lang",
        gzip: false,
        logger(message) {
          if (typeof message.progress === "number") {
            onProgress({
              status: message.status ?? "OCR",
              progress: Math.round(message.progress * 100)
            });
          }
        }
      }),
      timeout
    ]);

    return {
      text: result.data.text,
      durationMs: Math.round(performance.now() - started),
      timedOut: false
    };
  } catch (error) {
    if (error instanceof Error && error.message === "OCR_TIMEOUT") {
      return {
        text: "",
        durationMs: Math.round(performance.now() - started),
        timedOut: true
      };
    }
    throw error;
  } finally {
    if (timeoutId != null) window.clearTimeout(timeoutId);
  }
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith("image/");
}

export function isTextLikeFile(file: File): boolean {
  return (
    file.type.startsWith("text/") ||
    file.name.endsWith(".txt") ||
    file.name.endsWith(".csv") ||
    file.name.endsWith(".json")
  );
}
