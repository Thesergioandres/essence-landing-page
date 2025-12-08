import { useNavigate } from "react-router-dom";
import type { Product } from "../types";

interface ProductCardProps {
  product: Product;
  viewMode?: "grid" | "list";
}

export default function ProductCard({ product, viewMode = "grid" }: ProductCardProps) {
  const navigate = useNavigate();

  const categoryName =
    typeof product.category === "string"
      ? product.category
      : product.category.name;

  const isOutOfStock = !product.totalStock || product.totalStock === 0;
  const isLowStock = product.totalStock && product.totalStock < 10 && product.totalStock > 0;

  if (viewMode === "list") {
    return (
      <div
        onClick={() => navigate(`/producto/${product._id}`)}
        className="group cursor-pointer overflow-hidden rounded-2xl border border-gray-800/50 bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl transition-all duration-300 hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-500/20 hover:scale-[1.01]"
      >
        <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 sm:p-6">
          {/* Image */}
          <div className="relative w-full sm:w-48 h-48 flex-shrink-0 overflow-hidden rounded-xl bg-gray-950/50">
            {product.image?.url ? (
              <img
                src={product.image.url}
                alt={product.name}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                loading="lazy"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <svg
                  className="h-16 w-16 text-gray-700"
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

            {/* Badges */}
            <div className="absolute top-2 left-2 flex flex-wrap gap-2">
              {product.featured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 px-3 py-1 text-xs font-bold text-white shadow-lg">
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  Destacado
                </span>
              )}
              {isLowStock && (
                <span className="rounded-full bg-red-500/90 backdrop-blur-sm px-3 py-1 text-xs font-bold text-white shadow-lg">
                  ¡Pocas unidades!
                </span>
              )}
              {isOutOfStock && (
                <span className="rounded-full bg-gray-600/90 backdrop-blur-sm px-3 py-1 text-xs font-bold text-white shadow-lg">
                  Agotado
                </span>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col justify-between">
            <div>
              <div className="flex items-start justify-between gap-4 mb-3">
                <div className="flex-1">
                  <span className="inline-block mb-2 text-xs font-bold uppercase text-purple-400 tracking-wider">
                    {categoryName}
                  </span>
                  <h3 className="text-xl sm:text-2xl font-bold text-white leading-tight group-hover:text-purple-400 transition-colors">
                    {product.name}
                  </h3>
                </div>
              </div>
              <p className="text-gray-400 leading-relaxed line-clamp-2 sm:line-clamp-3">
                {product.description}
              </p>
            </div>

            <div className="flex items-end justify-between mt-4 pt-4 border-t border-gray-800/50">
              <div>
                <p className="text-sm text-gray-500 mb-1">Precio</p>
                <p className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  ${product.clientPrice?.toFixed(2) || '0.00'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500 mb-1">Disponibles</p>
                <p className={`text-2xl font-bold ${isOutOfStock ? 'text-gray-600' : isLowStock ? 'text-red-400' : 'text-green-400'}`}>
                  {product.totalStock || 0}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Grid View
  return (
    <div
      onClick={() => navigate(`/producto/${product._id}`)}
      className="group cursor-pointer overflow-hidden rounded-2xl border border-gray-800/50 bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl transition-all duration-300 hover:border-purple-500/50 hover:shadow-2xl hover:shadow-purple-500/20 hover:-translate-y-2"
    >
      {/* Image */}
      <div className="relative aspect-square overflow-hidden bg-gray-950/50">
        {product.image?.url ? (
          <>
            <img
              src={product.image.url}
              alt={product.name}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-900/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <svg
              className="h-20 w-20 text-gray-700 group-hover:text-gray-600 transition-colors"
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

        {/* Badges */}
        <div className="absolute top-3 left-3 right-3 flex justify-between items-start gap-2">
          <div className="flex flex-col gap-2">
            {product.featured && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 px-3 py-1.5 text-xs font-bold text-white shadow-lg animate-pulse">
                <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                Destacado
              </span>
            )}
            {isLowStock && (
              <span className="rounded-full bg-red-500/90 backdrop-blur-sm px-3 py-1.5 text-xs font-bold text-white shadow-lg">
                ¡Solo {product.totalStock}!
              </span>
            )}
          </div>
          {isOutOfStock && (
            <span className="rounded-full bg-gray-700/90 backdrop-blur-sm px-3 py-1.5 text-xs font-bold text-white shadow-lg">
              Agotado
            </span>
          )}
        </div>

        {/* Quick View Button */}
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="rounded-full bg-purple-600/90 backdrop-blur-sm p-2.5 shadow-lg hover:bg-purple-500 transition-colors">
            <svg className="h-5 w-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="mb-3">
          <span className="inline-block text-xs font-bold uppercase text-purple-400 tracking-wider">
            {categoryName}
          </span>
          <h3 className="mt-1.5 text-lg font-bold text-white leading-tight line-clamp-1 group-hover:text-purple-400 transition-colors">
            {product.name}
          </h3>
        </div>
        
        <p className="mb-4 text-sm text-gray-400 leading-relaxed line-clamp-2 min-h-[2.5rem]">
          {product.description}
        </p>

        {/* Price and Stock */}
        <div className="flex items-end justify-between pt-4 border-t border-gray-800/50">
          <div>
            <p className="text-xs text-gray-500 mb-1">Precio</p>
            <p className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              ${product.clientPrice?.toFixed(2) || '0.00'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 mb-1">Stock</p>
            <p className={`text-lg font-bold ${isOutOfStock ? 'text-gray-600' : isLowStock ? 'text-red-400' : 'text-green-400'}`}>
              {product.totalStock || 0}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
