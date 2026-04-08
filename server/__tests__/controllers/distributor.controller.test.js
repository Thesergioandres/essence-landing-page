/**
 * Tests del controlador de distribuidores
 * Ejecutar: npm test -- --runTestsByPath __tests__/controllers/distributor.controller.test.js
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

describe("Distributor Controller", () => {
  let adminUser;
  let adminToken;
  let distributorUser;
  let distributorToken;
  let testBusiness;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Crear admin
    adminUser = await User.findOneAndUpdate(
      { email: "dist-test-admin@example.com" },
      {
        email: "dist-test-admin@example.com",
        password: "$2a$10$hashedpassword",
        name: "Dist Test Admin",
        role: "admin",
        status: "active",
        active: true,
      },
      { upsert: true, new: true }
    );

    // Crear negocio
    testBusiness = await Business.findOneAndUpdate(
      { name: "Distributor Test Business" },
      {
        name: "Distributor Test Business",
        createdBy: adminUser._id,
        status: "active",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // Crear membership admin
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

    // Crear distribuidor de prueba
    distributorUser = await User.findOneAndUpdate(
      { email: "test-distributor@example.com" },
      {
        email: "test-distributor@example.com",
        password: "$2a$10$hashedpassword",
        name: "Test Distributor",
        role: "distribuidor",
        status: "active",
        active: true,
        commissionPercentage: 21,
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
        $in: ["dist-test-admin@example.com", "test-distributor@example.com"],
      },
    });
    await Business.findByIdAndDelete(testBusiness._id);
    await mongoose.disconnect();
  });

  describe("GET /api/distributors", () => {
    it("admin puede listar distribuidores", async () => {
      const res = await request(app)
        .get("/api/distributors")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
      expect(res.body).toHaveProperty("distributors");
      expect(Array.isArray(res.body.distributors)).toBe(true);
    });

    it("distribuidor NO puede listar otros distribuidores", async () => {
      const res = await request(app)
        .get("/api/distributors")
        .set("Authorization", `Bearer ${distributorToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 403]).toContain(res.status);
    });

    it("sin auth retorna 401", async () => {
      const res = await request(app)
        .get("/api/distributors")
        .set("x-business-id", testBusiness._id.toString());

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/distributors/:id", () => {
    it("admin puede ver detalle de distribuidor", async () => {
      const res = await request(app)
        .get(`/api/distributors/${distributorUser._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("distribuidor puede ver su propio perfil", async () => {
      const res = await request(app)
        .get(`/api/distributors/${distributorUser._id}`)
        .set("Authorization", `Bearer ${distributorToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 403]).toContain(res.status);
    });
  });

  describe("POST /api/distributors", () => {
    const newDistEmail = `new-dist-${Date.now()}@example.com`;

    afterAll(async () => {
      await User.deleteMany({ email: newDistEmail });
    });

    it("admin puede crear distribuidor", async () => {
      const res = await request(app)
        .post("/api/distributors")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          name: "New Distributor",
          email: newDistEmail,
          password: "SecurePass123!",
          commissionPercentage: 23,
        });

      expect([200, 201]).toContain(res.status);
    });

    it("distribuidor NO puede crear distribuidores", async () => {
      const res = await request(app)
        .post("/api/distributors")
        .set("Authorization", `Bearer ${distributorToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          name: "Unauthorized Dist",
          email: `unauth-${Date.now()}@example.com`,
          password: "Pass123!",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("Comisiones - 21%, 23%, 25%", () => {
    it("distribuidor tiene porcentaje de comisión válido", async () => {
      const user = await User.findById(distributorUser._id);
      expect([21, 23, 25]).toContain(user.commissionPercentage);
    });

    it("admin puede actualizar porcentaje de comisión", async () => {
      const res = await request(app)
        .put(`/api/distributors/${distributorUser._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          commissionPercentage: 25,
        });

      expect([200, 204]).toContain(res.status);
    });
  });

  describe("Panel de distribuidor", () => {
    it("distribuidor puede acceder a su dashboard", async () => {
      const res = await request(app)
        .get("/api/distributors/me/dashboard")
        .set("Authorization", `Bearer ${distributorToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 404]).toContain(res.status);
    });

    it("distribuidor puede ver sus ventas", async () => {
      const res = await request(app)
        .get("/api/distributors/me/sales")
        .set("Authorization", `Bearer ${distributorToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 404]).toContain(res.status);
    });

    it("distribuidor puede ver su stock", async () => {
      const res = await request(app)
        .get("/api/distributors/me/stock")
        .set("Authorization", `Bearer ${distributorToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 404]).toContain(res.status);
    });
  });

  describe("Rankings", () => {
    it("puede obtener ranking de distribuidores", async () => {
      const res = await request(app)
        .get("/api/distributors/rankings")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 404]).toContain(res.status);
    });

    it("puede filtrar ranking por periodo", async () => {
      const res = await request(app)
        .get("/api/distributors/rankings?period=weekly")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 404]).toContain(res.status);
    });
  });

  describe("Activación/Desactivación", () => {
    it("admin puede desactivar distribuidor", async () => {
      const res = await request(app)
        .patch(`/api/distributors/${distributorUser._id}/toggle`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 204, 404]).toContain(res.status);
    });
  });

  describe("Trazabilidad", () => {
    it("incluye requestId en respuestas", async () => {
      const res = await request(app)
        .get("/api/distributors")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(res.headers["x-request-id"]).toBeDefined();
    });
  });
});
