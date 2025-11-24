import { useNavigate } from "react-router-dom";
import type { Product } from "../types";

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();

  const categoryName =
    typeof product.category === "string"
      ? product.category
      : product.category.name;

  return (
    <div
      onClick={() => navigate(`/producto/${product._id}`)}
      className="group cursor-pointer overflow-hidden rounded-lg sm:rounded-xl border border-gray-700 bg-gray-800/50 backdrop-blur-lg transition hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/20 active:scale-[0.98]"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-900">
        {product.image?.url ? (
          <img
            src={product.image.url}
            alt={product.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              className="h-12 w-12 sm:h-20 sm:w-20 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Featured Badge */}
        {product.featured && (
          <div className="absolute right-2 sm:right-3 top-2 sm:top-3 rounded-full bg-yellow-500 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold text-gray-900">
            ⭐ Destacado
          </div>
        )}

        {/* Stock Badge */}
        {product.totalStock && product.totalStock < 10 && product.totalStock > 0 && (
          <div className="absolute left-2 sm:left-3 top-2 sm:top-3 rounded-full bg-red-500 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold text-white">
            ¡Pocas unidades!
          </div>
        )}
        {(!product.totalStock || product.totalStock === 0) && (
          <div className="absolute left-2 sm:left-3 top-2 sm:top-3 rounded-full bg-gray-500 px-2 sm:px-3 py-1 text-[10px] sm:text-xs font-bold text-white">
            Agotado
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 sm:p-4">
        <p className="mb-1 text-[10px] sm:text-xs font-semibold uppercase text-purple-400">
          {categoryName}
        </p>
        <h3 className="mb-2 line-clamp-1 text-base sm:text-lg font-bold text-white">
          {product.name}
        </h3>
        <p className="mb-3 sm:mb-4 line-clamp-2 text-xs sm:text-sm text-gray-400">
          {product.description}
        </p>

        {/* Price and Stock */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xl sm:text-2xl font-bold text-purple-400">
              ${product.clientPrice?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] sm:text-xs text-gray-500">Stock: {product.totalStock || 0}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
