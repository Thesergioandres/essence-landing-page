import { httpClient } from "../../../shared/api/httpClient";
import type {
  Product,
  ProductFormData,
  StockUpdatePayload,
} from "../types/product.types";

export const productsService = {
  getProducts: async () => {
    const response = await httpClient.get<Product[]>("/v2/products");
    return response.data;
  },

  getProductById: async (id: string) => {
    const response = await httpClient.get<Product>(`/v2/products/${id}`);
    return response.data;
  },

  createProduct: async (data: ProductFormData) => {
    const formData = new FormData();
    formData.append("name", data.name);
    if (data.description) formData.append("description", data.description);
    formData.append("purchasePrice", data.purchasePrice.toString());
    formData.append("clientPrice", data.clientPrice.toString());
    formData.append("distributorPrice", data.distributorPrice.toString());
    if (data.suggestedPrice)
      formData.append("suggestedPrice", data.suggestedPrice.toString());
    formData.append("category", data.categoryId);
    if (data.image) formData.append("image", data.image);

    const response = await httpClient.post<Product>("/v2/products", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    });
    return response.data;
  },

  updateStock: async (id: string, payload: StockUpdatePayload) => {
    const response = await httpClient.patch<Product>(
      `/v2/products/${id}/stock`,
      payload
    );
    return response.data;
  },
};
