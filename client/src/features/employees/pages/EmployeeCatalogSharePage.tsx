import { Check, Copy, ExternalLink, Eye, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { LoadingSpinner } from "../../../shared/components/ui";

export default function EmployeeCatalogShare() {
  const [loading, setLoading] = useState(true);
  const [catalogUrl, setCatalogUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");

        // Generar URL del catálogo
        const baseUrl = window.location.origin;
        const url = `${baseUrl}/staff-catalog/${user._id}`;
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

  const shareText = "Te comparto mi catalogo de productos.";

  const shareTargets = [
    {
      id: "whatsapp",
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(
        `${shareText}\n${catalogUrl}`
      )}`,
    },
    {
      id: "telegram",
      label: "Telegram",
      href: `https://t.me/share/url?url=${encodeURIComponent(
        catalogUrl
      )}&text=${encodeURIComponent(shareText)}`,
    },
    {
      id: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
        catalogUrl
      )}`,
    },
    {
      id: "x",
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        shareText
      )}&url=${encodeURIComponent(catalogUrl)}`,
    },
    {
      id: "linkedin",
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
        catalogUrl
      )}`,
    },
    {
      id: "email",
      label: "Correo",
      href: `mailto:?subject=${encodeURIComponent(
        "Catalogo de productos"
      )}&body=${encodeURIComponent(`${shareText}\n\n${catalogUrl}`)}`,
    },
  ];

  const handleNativeShare = async () => {
    if (!navigator.share) {
      handleCopy();
      setShareError(
        "Tu navegador no soporta compartir. Copiamos el enlace para ti."
      );
      return;
    }

    try {
      await navigator.share({
        title: "Catalogo de productos",
        text: shareText,
        url: catalogUrl,
      });
      setShareError(null);
    } catch (error) {
      console.error("Error al compartir:", error);
      setShareError("No se pudo abrir el panel de compartir.");
    }
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
        <h1 className="text-3xl font-bold text-white">Compartir catalogo</h1>
        <p className="mt-2 text-gray-300">
          Publica tu catalogo y compártelo en cualquier red social.
        </p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/10 via-white/5 to-white/0 p-6 shadow-2xl backdrop-blur-xl">
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
                className="flex-1 rounded-lg border border-white/10 bg-gray-950/60 px-4 py-2.5 text-gray-100"
              />
              <button
                onClick={handleCopy}
                className="rounded-lg border border-white/10 bg-gray-950/60 px-4 py-2.5 text-gray-100 transition hover:bg-white/10"
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
            {shareError && (
              <p className="mt-2 text-sm text-amber-300">{shareError}</p>
            )}
          </div>

          {/* Botones de compartir */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-300">
              Compartir por cualquier red
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <button
                onClick={handleNativeShare}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-amber-500/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-500"
              >
                <Share2 className="h-5 w-5" />
                Compartir ahora
              </button>
              {shareTargets.map(target => (
                <a
                  key={target.id}
                  href={target.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-gray-950/60 px-4 py-3 text-sm font-semibold text-gray-100 transition hover:bg-white/10"
                >
                  <Share2 className="h-5 w-5" />
                  {target.label}
                </a>
              ))}
              <button
                onClick={handleOpenPreview}
                className="flex items-center justify-center gap-2 rounded-lg border border-white/10 bg-emerald-500/90 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-500"
              >
                <Eye className="h-5 w-5" />
                Vista previa
              </button>
            </div>
          </div>

          {/* Información adicional */}
          <div className="rounded-lg border border-white/10 bg-gray-950/60 p-4">
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
              className="inline-flex items-center gap-2 text-amber-300 hover:text-amber-200"
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
