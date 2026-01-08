import { useRef, useState } from "react";
import { useErrorReporter } from "../hooks/useErrorReporter";

export default function ReportIssueButton() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { report, submitting, error, success, setError, setSuccess } =
    useErrorReporter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    await report({ message, screenshot });
    if (!error) {
      setMessage("");
      setScreenshot(null);
    }
  };

  const closeModal = () => {
    if (submitting) return;
    setOpen(false);
    setError(null);
    setSuccess(null);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-[45] rounded-full bg-gradient-to-r from-purple-600 to-fuchsia-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-purple-900/40 transition hover:from-purple-700 hover:to-fuchsia-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
        aria-label="Reportar un problema"
      >
        Reportar problema
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0f1018] p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-purple-200">
                  Reporte interno
                </p>
                <h3 className="text-xl font-bold">Cuéntanos qué falló</h3>
                <p className="text-sm text-gray-300">
                  Incluiremos automáticamente los logs recientes y la URL
                  actual.
                </p>
              </div>
              <button
                onClick={closeModal}
                className="text-gray-400 transition hover:text-white"
                aria-label="Cerrar"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-gray-200">
                  Descripción
                </label>
                <textarea
                  required
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="¿Qué estabas haciendo? ¿Qué esperabas que ocurriera?"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-200">
                  Captura de pantalla (opcional)
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10"
                  >
                    {screenshot ? "Cambiar captura" : "Subir captura"}
                  </button>
                  <span className="text-sm text-gray-300">
                    {screenshot
                      ? screenshot.name
                      : "Ningún archivo seleccionado"}
                  </span>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={e => setScreenshot(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <p className="text-xs text-gray-400">
                  Tamaño máximo de logs: 5MB. La captura se subirá a Cloudinary.
                </p>
              </div>

              {error && (
                <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-300">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-3 text-sm text-green-200">
                  {success}
                </div>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-white/10 px-4 py-2 text-sm text-gray-200 transition hover:border-white/30"
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting || !message.trim()}
                  className="rounded-lg bg-gradient-to-r from-purple-600 to-fuchsia-600 px-5 py-2 text-sm font-semibold text-white transition hover:from-purple-700 hover:to-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {submitting ? "Enviando..." : "Enviar reporte"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
