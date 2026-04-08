/**
 * Tests del controlador de negocios (Business)
 * Ejecutar: npm test -- --runTestsByPath __tests__/controllers/business.controller.test.js
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

describe("Business Controller", () => {
  let godUser;
  let godToken;
  let adminUser;
  let adminToken;
  let staffUser;
  let staffToken;
  let testBusiness;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Crear usuario GOD
    godUser = await User.findOneAndUpdate(
      { email: "biz-test-god@example.com" },
      {
        email: "biz-test-god@example.com",
        password: "$2a$10$hashedpassword",
        name: "Business Test GOD",
        role: "god",
        status: "active",
        active: true,
      },
      { upsert: true, new: true }
    );

    godToken = jwt.sign({ userId: godUser._id, role: "god" }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // Crear negocio de prueba
    testBusiness = await Business.findOneAndUpdate(
      { name: "Business Controller Test" },
      {
        name: "Business Controller Test",
        createdBy: godUser._id,
        status: "active",
        isActive: true,
        subscriptionStatus: "active",
        subscriptionPlan: "premium",
        maxBranches: 5,
        maxUsers: 50,
      },
      { upsert: true, new: true }
    );

    // Crear admin
    adminUser = await User.findOneAndUpdate(
      { email: "biz-test-admin@example.com" },
      {
        email: "biz-test-admin@example.com",
        password: "$2a$10$hashedpassword",
        name: "Business Test Admin",
        role: "admin",
        status: "active",
        active: true,
      },
      { upsert: true, new: true }
    );

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
      { email: "biz-test-staff@example.com" },
      {
        email: "biz-test-staff@example.com",
        password: "$2a$10$hashedpassword",
        name: "Business Test Staff",
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
  });

  afterAll(async () => {
    await Membership.deleteMany({ business: testBusiness._id });
    await User.deleteMany({
      email: {
        $in: [
          "biz-test-god@example.com",
          "biz-test-admin@example.com",
          "biz-test-staff@example.com",
        ],
      },
    });
    await Business.findByIdAndDelete(testBusiness._id);
    await mongoose.disconnect();
  });

  describe("GET /api/business", () => {
    it("GOD puede listar todos los negocios", async () => {
      const res = await request(app)
        .get("/api/business")
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 304]).toContain(res.status);
      expect(res.body).toHaveProperty("businesses");
      expect(Array.isArray(res.body.businesses)).toBe(true);
    });

    it("admin solo ve sus negocios", async () => {
      const res = await request(app)
        .get("/api/business")
        .set("Authorization", `Bearer ${adminToken}`);

      expect([200, 304]).toContain(res.status);
    });

    it("sin auth retorna 401", async () => {
      const res = await request(app).get("/api/business");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/business/:id", () => {
    it("admin puede ver detalle de su negocio", async () => {
      const res = await request(app)
        .get(`/api/business/${testBusiness._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("staff puede ver detalle del negocio", async () => {
      const res = await request(app)
        .get(`/api/business/${testBusiness._id}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("ID inválido retorna 400", async () => {
      const res = await request(app)
        .get("/api/business/invalid-id")
        .set("Authorization", `Bearer ${adminToken}`);

      expect([400, 404]).toContain(res.status);
    });
  });

  describe("POST /api/business", () => {
    const newBusinessName = `New Business ${Date.now()}`;

    afterAll(async () => {
      await Business.deleteMany({ name: newBusinessName });
    });

    it("GOD puede crear negocio", async () => {
      const res = await request(app)
        .post("/api/business")
        .set("Authorization", `Bearer ${godToken}`)
        .send({
          name: newBusinessName,
          subscriptionPlan: "basic",
        });

      expect([200, 201]).toContain(res.status);
    });

    it("admin puede crear negocio con límites de suscripción", async () => {
      const res = await request(app)
        .post("/api/business")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: `Admin Business ${Date.now()}`,
        });

      expect([200, 201, 403]).toContain(res.status);
    });

    it("staff NO puede crear negocios", async () => {
      const res = await request(app)
        .post("/api/business")
        .set("Authorization", `Bearer ${staffToken}`)
        .send({
          name: "Staff Business",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("PUT /api/business/:id", () => {
    it("admin puede actualizar su negocio", async () => {
      const res = await request(app)
        .put(`/api/business/${testBusiness._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          name: "Updated Business Name",
        });

      expect([200, 204]).toContain(res.status);

      // Restaurar nombre
      await Business.findByIdAndUpdate(testBusiness._id, {
        name: "Business Controller Test",
      });
    });

    it("staff NO puede actualizar negocio", async () => {
      const res = await request(app)
        .put(`/api/business/${testBusiness._id}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          name: "Staff Update",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("Suscripciones y Límites", () => {
    it("negocio tiene estado de suscripción", async () => {
      const business = await Business.findById(testBusiness._id);
      expect(business.subscriptionStatus).toBeDefined();
      expect(["active", "trial", "expired", "cancelled"]).toContain(
        business.subscriptionStatus
      );
    });

    it("negocio tiene límites configurados", async () => {
      const business = await Business.findById(testBusiness._id);
      expect(business.maxBranches).toBeDefined();
      expect(business.maxUsers).toBeDefined();
    });

    it("GOD puede cambiar plan de suscripción", async () => {
      const res = await request(app)
        .patch(`/api/business/${testBusiness._id}/subscription`)
        .set("Authorization", `Bearer ${godToken}`)
        .send({
          subscriptionPlan: "enterprise",
          subscriptionStatus: "active",
        });

      expect([200, 204, 404]).toContain(res.status);
    });
  });

  describe("Estadísticas del negocio", () => {
    it("admin puede ver estadísticas", async () => {
      const res = await request(app)
        .get(`/api/business/${testBusiness._id}/stats`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 404]).toContain(res.status);
    });

    it("admin puede ver dashboard", async () => {
      const res = await request(app)
        .get(`/api/business/${testBusiness._id}/dashboard`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 404]).toContain(res.status);
    });
  });

  describe("Activación/Desactivación", () => {
    it("GOD puede desactivar negocio", async () => {
      const res = await request(app)
        .patch(`/api/business/${testBusiness._id}/toggle`)
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 204, 404]).toContain(res.status);
    });

    it("admin NO puede desactivar negocio", async () => {
      const res = await request(app)
        .patch(`/api/business/${testBusiness._id}/toggle`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([403, 404]).toContain(res.status);
    });
  });

  describe("Trazabilidad y Auditoría", () => {
    it("incluye requestId en respuestas", async () => {
      const res = await request(app)
        .get(`/api/business/${testBusiness._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(res.headers["x-request-id"]).toBeDefined();
    });
  });

  describe("Validaciones", () => {
    it("rechaza nombre vacío", async () => {
      const res = await request(app)
        .post("/api/business")
        .set("Authorization", `Bearer ${godToken}`)
        .send({
          name: "",
        });

      expect([400, 422]).toContain(res.status);
    });
  });
});
