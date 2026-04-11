import api from "../../../api/axios";
import type { PublicStorefrontData } from "../types/publicStorefront.types";

export const publicStorefrontService = {
  async getBySlug(slug: string): Promise<PublicStorefrontData> {
    const encodedSlug = encodeURIComponent(String(slug || "").trim());
    const response = await api.get(`/public/storefront/${encodedSlug}`);
    return (response.data?.data || response.data) as PublicStorefrontData;
  },
};
