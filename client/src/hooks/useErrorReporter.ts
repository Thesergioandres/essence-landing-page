import { useCallback, useState } from "react";
import { issueService, uploadService } from "../features/common/services";
import { getConsoleBuffer } from "../utils/consoleBuffer";

const MAX_LOG_BYTES = 5 * 1024 * 1024; // 5 MB
const encoder = new TextEncoder();

const buildLogs = () => {
  const entries = getConsoleBuffer();
  return entries.map(
    entry =>
      `${new Date(entry.timestamp).toISOString()} [${entry.level.toUpperCase()}] ${entry.message}`
  );
};

const trimLogsIfNeeded = (logs: string[]): string[] => {
  const totalBytes = encoder.encode(logs.join("\n")).length;
  if (totalBytes <= MAX_LOG_BYTES) return logs;

  // Remove oldest until under limit
  const trimmed = [...logs];
  while (
    trimmed.length &&
    encoder.encode(trimmed.join("\n")).length > MAX_LOG_BYTES
  ) {
    trimmed.shift();
  }
  return trimmed;
};

export function useErrorReporter() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const report = useCallback(
    async ({
      message,
      error: err,
      screenshot,
    }: {
      message: string;
      error?: Error;
      screenshot?: File | null;
    }) => {
      setSubmitting(true);
      setError(null);
      setSuccess(null);
      try {
        const logs = trimLogsIfNeeded(buildLogs());
        let screenshotUrl: string | undefined;
        let screenshotPublicId: string | undefined;

        if (screenshot) {
          const uploaded = await uploadService.uploadImage(screenshot);
          screenshotUrl = uploaded.url;
          screenshotPublicId = uploaded.publicId;
        }

        await issueService.create({
          message,
          stackTrace: err?.stack,
          logs,
          clientContext: {
            url: window.location.href,
            userAgent: navigator.userAgent,
            appVersion: import.meta.env.VITE_APP_VERSION || "unknown",
            businessId: localStorage.getItem("businessId"),
          },
          screenshotUrl,
          screenshotPublicId,
        });

        setSuccess("Reporte enviado. Gracias por avisar.");
      } catch (e) {
        console.error("Error enviando reporte", e);
        const msg =
          (e as { response?: { data?: { message?: string } } })?.response?.data
            ?.message || "No se pudo enviar el reporte";
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    },
    []
  );

  return { report, submitting, error, success, setError, setSuccess };
}
