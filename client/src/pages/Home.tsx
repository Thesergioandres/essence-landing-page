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
        const products = productsData.data || productsData;
        const featured = products
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
              const prods = products.filter(
                (p: Product) => p.category._id === cat._id
              );
              return { ...cat, productCount: prods.length };
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
    <div className="min-h-screen bg-linear-to-br from-gray-900 via-purple-900/20 to-gray-900">
      <Navbar />

      {/* Hero Section */}
      <Hero />

      {/* Featured Products */}
      <section className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8 py-10 sm:py-12 md:py-16">
        <div className="mb-6 sm:mb-8 md:mb-12 text-center">
          <h2 className="bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-2xl sm:text-3xl md:text-4xl font-bold text-transparent">
            Productos Destacados
          </h2>
          <p className="mt-2 text-sm sm:text-base text-gray-400">
            Los mejores productos seleccionados para ti
          </p>
        </div>

        {loading ? (
          <div className="grid gap-4 sm:gap-5 md:gap-6 grid-cols-1 xs:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
                  <div className="aspect-square bg-gray-700"></div>
                  <div className="p-4 sm:p-5 space-y-3">
                    <div className="h-3 bg-gray-700 rounded w-1/3"></div>
                    <div className="h-4 bg-gray-700 rounded w-3/4"></div>
                    <div className="h-3 bg-gray-700 rounded w-full"></div>
                    <div className="h-3 bg-gray-700 rounded w-2/3"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : featuredProducts.length > 0 ? (
          <div className="grid gap-4 sm:gap-5 md:gap-6 grid-cols-1 xs:grid-cols-2 lg:grid-cols-3">
            {featuredProducts.map(product => (
              <ProductCard key={product._id} product={product} />
            ))}
          </div>
        ) : (
          <p className="text-center text-sm sm:text-base text-gray-400">
            No hay productos destacados disponibles
          </p>
        )}

        <div className="mt-8 sm:mt-10 md:mt-12 text-center">
          <a
            href="/productos"
            className="inline-block w-full sm:w-auto rounded-xl sm:rounded-full bg-linear-to-r from-purple-600 to-pink-600 px-6 sm:px-8 py-3.5 sm:py-4 text-base sm:text-lg font-semibold text-white transition hover:from-purple-700 hover:to-pink-700 active:scale-[0.98] min-h-[52px]"
          >
            Ver todos los productos
          </a>
        </div>
      </section>

      {/* Categories */}
      {categories.length > 0 && (
        <section className="border-t border-gray-700 bg-gray-900/50 py-10 sm:py-12 md:py-16">
          <div className="mx-auto max-w-7xl px-3 sm:px-4 md:px-6 lg:px-8">
            <div className="mb-6 sm:mb-8 md:mb-12 text-center">
              <h2 className="bg-linear-to-r from-purple-400 to-pink-400 bg-clip-text text-2xl sm:text-3xl md:text-4xl font-bold text-transparent">
                Categorías
              </h2>
              <p className="mt-2 text-sm sm:text-base text-gray-400">
                Explora nuestra variedad de productos
              </p>
            </div>

            <div className="grid gap-4 sm:gap-5 md:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {categories.map(category => (
                <CategoryCard 
                  key={category._id} 
                  category={category} 
                  productCount={category.productCount}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      <Footer />
    </div>
  );
}
