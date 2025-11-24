import { useEffect, useState } from "react";
import { productService } from "../api/services";
import CategoryCard from "../components/CategoryCard";
import Footer from "../components/Footer";
import Hero from "../components/Hero";
import Navbar from "../components/Navbar";
import ProductCard from "../components/ProductCard";
import type { Product } from "../types";

export default function Home() {
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<
    Array<{
      _id: string;
      name: string;
      description?: string;
      slug: string;
      productCount: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        // Get featured products
        const productsData = await productService.getAll();
        const featured = productsData
          .filter((p: Product) => p.featured)
          .slice(0, 6);
        setFeaturedProducts(featured);

        // Get categories with product count
        const categoriesData = await productService.getAllCategories();
        const categoriesWithCount = await Promise.all(
          categoriesData.map(
            async (cat: {
              _id: string;
              name: string;
              description?: string;
              slug: string;
            }) => {
              const products = productsData.filter(
                (p: Product) => p.category._id === cat._id
              );
              return { ...cat, productCount: products.length };
            }
          )
        );
        setCategories(categoriesWithCount);
      } catch (error) {
        console.error("Error loading data:", error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <Navbar />

      {/* Hero Section */}
      <Hero />

      {/* Featured Products */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="mb-12 text-center">
          <h2 className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-4xl font-bold text-transparent">
            Productos Destacados
          </h2>
          <p className="mt-2 text-gray-400">
            Los mejores productos seleccionados para ti
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center">
            <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-purple-500"></div>
          </div>
        ) : featuredProducts.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredProducts.map(product => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-400">
            No hay productos destacados disponibles
          </p>
        )}

        <div className="mt-12 text-center">
          <a
            href="/productos"
            className="inline-block rounded-full bg-gradient-to-r from-purple-600 to-pink-600 px-8 py-3 font-semibold text-white transition hover:from-purple-700 hover:to-pink-700"
          >
            Ver todos los productos
          </a>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="border-t border-gray-700 bg-gray-900/50 py-16">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-12 text-center">
              <h2 className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-4xl font-bold text-transparent">
                Categorías
              </h2>
              <p className="mt-2 text-gray-400">
                Explora nuestra variedad de productos
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map(category => (
                <CategoryCard key={category._id} category={category} />
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
