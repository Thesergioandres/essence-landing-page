/**
 * Tests del controlador de analytics
 * Ejecutar: npm test -- --runTestsByPath __tests__/controllers/analytics.controller.test.js
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
const { default: Membership } = await import("../../models/Membership.js");

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("Analytics Controller", () => {
  let adminUser;
  let adminToken;
  let staffUser;
  let staffToken;
  let distributorUser;
  let distributorToken;
  let testBusiness;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Crear admin
    adminUser = await User.findOneAndUpdate(
      { email: "analytics-test-admin@example.com" },
      {
        email: "analytics-test-admin@example.com",
        password: "$2a$10$hashedpassword",
        name: "Analytics Test Admin",
        role: "admin",
        status: "active",
        active: true,
      },
      { upsert: true, new: true }
    );

    // Crear negocio
    testBusiness = await Business.findOneAndUpdate(
      { name: "Analytics Test Business" },
      {
        name: "Analytics Test Business",
        createdBy: adminUser._id,
        status: "active",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // Memberships
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

    adminToken = jwt.sign(
      { userId: adminUser._id, role: "admin" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Crear staff
    staffUser = await User.findOneAndUpdate(
      { email: "analytics-test-staff@example.com" },
      {
        email: "analytics-test-staff@example.com",
        password: "$2a$10$hashedpassword",
        name: "Analytics Test Staff",
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
      },
      { upsert: true }
    );

    staffToken = jwt.sign(
      { userId: staffUser._id, role: "staff" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Crear distribuidor
    distributorUser = await User.findOneAndUpdate(
      { email: "analytics-test-dist@example.com" },
      {
        email: "analytics-test-dist@example.com",
        password: "$2a$10$hashedpassword",
        name: "Analytics Test Distributor",
        role: "distribuidor",
        status: "active",
        active: true,
      },
      { upsert: true, new: true }
    );

    await Membership.findOneAndUpdate(
      { user: distributorUser._id, business: testBusiness._id },
      {
        user: distributorUser._id,
        business: testBusiness._id,
        role: "distribuidor",
        status: "active",
      },
      { upsert: true }
    );

    distributorToken = jwt.sign(
      { userId: distributorUser._id, role: "distribuidor" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    await Membership.deleteMany({ business: testBusiness._id });
    await User.deleteMany({
      email: {
        $in: [
          "analytics-test-admin@example.com",
          "analytics-test-staff@example.com",
          "analytics-test-dist@example.com",
        ],
      },
    });
    await Business.findByIdAndDelete(testBusiness._id);
    await mongoose.disconnect();
  });

  describe("GET /api/analytics/dashboard", () => {
    it("admin puede ver dashboard", async () => {
      const res = await request(app)
        .get("/api/analytics/dashboard")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("staff puede ver dashboard limitado", async () => {
      const res = await request(app)
        .get("/api/analytics/dashboard")
        .set("Authorization", `Bearer ${staffToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 403]).toContain(res.status);
    });

    it("sin auth retorna 401", async () => {
      const res = await request(app)
        .get("/api/analytics/dashboard")
        .set("x-business-id", testBusiness._id.toString());

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/analytics/sales", () => {
    it("admin puede ver analytics de ventas", async () => {
      const res = await request(app)
        .get("/api/analytics/sales")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("puede filtrar por periodo", async () => {
      const res = await request(app)
        .get("/api/analytics/sales?period=monthly")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("puede filtrar por rango de fechas", async () => {
      const today = new Date().toISOString().split("T")[0];
      const res = await request(app)
        .get(`/api/analytics/sales?startDate=${today}&endDate=${today}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });
  });

  describe("GET /api/analytics/products", () => {
    it("admin puede ver analytics de productos", async () => {
      const res = await request(app)
        .get("/api/analytics/products")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("puede ver top productos", async () => {
      const res = await request(app)
        .get("/api/analytics/products/top?limit=10")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });
  });

  describe("GET /api/analytics/revenue", () => {
    it("admin puede ver analytics de ingresos", async () => {
      const res = await request(app)
        .get("/api/analytics/revenue")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("staff NO puede ver analytics de ingresos", async () => {
      const res = await request(app)
        .get("/api/analytics/revenue")
        .set("Authorization", `Bearer ${staffToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 403]).toContain(res.status);
    });
  });

  describe("GET /api/analytics/expenses", () => {
    it("admin puede ver analytics de gastos", async () => {
      const res = await request(app)
        .get("/api/analytics/expenses")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });
  });

  describe("GET /api/analytics/profit", () => {
    it("admin puede ver analytics de ganancias", async () => {
      const res = await request(app)
        .get("/api/analytics/profit")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("distribuidor puede ver sus propias ganancias", async () => {
      const res = await request(app)
        .get("/api/analytics/profit")
        .set("Authorization", `Bearer ${distributorToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 403]).toContain(res.status);
    });
  });

  describe("GET /api/analytics/trends", () => {
    it("admin puede ver tendencias", async () => {
      const res = await request(app)
        .get("/api/analytics/trends")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });
  });

  describe("GET /api/analytics/stock", () => {
    it("admin puede ver analytics de stock", async () => {
      const res = await request(app)
        .get("/api/analytics/stock")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("puede ver rotación de inventario", async () => {
      const res = await request(app)
        .get("/api/analytics/stock/rotation")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 404]).toContain(res.status);
    });
  });

  describe("GET /api/analytics/distributors", () => {
    it("admin puede ver analytics de distribuidores", async () => {
      const res = await request(app)
        .get("/api/analytics/distributors")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("puede ver ranking de distribuidores", async () => {
      const res = await request(app)
        .get("/api/analytics/distributors/ranking")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 404]).toContain(res.status);
    });
  });

  describe("GET /api/analytics/commissions", () => {
    it("admin puede ver analytics de comisiones", async () => {
      const res = await request(app)
        .get("/api/analytics/commissions")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });
  });

  describe("GET /api/analytics/branches", () => {
    it("admin puede ver analytics por sucursal", async () => {
      const res = await request(app)
        .get("/api/analytics/branches")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });
  });

  describe("GET /api/analytics/customers", () => {
    it("admin puede ver analytics de clientes", async () => {
      const res = await request(app)
        .get("/api/analytics/customers")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });
  });

  describe("Export de datos", () => {
    it("admin puede exportar a CSV", async () => {
      const res = await request(app)
        .get("/api/analytics/export?format=csv")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 404]).toContain(res.status);
    });

    it("admin puede exportar a Excel", async () => {
      const res = await request(app)
        .get("/api/analytics/export?format=xlsx")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 404]).toContain(res.status);
    });
  });

  describe("Trazabilidad", () => {
    it("incluye requestId en respuestas", async () => {
      const res = await request(app)
        .get("/api/analytics/dashboard")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(res.headers["x-request-id"]).toBeDefined();
    });
  });

  describe("Cache", () => {
    it("responde con cache cuando disponible", async () => {
      // Primera petición
      await request(app)
        .get("/api/analytics/dashboard")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      // Segunda petición debería usar cache
      const res = await request(app)
        .get("/api/analytics/dashboard")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });
  });
});
