import { useNavigate } from "react-router-dom";
import type { Category } from "../types";

interface CategoryCardProps {
  category: Category;
  productCount?: number;
}

export default function CategoryCard({
  category,
  productCount,
}: CategoryCardProps) {
  const navigate = useNavigate();

  return (
    <div
      onClick={() => navigate(`/categoria/${category.slug}`)}
      className="group cursor-pointer overflow-hidden rounded-lg sm:rounded-xl border border-gray-700 bg-gradient-to-br from-purple-900/30 to-gray-800/50 p-4 sm:p-6 backdrop-blur-lg transition hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/20 active:scale-[0.98]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-xl font-bold text-white group-hover:text-purple-400 truncate">
            {category.name}
          </h3>
          {category.description && (
            <p className="mt-1 sm:mt-2 line-clamp-2 text-xs sm:text-sm text-gray-400">
              {category.description}
            </p>
          )}
          {productCount !== undefined && (
            <p className="mt-2 sm:mt-3 text-[10px] sm:text-xs text-gray-500">
              {productCount} {productCount === 1 ? "producto" : "productos"}
            </p>
          )}
        </div>
        <div className="flex-shrink-0">
          <svg
            className="h-6 w-6 sm:h-8 sm:w-8 text-purple-400 transition group-hover:translate-x-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5l7 7-7 7"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
