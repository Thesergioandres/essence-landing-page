import { useState } from "react";
import { salesService } from "../api/sales.service";
import type { BulkSalePayload, SaleResponse } from "../types/sales.types";

export const useSaleSubmit = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<SaleResponse | null>(null);

  const submitSale = async (payload: BulkSalePayload) => {
    setIsLoading(true);
    setError(null);
    setLastSale(null); // Reset previous success

    try {
      const response = await salesService.registerBulkSale(payload);
      setLastSale(response);
      return response;
    } catch (err: any) {
      const msg = err.response?.data?.message || "Error al registrar la venta";
      setError(msg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    submitSale,
    isLoading,
    error,
    lastSale,
    resetSaleState: () => {
      setLastSale(null);
      setError(null);
    },
  };
};
