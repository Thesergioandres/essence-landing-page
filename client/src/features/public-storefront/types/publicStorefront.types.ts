export type LandingTemplate = "modern" | "minimal" | "bold";

export interface PublicStorefrontContact {
  email?: string;
  phone?: string;
  whatsapp?: string;
  location?: string;
}

export interface PublicStorefrontBusiness {
  name: string;
  slug: string;
  landingTemplate: LandingTemplate;
  logoUrl?: string | null;
  description?: string;
  contact: PublicStorefrontContact;
  socialNetworks: Record<string, string>;
}

export interface PublicStorefrontProduct {
  id: string;
  name: string;
  imageUrl?: string | null;
  description?: string;
  price: number;
}

export interface PublicStorefrontData {
  business: PublicStorefrontBusiness;
  products: PublicStorefrontProduct[];
}

export interface StorefrontTemplateProps {
  storefront: PublicStorefrontData;
}
