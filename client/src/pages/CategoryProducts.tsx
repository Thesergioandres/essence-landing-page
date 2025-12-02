import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { categoryService, productService } from "../api/services";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import ProductCard from "../components/ProductCard";
import type { Category, Product } from "../types";

export default function CategoryProducts() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      if (!slug) {
        setError("Categoría no válida");
        setLoading(false);
        return;
      }

      try {
        // Get all categories
        const categoriesData = await categoryService.getAll();
        const foundCategory = categoriesData.find(cat => cat.slug === slug);

        if (!foundCategory) {
          setError("Categoría no encontrada");
          setLoading(false);
          return;
        }

        setCategory(foundCategory);

        // Get products for this category
        const productsResponse = await productService.getAll();
        const productsData = productsResponse.data || productsResponse;
        const categoryProducts = productsData.filter(
          p => p.category._id === foundCategory._id
        );
        setProducts(categoryProducts);
      } catch (error) {
        console.error("Error loading data:", error);
        setError("Error al cargar los productos");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [slug]);

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

  if (error || !category) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
        <Navbar />
        <div className="flex min-h-[60vh] flex-col items-center justify-center">
          <p className="text-xl text-gray-400">
            {error || "Categoría no encontrada"}
          </p>
          <button
            onClick={() => navigate("/")}
            className="mt-4 text-purple-400 hover:text-purple-300"
          >
            Volver al inicio
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

        {/* Category Header */}
        <div className="mb-12 text-center">
          <h1 className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-5xl font-bold text-transparent">
            {category.name}
          </h1>
          {category.description && (
            <p className="mt-4 text-lg text-gray-400">{category.description}</p>
          )}
          <p className="mt-2 text-sm text-gray-500">
            {products.length} producto{products.length !== 1 ? "s" : ""}{" "}
            disponible
            {products.length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Products Grid */}
        {products.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map(product => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <p className="text-xl text-gray-400">
              No hay productos disponibles en esta categoría
            </p>
            <button
              onClick={() => navigate("/productos")}
              className="mt-4 text-purple-400 hover:text-purple-300"
            >
              Ver todos los productos
            </button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
}
