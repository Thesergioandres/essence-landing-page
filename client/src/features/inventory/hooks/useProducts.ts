import { useCallback, useEffect, useState } from "react";
import { productsService } from "../api/products.service";
import { useBusiness } from "../../../context/BusinessContext";
import type { Product } from "../types/product.types";

export const useProducts = () => {
  const { businessId, hydrating } = useBusiness();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProducts = useCallback(async () => {
    // If context is still hydrating, we stay in loading state
    if (hydrating || !businessId) {
      setLoading(true);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await productsService.getProducts();
      setProducts(data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.message || "Error al cargar productos");
    } finally {
      setLoading(false);
    }
  }, [businessId, hydrating]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  return {
    products,
    loading: loading || hydrating,
    error,
    refresh: loadProducts,
  };
};
