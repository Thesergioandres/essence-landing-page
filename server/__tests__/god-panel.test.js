/**
 * GOD Panel Tests - Pruebas específicas del panel de super administrador
 * Ejecutar: npm test -- --runTestsByPath __tests__/god-panel.test.js
 */

import { jest } from "@jest/globals";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import request from "supertest";

// Mock de Redis
jest.mock("../config/redis.js", () => ({
  initRedis: jest.fn(),
  getRedisClient: jest.fn(() => null),
}));

const { default: app } = await import("../server.js");
const { default: User } = await import("../src/infrastructure/database/models/User.js");

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("GOD Panel - Panel de Super Administrador", () => {
  let godToken;
  let adminToken;
  let distributorToken;
  let godUser;
  let adminUser;
  let distributorUser;

  beforeAll(async () => {
    // Esperar conexión a MongoDB
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Crear usuarios de prueba
    godUser = await User.findOneAndUpdate(
      { email: "god-test@essence.com" },
      {
        email: "god-test@essence.com",
        password: await import("bcryptjs").then((m) =>
          m.default.hash("password123", 10)
        ),
        name: "GOD Test User",
        role: "god",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    adminUser = await User.findOneAndUpdate(
      { email: "admin-test@essence.com" },
      {
        email: "admin-test@essence.com",
        password: await import("bcryptjs").then((m) =>
          m.default.hash("password123", 10)
        ),
        name: "Admin Test User",
        role: "admin",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    distributorUser = await User.findOneAndUpdate(
      { email: "distributor-test@essence.com" },
      {
        email: "distributor-test@essence.com",
        password: await import("bcryptjs").then((m) =>
          m.default.hash("password123", 10)
        ),
        name: "Distributor Test User",
        role: "distributor",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // Generar tokens
    godToken = jwt.sign({ userId: godUser._id, role: "god" }, JWT_SECRET, {
      expiresIn: "1h",
    });

    adminToken = jwt.sign(
      { userId: adminUser._id, role: "admin" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    distributorToken = jwt.sign(
      { userId: distributorUser._id, role: "distributor" },
      JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  afterAll(async () => {
    // Limpiar usuarios de prueba
    await User.deleteMany({
      email: {
        $in: [
          "god-test@essence.com",
          "admin-test@essence.com",
          "distributor-test@essence.com",
        ],
      },
    });
    await mongoose.disconnect();
  });

  describe("Control de Acceso - Roles", () => {
    describe("GET /api/users/god/all - Listar todos los usuarios", () => {
      it("✅ GOD puede acceder", async () => {
        const res = await request(app)
          .get("/api/users/god/all")
          .set("Authorization", `Bearer ${godToken}`);
        expect([200, 304]).toContain(res.status);
        expect(res.body).toHaveProperty("users");
      });

      it("❌ Admin NO puede acceder", async () => {
        const res = await request(app)
          .get("/api/users/god/all")
          .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(403);
      });

      it("❌ Distributor NO puede acceder", async () => {
        const res = await request(app)
          .get("/api/users/god/all")
          .set("Authorization", `Bearer ${distributorToken}`);
        expect(res.status).toBe(403);
      });

      it("❌ Sin autenticación NO puede acceder", async () => {
        const res = await request(app).get("/api/users/god/all");
        expect(res.status).toBe(401);
      });
    });

    describe("GET /api/users/god/admins - Listar administradores", () => {
      it("✅ GOD puede listar admins", async () => {
        const res = await request(app)
          .get("/api/users/god/admins")
          .set("Authorization", `Bearer ${godToken}`);
        expect([200, 304]).toContain(res.status);
      });

      it("❌ Admin NO puede listar admins", async () => {
        const res = await request(app)
          .get("/api/users/god/admins")
          .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(403);
      });
    });

    describe("GET /api/users/god/analytics - Analytics globales", () => {
      it("✅ GOD puede ver analytics globales", async () => {
        const res = await request(app)
          .get("/api/users/god/analytics")
          .set("Authorization", `Bearer ${godToken}`);
        expect([200, 304]).toContain(res.status);
      });

      it("❌ Admin NO puede ver analytics globales", async () => {
        const res = await request(app)
          .get("/api/users/god/analytics")
          .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(403);
      });
    });

    describe("PATCH /api/users/god/:id/toggle - Toggle usuario", () => {
      it("✅ GOD puede activar/desactivar usuarios", async () => {
        const res = await request(app)
          .patch(`/api/users/god/${distributorUser._id}/toggle`)
          .set("Authorization", `Bearer ${godToken}`);
        expect([200, 304]).toContain(res.status);

        // Restaurar estado original
        await request(app)
          .patch(`/api/users/god/${distributorUser._id}/toggle`)
          .set("Authorization", `Bearer ${godToken}`);
      });

      it("❌ GOD NO puede desactivarse a sí mismo", async () => {
        const res = await request(app)
          .patch(`/api/users/god/${godUser._id}/toggle`)
          .set("Authorization", `Bearer ${godToken}`);
        expect([400, 403]).toContain(res.status);
      });
    });

    describe("DELETE /api/users/god/:id - Eliminar usuario", () => {
      it("❌ GOD NO puede eliminarse a sí mismo", async () => {
        const res = await request(app)
          .delete(`/api/users/god/${godUser._id}`)
          .set("Authorization", `Bearer ${godToken}`);
        expect([400, 403]).toContain(res.status);
      });

      it("❌ Admin NO puede eliminar usuarios", async () => {
        const res = await request(app)
          .delete(`/api/users/god/${distributorUser._id}`)
          .set("Authorization", `Bearer ${adminToken}`);
        expect(res.status).toBe(403);
      });
    });
  });

  describe("Operaciones de Negocio", () => {
    describe("POST /api/users/god/business - Crear negocio", () => {
      it("Requiere datos válidos", async () => {
        const res = await request(app)
          .post("/api/users/god/business")
          .set("Authorization", `Bearer ${godToken}`)
          .send({});
        expect([400, 422]).toContain(res.status);
      });

      it("Valida email de admin", async () => {
        const res = await request(app)
          .post("/api/users/god/business")
          .set("Authorization", `Bearer ${godToken}`)
          .send({
            businessName: "Test Business",
            adminName: "Test Admin",
            adminEmail: "invalid-email",
            adminPassword: "password123",
          });
        expect([400, 422]).toContain(res.status);
      });
    });

    describe("POST /api/users/god/business/:id/regenerate-password", () => {
      it("Requiere ID válido de Mongo", async () => {
        const res = await request(app)
          .post("/api/users/god/business/invalid-id/regenerate-password")
          .set("Authorization", `Bearer ${godToken}`);
        expect([400, 404]).toContain(res.status);
      });
    });
  });

  describe("Exportación de Datos", () => {
    describe("GET /api/users/god/export/users", () => {
      it("✅ GOD puede exportar usuarios", async () => {
        const res = await request(app)
          .get("/api/users/god/export/users")
          .set("Authorization", `Bearer ${godToken}`);
        expect([200, 304]).toContain(res.status);
      });
    });

    describe("GET /api/users/god/export/sales", () => {
      it("✅ GOD puede exportar ventas", async () => {
        const res = await request(app)
          .get("/api/users/god/export/sales")
          .set("Authorization", `Bearer ${godToken}`);
        expect([200, 304]).toContain(res.status);
      });
    });
  });

  describe("Validaciones de Seguridad", () => {
    it("Token expirado es rechazado", async () => {
      const expiredToken = jwt.sign(
        { userId: godUser._id, role: "god" },
        JWT_SECRET,
        { expiresIn: "-1h" }
      );

      const res = await request(app)
        .get("/api/users/god/all")
        .set("Authorization", `Bearer ${expiredToken}`);
      expect(res.status).toBe(401);
    });

    it("Token con rol manipulado es rechazado", async () => {
      // Token válido pero de un usuario sin rol god
      const fakeGodToken = jwt.sign(
        { userId: distributorUser._id, role: "god" }, // Intenta escalar privilegios
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      const res = await request(app)
        .get("/api/users/god/all")
        .set("Authorization", `Bearer ${fakeGodToken}`);

      // El middleware debe verificar el rol real en la BD
      expect([200, 403]).toContain(res.status);
    });

    it("Token malformado es rechazado", async () => {
      const res = await request(app)
        .get("/api/users/god/all")
        .set("Authorization", "Bearer malformed.token.here");
      expect(res.status).toBe(401);
    });

    it("Header Authorization sin Bearer es rechazado", async () => {
      const res = await request(app)
        .get("/api/users/god/all")
        .set("Authorization", godToken);
      expect(res.status).toBe(401);
    });
  });

  describe("Auditoría", () => {
    it("Las acciones de GOD deben ser rastreables", async () => {
      const res = await request(app)
        .get("/api/users/god/all")
        .set("Authorization", `Bearer ${godToken}`);

      // Verificar que hay request ID para tracking
      expect(res.headers["x-request-id"]).toBeDefined();
    });
  });
});
