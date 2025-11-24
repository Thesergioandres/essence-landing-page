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
      className="group cursor-pointer overflow-hidden rounded-xl border border-gray-700 bg-gradient-to-br from-purple-900/30 to-gray-800/50 p-6 backdrop-blur-lg transition hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/20"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-xl font-bold text-white group-hover:text-purple-400">
            {category.name}
          </h3>
          {category.description && (
            <p className="mt-2 line-clamp-2 text-sm text-gray-400">
              {category.description}
            </p>
          )}
          {productCount !== undefined && (
            <p className="mt-3 text-xs text-gray-500">
              {productCount} {productCount === 1 ? "producto" : "productos"}
            </p>
          )}
        </div>
        <div className="ml-4">
          <svg
            className="h-8 w-8 text-purple-400 transition group-hover:translate-x-1"
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
