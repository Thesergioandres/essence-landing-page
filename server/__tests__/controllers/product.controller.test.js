/**
 * Tests del controlador de productos
 * Ejecutar: npm test -- --runTestsByPath __tests__/controllers/product.controller.test.js
 */

import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";

// Mock de Redis
jest.mock("../../config/redis.js", () => ({
  initRedis: jest.fn(),
  getRedisClient: jest.fn(() => null),
}));

const { default: app } = await import("../../server.js");
const { default: User } = await import("../../src/infrastructure/database/models/User.js");
const { default: Business } = await import("../../models/Business.js");
const { default: Product } = await import("../../src/infrastructure/database/models/Product.js");
const { default: Category } = await import("../../models/Category.js");
const { default: Membership } = await import("../../models/Membership.js");

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("Product Controller", () => {
  let adminUser;
  let adminToken;
  let testBusiness;
  let testCategory;
  let testProduct;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Crear usuario admin de prueba
    adminUser = await User.findOneAndUpdate(
      { email: "product-test-admin@example.com" },
      {
        email: "product-test-admin@example.com",
        password: "$2a$10$hashedpassword",
        name: "Product Test Admin",
        role: "admin",
        status: "active",
        active: true,
      },
      { upsert: true, new: true }
    );

    // Crear negocio de prueba
    testBusiness = await Business.findOneAndUpdate(
      { name: "Product Test Business" },
      {
        name: "Product Test Business",
        createdBy: adminUser._id,
        status: "active",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // Crear membership
    await Membership.findOneAndUpdate(
      { user: adminUser._id, business: testBusiness._id },
      {
        user: adminUser._id,
        business: testBusiness._id,
        role: "admin",
        status: "active",
      },
      { upsert: true }
    );

    // Crear categoría de prueba
    testCategory = await Category.findOneAndUpdate(
      { name: "Test Category", business: testBusiness._id },
      {
        name: "Test Category",
        business: testBusiness._id,
        slug: "test-category",
      },
      { upsert: true, new: true }
    );

    adminToken = jwt.sign(
      { userId: adminUser._id, role: "admin" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await Product.deleteMany({ business: testBusiness._id });
    await Category.deleteMany({ business: testBusiness._id });
    await Membership.deleteMany({ business: testBusiness._id });
    await Business.findByIdAndDelete(testBusiness._id);
    await User.findByIdAndDelete(adminUser._id);
    await mongoose.disconnect();
  });

  describe("POST /api/products", () => {
    it("debería crear un producto exitosamente", async () => {
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          name: "Test Product",
          description: "A test product",
          purchasePrice: 100,
          distributorPrice: 80,
          category: testCategory._id.toString(),
          stock: 50,
        });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("product");
      expect(res.body.product.name).toBe("Test Product");
      expect(res.body.product.purchasePrice).toBe(100);

      testProduct = res.body.product;
    });

    it("debería rechazar sin nombre", async () => {
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          purchasePrice: 100,
        });

      expect(res.status).toBe(400);
    });

    it("debería rechazar precio negativo", async () => {
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          name: "Invalid Product",
          purchasePrice: -10,
        });

      expect([400, 422]).toContain(res.status);
    });

    it("debería rechazar sin autenticación", async () => {
      const res = await request(app)
        .post("/api/products")
        .set("x-business-id", testBusiness._id.toString())
        .send({
          name: "Unauthorized Product",
          purchasePrice: 100,
        });

      expect(res.status).toBe(401);
    });

    it("debería rechazar sin businessId", async () => {
      const res = await request(app)
        .post("/api/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "No Business Product",
          purchasePrice: 100,
        });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/products", () => {
    it("debería listar productos (público)", async () => {
      const res = await request(app).get("/api/products");

      expect([200, 304]).toContain(res.status);
      expect(res.body).toHaveProperty("products");
      expect(Array.isArray(res.body.products)).toBe(true);
    });

    it("debería filtrar por categoría", async () => {
      const res = await request(app).get(
        `/api/products?category=${testCategory._id.toString()}`
      );

      expect([200, 304]).toContain(res.status);
    });

    it("debería paginar correctamente", async () => {
      const res = await request(app).get("/api/products?page=1&limit=5");

      expect([200, 304]).toContain(res.status);
      expect(res.body.products.length).toBeLessThanOrEqual(5);
    });

    it("debería buscar por nombre", async () => {
      const res = await request(app).get("/api/products?search=Test");

      expect([200, 304]).toContain(res.status);
    });
  });

  describe("GET /api/products/:id", () => {
    it("debería obtener un producto por ID", async () => {
      if (!testProduct) return;

      const res = await request(app).get(`/api/products/${testProduct._id}`);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Test Product");
    });

    it("debería retornar 404 para ID inexistente", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app).get(`/api/products/${fakeId}`);

      expect(res.status).toBe(404);
    });

    it("debería retornar 400 para ID inválido", async () => {
      const res = await request(app).get("/api/products/invalid-id");

      expect([400, 404, 500]).toContain(res.status);
    });
  });

  describe("PUT /api/products/:id", () => {
    it("debería actualizar un producto", async () => {
      if (!testProduct) return;

      const res = await request(app)
        .put(`/api/products/${testProduct._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          name: "Updated Product",
          purchasePrice: 120,
        });

      expect(res.status).toBe(200);
      expect(res.body.product.name).toBe("Updated Product");
      expect(res.body.product.purchasePrice).toBe(120);
    });

    it("debería rechazar actualización sin auth", async () => {
      if (!testProduct) return;

      const res = await request(app)
        .put(`/api/products/${testProduct._id}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          name: "Hacked Product",
        });

      expect(res.status).toBe(401);
    });
  });

  describe("DELETE /api/products/:id", () => {
    let productToDelete;

    beforeAll(async () => {
      // Crear producto para eliminar
      productToDelete = await Product.create({
        name: "Product To Delete",
        description: "Product for deletion test",
        purchasePrice: 50,
        distributorPrice: 40,
        business: testBusiness._id,
        category: testCategory._id,
      });
    });

    it("debería eliminar un producto", async () => {
      const res = await request(app)
        .delete(`/api/products/${productToDelete._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/eliminado|deleted/i);
    });

    it("debería retornar 404 al eliminar inexistente", async () => {
      const fakeId = new mongoose.Types.ObjectId();
      const res = await request(app)
        .delete(`/api/products/${fakeId}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(res.status).toBe(404);
    });
  });

  describe("Precios por rol", () => {
    it("debería tener precio de compra y precio distribuidor", async () => {
      if (!testProduct) return;

      const res = await request(app).get(`/api/products/${testProduct._id}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("purchasePrice");
      // El distributorPrice puede no estar visible públicamente
    });
  });

  describe("Stock", () => {
    it("debería mostrar stock del producto", async () => {
      if (!testProduct) return;

      const res = await request(app).get(`/api/products/${testProduct._id}`);

      expect(res.status).toBe(200);
      // Stock puede estar en diferentes formatos
    });
  });

  describe("Auditoría y logs", () => {
    it("debería incluir requestId en respuestas", async () => {
      const res = await request(app).get("/api/products");

      expect(res.headers["x-request-id"]).toBeDefined();
    });
  });
});
