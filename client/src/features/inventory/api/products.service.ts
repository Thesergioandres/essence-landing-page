import { httpClient } from "../../../shared/api/httpClient";
import type {
  Product,
  ProductFormData,
  StockUpdatePayload,
} from "../types/product.types";

export const productsService = {
  getProducts: async () => {
    const response = await httpClient.get<{
      success: boolean;
      data: Product[];
    }>("/products");
    // El backend V2 retorna {success: true, data: [...], pagination: {...}}
    const data = response.data.data || [];
    return Array.isArray(data) ? data : [];
  },

  getProductById: async (id: string): Promise<Product> => {
    const response = await httpClient.get<{ success: boolean; data: Product }>(
      `/products/${id}`
    );
    // El backend V2 retorna {success: true, data: product}
    return response.data.data;
  },

  createProduct: async (data: ProductFormData): Promise<Product> => {
    const formData = new FormData();
    formData.append("name", data.name);
    if (data.description) formData.append("description", data.description);
    formData.append("purchasePrice", data.purchasePrice.toString());
    formData.append("clientPrice", data.clientPrice.toString());
    formData.append("employeePrice", data.employeePrice.toString());
    if (data.suggestedPrice)
      formData.append("suggestedPrice", data.suggestedPrice.toString());
    formData.append("category", data.categoryId);
    if (data.image) formData.append("image", data.image);

    const response = await httpClient.post<{ success: boolean; data: Product }>(
      "/products",
      formData,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
    // El backend V2 retorna {success: true, data: product}
    return response.data.data;
  },

  updateStock: async (
    id: string,
    payload: StockUpdatePayload
  ): Promise<Product> => {
    const response = await httpClient.patch<{
      success: boolean;
      data: Product;
    }>(`/products/${id}/stock`, payload);
    // Normalizar respuesta
    return response.data.data || (response.data as unknown as Product);
  },
};
