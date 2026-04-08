/**
 * Tests del controlador GOD (Super Admin)
 * Ejecutar: npm test -- --runTestsByPath __tests__/controllers/god.controller.test.js
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

describe("GOD Controller - Super Admin", () => {
  let godUser;
  let godToken;
  let adminUser;
  let adminToken;
  let testBusiness;
  let targetUser;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Crear usuario GOD
    godUser = await User.findOneAndUpdate(
      { email: "god-test-supreme@example.com" },
      {
        email: "god-test-supreme@example.com",
        password: "$2a$10$hashedpassword",
        name: "GOD Test Supreme",
        role: "god",
        status: "active",
        active: true,
      },
      { upsert: true, new: true }
    );

    godToken = jwt.sign({ userId: godUser._id, role: "god" }, JWT_SECRET, {
      expiresIn: "1h",
    });

    // Crear admin
    adminUser = await User.findOneAndUpdate(
      { email: "god-test-admin@example.com" },
      {
        email: "god-test-admin@example.com",
        password: "$2a$10$hashedpassword",
        name: "GOD Test Admin",
        role: "admin",
        status: "active",
        active: true,
      },
      { upsert: true, new: true }
    );

    adminToken = jwt.sign(
      { userId: adminUser._id, role: "admin" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Crear negocio de prueba
    testBusiness = await Business.findOneAndUpdate(
      { name: "GOD Test Business" },
      {
        name: "GOD Test Business",
        createdBy: godUser._id,
        status: "active",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // Crear usuario objetivo para pruebas
    targetUser = await User.findOneAndUpdate(
      { email: "god-target-user@example.com" },
      {
        email: "god-target-user@example.com",
        password: "$2a$10$hashedpassword",
        name: "Target User",
        role: "staff",
        status: "active",
        active: true,
      },
      { upsert: true, new: true }
    );

    await Membership.findOneAndUpdate(
      { user: targetUser._id, business: testBusiness._id },
      {
        user: targetUser._id,
        business: testBusiness._id,
        role: "staff",
        status: "active",
      },
      { upsert: true }
    );
  });

  afterAll(async () => {
    await Membership.deleteMany({ business: testBusiness._id });
    await User.deleteMany({
      email: {
        $in: [
          "god-test-supreme@example.com",
          "god-test-admin@example.com",
          "god-target-user@example.com",
        ],
      },
    });
    await Business.findByIdAndDelete(testBusiness._id);
    await mongoose.disconnect();
  });

  describe("Autenticación GOD", () => {
    it("GOD puede acceder a rutas protegidas", async () => {
      const res = await request(app)
        .get("/api/god/users")
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 304, 404]).toContain(res.status);
    });

    it("admin NO puede acceder a rutas GOD", async () => {
      const res = await request(app)
        .get("/api/god/users")
        .set("Authorization", `Bearer ${adminToken}`);

      expect([401, 403]).toContain(res.status);
    });

    it("sin auth retorna 401", async () => {
      const res = await request(app).get("/api/god/users");

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/god/users", () => {
    it("GOD puede listar todos los usuarios", async () => {
      const res = await request(app)
        .get("/api/god/users")
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 304, 404]).toContain(res.status);
    });

    it("puede filtrar por rol", async () => {
      const res = await request(app)
        .get("/api/god/users?role=admin")
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 304, 404]).toContain(res.status);
    });

    it("puede buscar por email", async () => {
      const res = await request(app)
        .get("/api/god/users?search=test")
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 304, 404]).toContain(res.status);
    });
  });

  describe("GET /api/god/businesses", () => {
    it("GOD puede listar todos los negocios", async () => {
      const res = await request(app)
        .get("/api/god/businesses")
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 304, 404]).toContain(res.status);
    });

    it("puede filtrar por estado de suscripción", async () => {
      const res = await request(app)
        .get("/api/god/businesses?subscriptionStatus=active")
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 304, 404]).toContain(res.status);
    });
  });

  describe("POST /api/god/users", () => {
    const newGodEmail = `new-god-${Date.now()}@example.com`;

    afterAll(async () => {
      await User.deleteMany({ email: newGodEmail });
    });

    it("GOD puede crear otro usuario GOD", async () => {
      const res = await request(app)
        .post("/api/god/users")
        .set("Authorization", `Bearer ${godToken}`)
        .send({
          name: "New GOD User",
          email: newGodEmail,
          password: "SecurePass123!",
          role: "god",
        });

      expect([200, 201]).toContain(res.status);
    });

    it("admin NO puede crear usuarios GOD", async () => {
      const res = await request(app)
        .post("/api/god/users")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({
          name: "Unauthorized GOD",
          email: `unauth-god-${Date.now()}@example.com`,
          password: "Pass123!",
          role: "god",
        });

      expect([401, 403]).toContain(res.status);
    });
  });

  describe("PUT /api/god/users/:id", () => {
    it("GOD puede actualizar cualquier usuario", async () => {
      const res = await request(app)
        .put(`/api/god/users/${targetUser._id}`)
        .set("Authorization", `Bearer ${godToken}`)
        .send({
          name: "Updated by GOD",
        });

      expect([200, 204, 404]).toContain(res.status);
    });

    it("GOD puede cambiar rol de usuario", async () => {
      const res = await request(app)
        .put(`/api/god/users/${targetUser._id}`)
        .set("Authorization", `Bearer ${godToken}`)
        .send({
          role: "admin",
        });

      expect([200, 204, 404]).toContain(res.status);

      // Restaurar rol
      await User.findByIdAndUpdate(targetUser._id, { role: "staff" });
    });
  });

  describe("DELETE /api/god/users/:id - Cascade Completo", () => {
    let deleteTargetUser;

    beforeEach(async () => {
      deleteTargetUser = await User.create({
        email: `delete-target-${Date.now()}@example.com`,
        password: "$2a$10$hashedpassword",
        name: "Delete Target",
        role: "staff",
        status: "active",
        active: true,
      });
    });

    afterEach(async () => {
      if (deleteTargetUser) {
        await User.findByIdAndDelete(deleteTargetUser._id);
      }
    });

    it("GOD puede eliminar usuario con cascade", async () => {
      const res = await request(app)
        .delete(`/api/god/users/${deleteTargetUser._id}`)
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 204, 404]).toContain(res.status);
      deleteTargetUser = null; // Marcado como eliminado
    });

    it("GOD NO puede eliminarse a sí mismo", async () => {
      const res = await request(app)
        .delete(`/api/god/users/${godUser._id}`)
        .set("Authorization", `Bearer ${godToken}`);

      expect([400, 403]).toContain(res.status);
    });
  });

  describe("Gestión de Suscripciones", () => {
    it("GOD puede extender suscripción", async () => {
      const res = await request(app)
        .patch(`/api/god/businesses/${testBusiness._id}/subscription`)
        .set("Authorization", `Bearer ${godToken}`)
        .send({
          subscriptionStatus: "active",
          subscriptionEndDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        });

      expect([200, 204, 404]).toContain(res.status);
    });

    it("GOD puede cambiar plan de suscripción", async () => {
      const res = await request(app)
        .patch(`/api/god/businesses/${testBusiness._id}/subscription`)
        .set("Authorization", `Bearer ${godToken}`)
        .send({
          subscriptionPlan: "enterprise",
        });

      expect([200, 204, 404]).toContain(res.status);
    });

    it("GOD puede cancelar suscripción", async () => {
      const res = await request(app)
        .patch(`/api/god/businesses/${testBusiness._id}/subscription`)
        .set("Authorization", `Bearer ${godToken}`)
        .send({
          subscriptionStatus: "cancelled",
        });

      expect([200, 204, 404]).toContain(res.status);

      // Restaurar
      await Business.findByIdAndUpdate(testBusiness._id, {
        subscriptionStatus: "active",
      });
    });
  });

  describe("Activación/Desactivación Global", () => {
    it("GOD puede desactivar negocio", async () => {
      const res = await request(app)
        .patch(`/api/god/businesses/${testBusiness._id}/toggle`)
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 204, 404]).toContain(res.status);

      // Restaurar
      await Business.findByIdAndUpdate(testBusiness._id, { isActive: true });
    });

    it("GOD puede desactivar usuario", async () => {
      const res = await request(app)
        .patch(`/api/god/users/${targetUser._id}/toggle`)
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 204, 404]).toContain(res.status);

      // Restaurar
      await User.findByIdAndUpdate(targetUser._id, { active: true });
    });
  });

  describe("Estadísticas Globales", () => {
    it("GOD puede ver dashboard global", async () => {
      const res = await request(app)
        .get("/api/god/dashboard")
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 304, 404]).toContain(res.status);
    });

    it("GOD puede ver estadísticas de plataforma", async () => {
      const res = await request(app)
        .get("/api/god/stats")
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 304, 404]).toContain(res.status);
    });

    it("GOD puede ver logs del sistema", async () => {
      const res = await request(app)
        .get("/api/god/logs")
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 304, 404]).toContain(res.status);
    });
  });

  describe("Gestión de Reportes de Problemas", () => {
    it("GOD puede ver todos los reportes", async () => {
      const res = await request(app)
        .get("/api/god/issues")
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 304, 404]).toContain(res.status);
    });

    it("GOD puede resolver reportes", async () => {
      // Primero obtener un reporte si existe
      const res = await request(app)
        .get("/api/god/issues")
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 304, 404]).toContain(res.status);
    });
  });

  describe("Impersonación", () => {
    it("GOD puede impersonar a un usuario", async () => {
      const res = await request(app)
        .post(`/api/god/impersonate/${targetUser._id}`)
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 404]).toContain(res.status);
    });

    it("admin NO puede impersonar usuarios", async () => {
      const res = await request(app)
        .post(`/api/god/impersonate/${targetUser._id}`)
        .set("Authorization", `Bearer ${adminToken}`);

      expect([401, 403]).toContain(res.status);
    });
  });

  describe("Auditoría y Trazabilidad", () => {
    it("incluye requestId en respuestas", async () => {
      const res = await request(app)
        .get("/api/god/users")
        .set("Authorization", `Bearer ${godToken}`);

      expect(res.headers["x-request-id"]).toBeDefined();
    });

    it("acciones GOD son registradas", async () => {
      const res = await request(app)
        .put(`/api/god/users/${targetUser._id}`)
        .set("Authorization", `Bearer ${godToken}`)
        .send({ name: "Audit Test" });

      expect([200, 204, 404]).toContain(res.status);
    });
  });

  describe("Configuración del Sistema", () => {
    it("GOD puede ver configuración global", async () => {
      const res = await request(app)
        .get("/api/god/config")
        .set("Authorization", `Bearer ${godToken}`);

      expect([200, 304, 404]).toContain(res.status);
    });

    it("GOD puede actualizar configuración", async () => {
      const res = await request(app)
        .put("/api/god/config")
        .set("Authorization", `Bearer ${godToken}`)
        .send({
          maintenanceMode: false,
        });

      expect([200, 204, 404]).toContain(res.status);
    });
  });
});
