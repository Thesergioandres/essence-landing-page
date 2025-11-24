export interface Category {
  _id: string;
  name: string;
  description?: string;
  slug: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProductImage {
  url: string;
  publicId: string;
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  category: Category;
  image?: ProductImage | null;
  stock: number;
  featured: boolean;
  ingredients?: string[];
  benefits?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: "user" | "admin";
  token?: string;
}
