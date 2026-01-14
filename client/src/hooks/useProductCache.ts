/**
 * Hook para caché de productos con TTL configurable
 * Optimiza la carga de productos evitando llamadas repetidas a la API
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { categoryService, productService } from "../api/services";

interface Product {
  _id: string;
  name: string;
  category?: { _id: string; name: string } | string;
  totalStock?: number;
  warehouseStock?: number;
  purchasePrice?: number;
  averageCost?: number;
  suggestedPrice?: number;
  clientPrice?: number;
  image?: { url: string };
}

interface Category {
  _id: string;
  name: string;
}

interface CacheData {
  products: Product[];
  categories: Category[];
  timestamp: number;
}

// Caché global en memoria (compartida entre todas las instancias del hook)
let globalCache: CacheData | null = null;
let isFetching = false;
let fetchPromise: Promise<CacheData> | null = null;

// TTL por defecto: 5 minutos
const DEFAULT_TTL_MS = 5 * 60 * 1000;

// Clave para sessionStorage
const CACHE_KEY = "product_selector_cache";

/**
 * Guarda el caché en sessionStorage para persistencia entre navegaciones
 */
function saveToStorage(data: CacheData) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("Error saving product cache to sessionStorage:", error);
  }
}

/**
 * Recupera el caché de sessionStorage
 */
function loadFromStorage(): CacheData | null {
  try {
    const stored = sessionStorage.getItem(CACHE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as CacheData;
      // Verificar que el caché no ha expirado
      if (Date.now() - data.timestamp < DEFAULT_TTL_MS) {
        return data;
      }
    }
  } catch (error) {
    console.warn("Error loading product cache from sessionStorage:", error);
  }
  return null;
}

/**
 * Obtiene los productos y categorías de la API
 */
async function fetchData(): Promise<CacheData> {
  const [productsRes, categoriesRes] = await Promise.all([
    productService.getAll({ limit: 1000 }),
    categoryService.getAll(),
  ]);

  const data: CacheData = {
    products: (productsRes.data || []) as Product[],
    categories: categoriesRes || [],
    timestamp: Date.now(),
  };

  // Guardar en caché global y sessionStorage
  globalCache = data;
  saveToStorage(data);

  return data;
}

interface UseProductCacheOptions {
  /**
   * Time-to-live en milisegundos para el caché
   * @default 300000 (5 minutos)
   */
  ttl?: number;
  /**
   * Si es true, fuerza una recarga del caché ignorando el existente
   * @default false
   */
  forceRefresh?: boolean;
}

interface UseProductCacheReturn {
  products: Product[];
  categories: Category[];
  loading: boolean;
  error: Error | null;
  /**
   * Fuerza una recarga del caché
   */
  refresh: () => Promise<void>;
  /**
   * Limpia el caché (útil al agregar/modificar productos)
   */
  invalidate: () => void;
}

/**
 * Hook optimizado para cargar y cachear productos y categorías
 *
 * Características:
 * - Caché en memoria global (compartida entre componentes)
 * - Persistencia en sessionStorage
 * - TTL configurable (default 5 minutos)
 * - Deduplicación de requests concurrentes
 * - Refresh manual disponible
 *
 * @example
 * ```tsx
 * const { products, categories, loading, refresh, invalidate } = useProductCache();
 *
 * // Refrescar manualmente
 * await refresh();
 *
 * // Invalidar después de crear un producto
 * invalidate();
 * ```
 */
export function useProductCache(
  options: UseProductCacheOptions = {}
): UseProductCacheReturn {
  const { ttl = DEFAULT_TTL_MS, forceRefresh = false } = options;

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);

  const loadData = useCallback(
    async (force = false) => {
      setLoading(true);
      setError(null);

      try {
        // 1. Verificar caché en memoria
        if (!force && globalCache) {
          const age = Date.now() - globalCache.timestamp;
          if (age < ttl) {
            if (mountedRef.current) {
              setProducts(globalCache.products);
              setCategories(globalCache.categories);
              setLoading(false);
            }
            return;
          }
        }

        // 2. Verificar caché en sessionStorage
        if (!force) {
          const storedCache = loadFromStorage();
          if (storedCache) {
            globalCache = storedCache;
            if (mountedRef.current) {
              setProducts(storedCache.products);
              setCategories(storedCache.categories);
              setLoading(false);
            }
            return;
          }
        }

        // 3. Si ya hay una petición en curso, esperar a que termine
        if (isFetching && fetchPromise) {
          const data = await fetchPromise;
          if (mountedRef.current) {
            setProducts(data.products);
            setCategories(data.categories);
            setLoading(false);
          }
          return;
        }

        // 4. Hacer la petición a la API
        isFetching = true;
        fetchPromise = fetchData();

        const data = await fetchPromise;

        if (mountedRef.current) {
          setProducts(data.products);
          setCategories(data.categories);
        }
      } catch (err) {
        console.error("Error loading product cache:", err);
        if (mountedRef.current) {
          setError(
            err instanceof Error ? err : new Error("Error loading products")
          );
        }
      } finally {
        isFetching = false;
        fetchPromise = null;
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    },
    [ttl]
  );

  // Cargar datos al montar
  useEffect(() => {
    mountedRef.current = true;
    loadData(forceRefresh);

    return () => {
      mountedRef.current = false;
    };
  }, [loadData, forceRefresh]);

  // Función para refrescar manualmente
  const refresh = useCallback(async () => {
    await loadData(true);
  }, [loadData]);

  // Función para invalidar el caché
  const invalidate = useCallback(() => {
    globalCache = null;
    sessionStorage.removeItem(CACHE_KEY);
  }, []);

  return {
    products,
    categories,
    loading,
    error,
    refresh,
    invalidate,
  };
}

/**
 * Función utilitaria para invalidar el caché de productos desde fuera del hook
 * Útil en servicios o componentes que crean/modifican productos
 */
export function invalidateProductCache() {
  globalCache = null;
  sessionStorage.removeItem(CACHE_KEY);
}

export default useProductCache;
