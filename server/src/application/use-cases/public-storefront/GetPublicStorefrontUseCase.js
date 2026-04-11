import { BusinessPersistenceUseCase } from "../repository-gateways/BusinessPersistenceUseCase.js";
import { ProductPersistenceUseCase } from "../repository-gateways/ProductPersistenceUseCase.js";

const normalizeSlug = (rawSlug = "") =>
  String(rawSlug || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

const toPositiveNumber = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  return numericValue;
};

const resolvePublicPrice = (product) => {
  const clientPrice = toPositiveNumber(product?.clientPrice);
  if (clientPrice > 0) {
    return clientPrice;
  }

  const suggestedPrice = toPositiveNumber(product?.suggestedPrice);
  if (suggestedPrice > 0) {
    return suggestedPrice;
  }

  return 0;
};

const resolveSocialNetworks = (business) => {
  const socialSource =
    business?.socialNetworks ||
    business?.socials ||
    business?.metadata?.socialNetworks ||
    business?.metadata?.socials ||
    business?.metadata?.socialLinks ||
    {};

  if (!socialSource || typeof socialSource !== "object") {
    return {};
  }

  return Object.entries(socialSource).reduce((accumulator, [key, value]) => {
    if (typeof value !== "string") {
      return accumulator;
    }

    const normalizedKey = String(key || "").trim();
    const normalizedValue = value.trim();

    if (!normalizedKey || !normalizedValue) {
      return accumulator;
    }

    accumulator[normalizedKey] = normalizedValue;
    return accumulator;
  }, {});
};

export class GetPublicStorefrontUseCase {
  constructor({ businessGateway, productGateway } = {}) {
    this.businessGateway = businessGateway || new BusinessPersistenceUseCase();
    this.productGateway = productGateway || new ProductPersistenceUseCase();
  }

  async execute(slugInput) {
    const normalizedSlug = normalizeSlug(slugInput);

    if (!normalizedSlug || normalizedSlug.length < 3) {
      const error = new Error("Slug invalido");
      error.statusCode = 400;
      throw error;
    }

    const business = await this.businessGateway.findBySlug(normalizedSlug);

    if (!business) {
      const error = new Error("Tienda no encontrada");
      error.statusCode = 404;
      throw error;
    }

    const products = await this.productGateway.findAll(String(business._id), {
      isDeleted: { $ne: true },
    });

    const activeProducts = (products || [])
      .filter((product) => product && product.isDeleted !== true)
      .map((product) => ({
        id: String(product._id),
        name: product.name,
        imageUrl: product?.image?.url || null,
        description: product.description || "",
        price: resolvePublicPrice(product),
      }));

    return {
      business: {
        name: business.name,
        slug: business.slug,
        landingTemplate: business.landingTemplate || "modern",
        logoUrl: business.logoUrl || null,
        description: business.description || "",
        contact: {
          email: business.contactEmail || "",
          phone: business.contactPhone || "",
          whatsapp: business.contactWhatsapp || "",
          location: business.contactLocation || "",
        },
        socialNetworks: resolveSocialNetworks(business),
      },
      products: activeProducts,
    };
  }
}
