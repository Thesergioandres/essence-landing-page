import { Check, Copy, ExternalLink, Eye, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { LoadingSpinner } from "../../../shared/components/ui";

export default function DistributorCatalogShare() {
  const [loading, setLoading] = useState(true);
  const [catalogUrl, setCatalogUrl] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");

        // Generar URL del catálogo
        const baseUrl = window.location.origin;
        const url = `${baseUrl}/distributor-catalog/${user._id}`;
        setCatalogUrl(url);
      } catch (error) {
        console.error("Error al cargar datos:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(catalogUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Error al copiar:", error);
    }
  };

  const handleShareWhatsApp = () => {
    const message = encodeURIComponent(
      `¡Mira mi catálogo de productos! 🛍️\n\n${catalogUrl}`
    );
    window.open(`https://wa.me/?text=${message}`, "_blank");
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent("Catálogo de Productos");
    const body = encodeURIComponent(
      `¡Hola!\n\nTe comparto mi catálogo de productos:\n\n${catalogUrl}\n\n¡Espero que encuentres algo que te guste!`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleOpenPreview = () => {
    window.open(catalogUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <LoadingSpinner size="lg" message="Cargando..." />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Compartir Catálogo</h1>
        <p className="mt-2 text-gray-300">
          Comparte tu catálogo de productos con tus clientes
        </p>
      </div>

      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-6">
        <div className="space-y-6">
          {/* URL del catálogo */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              URL del Catálogo
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={catalogUrl}
                readOnly
                className="flex-1 rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2.5 text-gray-100"
              />
              <button
                onClick={handleCopy}
                className="rounded-lg border border-gray-700 bg-gray-900/40 px-4 py-2.5 text-gray-100 transition hover:bg-gray-700"
              >
                {copied ? (
                  <Check className="h-5 w-5 text-green-500" />
                ) : (
                  <Copy className="h-5 w-5" />
                )}
              </button>
            </div>
            {copied && (
              <p className="mt-2 text-sm text-green-400">
                ¡URL copiada al portapapeles!
              </p>
            )}
          </div>

          {/* Botones de compartir */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Compartir por
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <button
                onClick={handleShareWhatsApp}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-green-600 px-4 py-3 text-white transition hover:bg-green-700"
              >
                <Share2 className="h-5 w-5" />
                WhatsApp
              </button>
              <button
                onClick={handleShareEmail}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-blue-600 px-4 py-3 text-white transition hover:bg-blue-700"
              >
                <Share2 className="h-5 w-5" />
                Correo
              </button>
              <button
                onClick={handleOpenPreview}
                className="flex items-center justify-center gap-2 rounded-lg border border-gray-700 bg-purple-600 px-4 py-3 text-white transition hover:bg-purple-700"
              >
                <Eye className="h-5 w-5" />
                Vista Previa
              </button>
            </div>
          </div>

          {/* Información adicional */}
          <div className="rounded-lg border border-gray-700 bg-gray-900/40 p-4">
            <h3 className="mb-2 font-medium text-white">ℹ️ Información</h3>
            <ul className="space-y-1 text-sm text-gray-300">
              <li>
                • El catálogo muestra todos los productos que tienes disponibles
              </li>
              <li>
                • Los clientes pueden ver los precios y detalles de los
                productos
              </li>
              <li>
                • La URL es pública y puede ser compartida con cualquier persona
              </li>
              <li>
                • El catálogo se actualiza automáticamente con tu inventario
              </li>
            </ul>
          </div>

          {/* QR Code (opcional, para futuras mejoras) */}
          <div className="text-center">
            <a
              href={catalogUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-purple-400 hover:text-purple-300"
            >
              <ExternalLink className="h-4 w-4" />
              Abrir catálogo en nueva pestaña
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
