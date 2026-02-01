import { useState } from "react";
import { productsService } from "../api/products.service";
import type { StockUpdatePayload } from "../types/product.types";

export const useStock = () => {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateStock = async (
    productId: string,
    payload: StockUpdatePayload
  ) => {
    setUpdating(true);
    setError(null);
    try {
      const updatedProduct = await productsService.updateStock(
        productId,
        payload
      );
      return updatedProduct;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Error al actualizar stock";
      setError(msg);
      throw err;
    } finally {
      setUpdating(false);
    }
  };

  return {
    updateStock,
    updating,
    error,
  };
};
