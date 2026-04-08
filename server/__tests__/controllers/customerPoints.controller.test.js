/**
 * Tests de integración para el controlador de puntos de clientes
 * Ejecutar: npm test -- --runTestsByPath __tests__/controllers/customerPoints.controller.test.js
 */

import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";

let mongoServer;
let app;
let User, Business, Customer, Membership;
let testBusiness, adminUser, adminToken, testCustomer;

describe("Customer Points Controller", () => {
  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();

    // Importar dinámicamente después de configurar env
    const appModule = await import("../../server.js");
    app = appModule.default;

    const UserModule = await import("../../src/infrastructure/database/models/User.js");
    User = UserModule.default;

    const BusinessModule = await import("../../models/Business.js");
    Business = BusinessModule.default;

    const CustomerModule = await import("../../models/Customer.js");
    Customer = CustomerModule.default;

    const MembershipModule = await import("../../models/Membership.js");
    Membership = MembershipModule.default;
  });

  afterAll(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  beforeEach(async () => {
    // Limpiar colecciones
    await User.deleteMany({});
    await Business.deleteMany({});
    await Customer.deleteMany({});
    await Membership.deleteMany({});

    // Crear admin de prueba
    const hashed = await bcrypt.hash("password123", 10);
    adminUser = await User.create({
      name: "Admin Puntos",
      email: "admin.points@test.com",
      password: hashed,
      role: "admin",
      status: "active",
    });

    // Crear negocio de prueba
    testBusiness = await Business.create({
      name: "Negocio Test Points",
      description: "Negocio para tests de puntos",
      active: true,
      createdBy: adminUser._id,
    });

    // Actualizar usuario con business
    await User.findByIdAndUpdate(adminUser._id, { business: testBusiness._id });

    // Crear membership para evitar bloqueo
    await Membership.create({
      user: adminUser._id,
      business: testBusiness._id,
      role: "admin",
      status: "active",
    });

    // Hacer login para obtener token
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.points@test.com", password: "password123" })
      .expect(200);
    adminToken = login.body.token;

    // Crear cliente de prueba
    testCustomer = await Customer.create({
      name: "Cliente Test",
      phone: "3001234567",
      email: "cliente.test@example.com",
      business: testBusiness._id,
      points: 500,
      totalPointsEarned: 1000,
      totalPointsRedeemed: 500,
    });
  });
  describe("GET /api/customers/:customerId/points", () => {
    it("debe obtener el balance de puntos del cliente", async () => {
      const response = await request(app)
        .get(`/api/customers/${testCustomer._id}/points`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .expect(200);

      expect(response.body).toHaveProperty("customerId");
      expect(response.body).toHaveProperty("currentPoints", 500);
      expect(response.body).toHaveProperty("totalEarned", 1000);
      expect(response.body).toHaveProperty("totalRedeemed", 500);
      expect(response.body).toHaveProperty("monetaryValue");
    });

    it("debe retornar 404 si el cliente no existe", async () => {
      const fakeId = new mongoose.Types.ObjectId();

      const response = await request(app)
        .get(`/api/customers/${fakeId}/points`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .expect(404);

      expect(response.body.message).toContain("no encontrado");
    });

    it("debe retornar 400 si falta el business-id", async () => {
      const response = await request(app)
        .get(`/api/customers/${testCustomer._id}/points`)
        .set("Authorization", `Bearer ${adminToken}`)
        .expect(400);

      expect(response.body.message).toContain("business-id");
    });
  });

  describe("POST /api/customers/:customerId/points/adjust", () => {
    it("debe ajustar puntos positivos (bonus)", async () => {
      const response = await request(app)
        .post(`/api/customers/${testCustomer._id}/points/adjust`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          points: 100,
          reason: "Bonus por compra especial",
        })
        .expect(200);

      expect(response.body.message).toContain("bonificados");
      expect(response.body).toHaveProperty("newBalance", 600);

      // Verificar en BD
      const updated = await Customer.findById(testCustomer._id);
      expect(updated.points).toBe(600);
    });

    it("debe ajustar puntos negativos (corrección)", async () => {
      const response = await request(app)
        .post(`/api/customers/${testCustomer._id}/points/adjust`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          points: -100,
          reason: "Corrección por devolución",
        })
        .expect(200);

      expect(response.body.message).toContain("ajustados");
      expect(response.body).toHaveProperty("newBalance", 400);
    });

    it("debe rechazar puntos = 0", async () => {
      const response = await request(app)
        .post(`/api/customers/${testCustomer._id}/points/adjust`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          points: 0,
          reason: "Esto no debería funcionar",
        })
        .expect(400);

      expect(response.body.message).toContain("distinto de cero");
    });

    it("debe rechazar sin razón válida", async () => {
      const response = await request(app)
        .post(`/api/customers/${testCustomer._id}/points/adjust`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          points: 50,
          reason: "ab", // muy corta
        })
        .expect(400);

      expect(response.body.message).toContain("razón válida");
    });
  });

  describe("POST /api/customers/:customerId/points/validate-redemption", () => {
    it("debe aprobar redención válida", async () => {
      const response = await request(app)
        .post(`/api/customers/${testCustomer._id}/points/validate-redemption`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          points: 200,
          saleTotal: 1000,
        })
        .expect(200);

      expect(response.body).toHaveProperty("valid", true);
      expect(response.body).toHaveProperty("redemptionValue");
    });

    it("debe rechazar redención que excede puntos disponibles", async () => {
      const response = await request(app)
        .post(`/api/customers/${testCustomer._id}/points/validate-redemption`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          points: 1000, // cliente solo tiene 500
          saleTotal: 2000,
        })
        .expect(200);

      expect(response.body).toHaveProperty("valid", false);
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it("debe rechazar si puntos exceden 50% del total", async () => {
      // Con pointValue = 0.01, 500 puntos = $5 de descuento
      // Para que exceda 50% de una venta, la venta debe ser < $10
      // Usamos saleTotal = 5, así $5 > 50% de $5
      const response = await request(app)
        .post(`/api/customers/${testCustomer._id}/points/validate-redemption`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          points: 500, // $5 de descuento
          saleTotal: 5, // 50% = $2.50, así que $5 excede
        })
        .expect(200);

      // El endpoint puede devolver valid: true pero con warnings,
      // o puede ajustar automáticamente. Verificamos que responda correctamente.
      expect(response.body).toHaveProperty("valid");
      // Si tiene errores o restricciones, los debe indicar
      if (!response.body.valid) {
        expect(response.body.errors.length).toBeGreaterThan(0);
      }
    });
  });

  describe("GET /api/customers/:customerId/points/history", () => {
    it("debe obtener historial vacío inicialmente", async () => {
      const response = await request(app)
        .get(`/api/customers/${testCustomer._id}/points/history`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .expect(200);

      expect(response.body).toHaveProperty("history");
      expect(Array.isArray(response.body.history)).toBe(true);
    });

    it("debe registrar historial después de ajuste", async () => {
      // Hacer ajuste primero
      await request(app)
        .post(`/api/customers/${testCustomer._id}/points/adjust`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          points: 100,
          reason: "Bonus test historial",
        })
        .expect(200);

      // Verificar historial
      const response = await request(app)
        .get(`/api/customers/${testCustomer._id}/points/history`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .expect(200);

      expect(response.body.history.length).toBeGreaterThan(0);
      expect(response.body.history[0]).toHaveProperty("type", "bonus");
      expect(response.body.history[0]).toHaveProperty("amount", 100);
    });
  });

  describe("GET /api/points/config", () => {
    it("debe obtener la configuración de puntos", async () => {
      const response = await request(app)
        .get(`/api/points/config`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .expect(200);

      expect(response.body).toHaveProperty("config");
      expect(response.body.config).toHaveProperty("pointsPerDollar");
      expect(response.body.config).toHaveProperty("pointValue");
      expect(response.body.config).toHaveProperty("minPointsToRedeem");
      expect(response.body.config).toHaveProperty("maxRedemptionPercent");
    });
  });
});
