import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { productService } from "../api/services";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import type { Product } from "../types";

export default function ProductDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProduct = async () => {
      if (!id) {
        setError("ID de producto no válido");
        setLoading(false);
        return;
      }

      try {
        const data = await productService.getById(id);
        setProduct(data);
      } catch (error) {
        console.error("Error loading product:", error);
        setError("Producto no encontrado");
      } finally {
        setLoading(false);
      }
    };

    loadProduct();
  }, [id]);

  const handleWhatsAppContact = () => {
    if (!product) return;
    const message = `Hola, estoy interesado en el producto: ${product.name}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
        <Navbar />
        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-500"></div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
        <Navbar />
        <div className="flex min-h-[60vh] flex-col items-center justify-center">
          <p className="text-xl text-gray-400">
            {error || "Producto no encontrado"}
          </p>
          <button
            onClick={() => navigate("/productos")}
            className="mt-4 text-purple-400 hover:text-purple-300"
          >
            Volver al catálogo
          </button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="mb-6 flex items-center text-gray-400 transition hover:text-purple-400"
        >
          <svg
            className="mr-2 h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Volver
        </button>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Product Image */}
          <div className="relative overflow-hidden rounded-2xl border border-gray-700 bg-gray-800/50 p-8">
            {product.featured && (
              <div className="absolute left-4 top-4 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-3 py-1 text-xs font-semibold text-white">
                Destacado
              </div>
            )}
            <img
              src={
                product.image?.url ||
                "https://placehold.co/600x600/1f2937/9333ea?text=Sin+Imagen"
              }
              alt={product.name}
              className="h-full w-full rounded-lg object-cover"
            />
          </div>

          {/* Product Info */}
          <div className="flex flex-col">
            {/* Category Badge */}
            <div className="mb-4">
              <button
                onClick={() => navigate(`/categoria/${product.category.slug}`)}
                className="inline-block rounded-full bg-purple-900/50 px-4 py-1 text-sm text-purple-300 transition hover:bg-purple-900/70"
              >
                {product.category.name}
              </button>
            </div>

            {/* Product Name */}
            <h1 className="mb-4 text-4xl font-bold text-white">
              {product.name}
            </h1>

            {/* Price */}
            <div className="mb-6">
              <p className="text-3xl font-bold text-purple-400">
                ${product.price.toLocaleString()}
              </p>
            </div>

            {/* Stock Status */}
            <div className="mb-6">
              {product.stock > 0 ? (
                <span className="inline-flex items-center rounded-full bg-green-900/30 px-3 py-1 text-sm font-medium text-green-400">
                  <svg
                    className="mr-1 h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  En stock ({product.stock} disponibles)
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-red-900/30 px-3 py-1 text-sm font-medium text-red-400">
                  <svg
                    className="mr-1 h-4 w-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Agotado
                </span>
              )}
            </div>

            {/* Description */}
            <div className="mb-6">
              <h2 className="mb-2 text-lg font-semibold text-white">
                Descripción
              </h2>
              <p className="text-gray-400">{product.description}</p>
            </div>

            {/* Ingredients */}
            {product.ingredients && product.ingredients.length > 0 && (
              <div className="mb-6">
                <h2 className="mb-2 text-lg font-semibold text-white">
                  Ingredientes
                </h2>
                <ul className="list-inside list-disc space-y-1 text-gray-400">
                  {product.ingredients.map((ingredient, index) => (
                    <li key={index}>{ingredient}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Benefits */}
            {product.benefits && product.benefits.length > 0 && (
              <div className="mb-8">
                <h2 className="mb-2 text-lg font-semibold text-white">
                  Beneficios
                </h2>
                <ul className="list-inside list-disc space-y-1 text-gray-400">
                  {product.benefits.map((benefit, index) => (
                    <li key={index}>{benefit}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* WhatsApp Button */}
            <button
              onClick={handleWhatsAppContact}
              className="flex items-center justify-center rounded-full bg-gradient-to-r from-green-600 to-green-500 px-8 py-4 font-semibold text-white transition hover:from-green-700 hover:to-green-600"
            >
              <svg
                className="mr-2 h-6 w-6"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
              </svg>
              Contactar por WhatsApp
            </button>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
