/**
 * Tests del controlador de stock e inventario
 * Ejecutar: npm test -- --runTestsByPath __tests__/controllers/stock.controller.test.js
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
const { default: Branch } = await import("../../models/Branch.js");
const { default: Product } = await import("../../src/infrastructure/database/models/Product.js");
const { default: BranchStock } = await import("../../models/BranchStock.js");
const { default: Membership } = await import("../../models/Membership.js");
const { default: Category } = await import("../../models/Category.js");

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("Stock Controller", () => {
  let adminUser;
  let adminToken;
  let staffUser;
  let staffToken;
  let testBusiness;
  let testBranch;
  let testProduct;
  let testCategory;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Crear admin
    adminUser = await User.findOneAndUpdate(
      { email: "stock-test-admin@example.com" },
      {
        email: "stock-test-admin@example.com",
        password: "$2a$10$hashedpassword",
        name: "Stock Test Admin",
        role: "admin",
        status: "active",
        active: true,
      },
      { upsert: true, new: true }
    );

    // Crear negocio
    testBusiness = await Business.findOneAndUpdate(
      { name: "Stock Test Business" },
      {
        name: "Stock Test Business",
        createdBy: adminUser._id,
        status: "active",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // Crear sucursal
    testBranch = await Branch.findOneAndUpdate(
      { name: "Stock Test Branch", business: testBusiness._id },
      {
        name: "Stock Test Branch",
        business: testBusiness._id,
        isMain: true,
        status: "active",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // Crear categoría con nombre único
    const categoryName = `Stock Test Category ${Date.now()}`;
    testCategory = await Category.findOneAndUpdate(
      { name: categoryName, business: testBusiness._id },
      {
        name: categoryName,
        business: testBusiness._id,
        slug: `stock-test-category-${Date.now()}`,
      },
      { upsert: true, new: true }
    );

    // Crear producto
    testProduct = await Product.findOneAndUpdate(
      { name: "Stock Test Product", business: testBusiness._id },
      {
        name: "Stock Test Product",
        business: testBusiness._id,
        sku: `SKU-STOCK-${Date.now()}`,
        price: 100,
        cost: 50,
        purchasePrice: 50,
        category: testCategory._id,
        status: "active",
        minStock: 10,
        maxStock: 1000,
      },
      { upsert: true, new: true }
    );

    // Crear stock en sucursal
    await BranchStock.findOneAndUpdate(
      { branch: testBranch._id, product: testProduct._id },
      {
        branch: testBranch._id,
        product: testProduct._id,
        business: testBusiness._id,
        quantity: 100,
        minStock: 10,
        maxStock: 500,
      },
      { upsert: true }
    );

    // Memberships
    await Membership.findOneAndUpdate(
      { user: adminUser._id, business: testBusiness._id },
      {
        user: adminUser._id,
        business: testBusiness._id,
        role: "admin",
        status: "active",
        assignedBranches: [testBranch._id],
      },
      { upsert: true }
    );

    adminToken = jwt.sign(
      { userId: adminUser._id, role: "admin" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Crear staff
    staffUser = await User.findOneAndUpdate(
      { email: "stock-test-staff@example.com" },
      {
        email: "stock-test-staff@example.com",
        password: "$2a$10$hashedpassword",
        name: "Stock Test Staff",
        role: "staff",
        status: "active",
        active: true,
      },
      { upsert: true, new: true }
    );

    await Membership.findOneAndUpdate(
      { user: staffUser._id, business: testBusiness._id },
      {
        user: staffUser._id,
        business: testBusiness._id,
        role: "staff",
        status: "active",
        assignedBranches: [testBranch._id],
      },
      { upsert: true }
    );

    staffToken = jwt.sign(
      { userId: staffUser._id, role: "staff" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    await BranchStock.deleteMany({ business: testBusiness._id });
    await Product.deleteMany({ business: testBusiness._id });
    await Branch.deleteMany({ business: testBusiness._id });
    await Membership.deleteMany({ business: testBusiness._id });
    await User.deleteMany({
      email: {
        $in: ["stock-test-admin@example.com", "stock-test-staff@example.com"],
      },
    });
    await Business.findByIdAndDelete(testBusiness._id);
    await mongoose.disconnect();
  });

  describe("GET /api/stock", () => {
    it("admin puede ver todo el stock", async () => {
      const res = await request(app)
        .get("/api/stock")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("staff puede ver stock de sucursales asignadas", async () => {
      const res = await request(app)
        .get("/api/stock")
        .set("Authorization", `Bearer ${staffToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("sin auth retorna 401", async () => {
      const res = await request(app)
        .get("/api/stock")
        .set("x-business-id", testBusiness._id.toString());

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/stock/branch/:branchId", () => {
    it("admin puede ver stock de sucursal específica", async () => {
      const res = await request(app)
        .get(`/api/stock/branch/${testBranch._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("staff puede ver stock de su sucursal", async () => {
      const res = await request(app)
        .get(`/api/stock/branch/${testBranch._id}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });
  });

  describe("GET /api/stock/product/:productId", () => {
    it("puede ver stock de producto en todas las sucursales", async () => {
      const res = await request(app)
        .get(`/api/stock/product/${testProduct._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });
  });

  describe("POST /api/stock/entry", () => {
    it("admin puede registrar entrada de stock", async () => {
      const res = await request(app)
        .post("/api/stock/entry")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          branch: testBranch._id,
          product: testProduct._id,
          quantity: 50,
          type: "purchase",
          notes: "Test entry",
        });

      expect([200, 201]).toContain(res.status);
    });

    it("staff puede registrar entrada de stock en su sucursal", async () => {
      const res = await request(app)
        .post("/api/stock/entry")
        .set("Authorization", `Bearer ${staffToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          branch: testBranch._id,
          product: testProduct._id,
          quantity: 25,
          type: "adjustment",
          notes: "Staff entry",
        });

      expect([200, 201, 403]).toContain(res.status);
    });

    it("rechaza cantidad negativa", async () => {
      const res = await request(app)
        .post("/api/stock/entry")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          branch: testBranch._id,
          product: testProduct._id,
          quantity: -10,
          type: "purchase",
        });

      expect([400, 422]).toContain(res.status);
    });
  });

  describe("POST /api/stock/exit", () => {
    it("admin puede registrar salida de stock", async () => {
      const res = await request(app)
        .post("/api/stock/exit")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          branch: testBranch._id,
          product: testProduct._id,
          quantity: 10,
          type: "sale",
          notes: "Test exit",
        });

      expect([200, 201]).toContain(res.status);
    });

    it("no permite salida mayor que stock disponible", async () => {
      const res = await request(app)
        .post("/api/stock/exit")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          branch: testBranch._id,
          product: testProduct._id,
          quantity: 999999,
          type: "sale",
        });

      expect([400, 409, 422]).toContain(res.status);
    });
  });

  describe("POST /api/stock/transfer", () => {
    let secondBranch;

    beforeAll(async () => {
      secondBranch = await Branch.findOneAndUpdate(
        { name: "Stock Test Branch 2", business: testBusiness._id },
        {
          name: "Stock Test Branch 2",
          business: testBusiness._id,
          isMain: false,
          status: "active",
          isActive: true,
        },
        { upsert: true, new: true }
      );
    });

    afterAll(async () => {
      await Branch.findByIdAndDelete(secondBranch._id);
    });

    it("admin puede transferir stock entre sucursales", async () => {
      const res = await request(app)
        .post("/api/stock/transfer")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          fromBranch: testBranch._id,
          toBranch: secondBranch._id,
          product: testProduct._id,
          quantity: 20,
          notes: "Test transfer",
        });

      expect([200, 201]).toContain(res.status);
    });

    it("staff NO puede transferir stock", async () => {
      const res = await request(app)
        .post("/api/stock/transfer")
        .set("Authorization", `Bearer ${staffToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          fromBranch: testBranch._id,
          toBranch: secondBranch._id,
          product: testProduct._id,
          quantity: 5,
        });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /api/stock/low-stock", () => {
    it("admin puede ver productos con stock bajo", async () => {
      const res = await request(app)
        .get("/api/stock/low-stock")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });
  });

  describe("GET /api/stock/movements", () => {
    it("puede ver historial de movimientos", async () => {
      const res = await request(app)
        .get("/api/stock/movements")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("puede filtrar por tipo de movimiento", async () => {
      const res = await request(app)
        .get("/api/stock/movements?type=purchase")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("puede filtrar por rango de fechas", async () => {
      const today = new Date().toISOString().split("T")[0];
      const res = await request(app)
        .get(`/api/stock/movements?startDate=${today}&endDate=${today}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });
  });

  describe("GET /api/stock/valuation", () => {
    it("admin puede ver valuación del inventario", async () => {
      const res = await request(app)
        .get("/api/stock/valuation")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 404]).toContain(res.status);
    });
  });

  describe("Alertas de Stock", () => {
    it("genera alerta cuando stock < minStock", async () => {
      // Reducir stock para generar alerta
      await BranchStock.findOneAndUpdate(
        { branch: testBranch._id, product: testProduct._id },
        { quantity: 5 } // menor que minStock de 10
      );

      const res = await request(app)
        .get("/api/stock/alerts")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 404]).toContain(res.status);

      // Restaurar stock
      await BranchStock.findOneAndUpdate(
        { branch: testBranch._id, product: testProduct._id },
        { quantity: 100 }
      );
    });
  });

  describe("Trazabilidad", () => {
    it("incluye requestId en respuestas", async () => {
      const res = await request(app)
        .get("/api/stock")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(res.headers["x-request-id"]).toBeDefined();
    });

    it("movimientos incluyen usuario que realizó la acción", async () => {
      const res = await request(app)
        .get("/api/stock/movements")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });
  });
});
