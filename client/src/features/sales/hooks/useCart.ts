import { useCallback, useState } from "react";
import type { Product } from "../../inventory/types/product.types";
import type { SaleItem } from "../types/sales.types";

export const useCart = () => {
  const [items, setItems] = useState<SaleItem[]>([]);

  const addItem = useCallback(
    (product: Product, quantity: number, salePrice: number) => {
      setItems(currentItems => {
        const existing = currentItems.find(i => i.productId === product._id);

        if (existing) {
          // Update quantity
          return currentItems.map(i =>
            i.productId === product._id
              ? {
                  ...i,
                  quantity: i.quantity + quantity,
                  subtotal: (i.quantity + quantity) * i.salePrice,
                }
              : i
          );
        }

        // Add new
        return [
          ...currentItems,
          {
            productId: product._id,
            name: product.name,
            quantity,
            salePrice,
            subtotal: quantity * salePrice,
            availableStock: product.totalStock,
          },
        ];
      });
    },
    []
  );

  const removeItem = useCallback((productId: string) => {
    setItems(current => current.filter(i => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalAmount = items.reduce((sum, item) => sum + item.subtotal, 0);

  return {
    items,
    addItem,
    removeItem,
    clearCart,
    totalAmount,
  };
};
