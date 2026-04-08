/**
 * Tests de integración para el controlador de créditos/fiados
 * Ejecutar: npm test -- --runTestsByPath __tests__/controllers/credit.controller.test.js
 */

import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";

let mongoServer;
let app;
let User, Business, Customer, Credit, CreditPayment, Membership;
let adminToken;
let testUser;
let testBusiness;
let testCustomer;

describe("Credit Controller", () => {
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

    const CreditModule = await import("../../models/Credit.js");
    Credit = CreditModule.default;

    const CreditPaymentModule = await import("../../models/CreditPayment.js");
    CreditPayment = CreditPaymentModule.default;

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
    await Credit.deleteMany({});
    await CreditPayment.deleteMany({});
    await Membership.deleteMany({});

    // Crear admin de prueba
    const hashed = await bcrypt.hash("password123", 10);
    testUser = await User.create({
      name: "Admin Credits",
      email: "admin.credits@test.com",
      password: hashed,
      role: "admin",
      status: "active",
    });

    // Crear negocio de prueba
    testBusiness = await Business.create({
      name: "Negocio Test Credits",
      description: "Negocio para tests de créditos",
      active: true,
      createdBy: testUser._id,
    });

    // Actualizar usuario con business
    await User.findByIdAndUpdate(testUser._id, { business: testBusiness._id });

    // Crear membership
    await Membership.create({
      user: testUser._id,
      business: testBusiness._id,
      role: "admin",
      status: "active",
    });

    // Hacer login para obtener token
    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.credits@test.com", password: "password123" })
      .expect(200);
    adminToken = login.body.token;

    // Crear cliente de prueba
    testCustomer = await Customer.create({
      business: testBusiness._id,
      name: "Cliente Test",
      email: "cliente@test.com",
      phone: "1234567890",
      totalDebt: 0,
    });
  });

  describe("POST /api/credits", () => {
    it("debe crear un nuevo crédito/fiado", async () => {
      const creditData = {
        customerId: testCustomer._id.toString(),
        amount: 100,
        description: "Fiado de prueba",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      };

      const res = await request(app)
        .post("/api/credits")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send(creditData);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.credit).toBeDefined();
      expect(res.body.credit.originalAmount).toBe(100);
      expect(res.body.credit.remainingAmount).toBe(100);
      expect(res.body.credit.status).toBe("pending");
      expect(res.body.requestId).toBeDefined();
    });

    it("debe fallar sin cliente", async () => {
      const res = await request(app)
        .post("/api/credits")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({ amount: 100 });

      expect(res.status).toBe(400);
    });

    it("debe actualizar totalDebt del cliente", async () => {
      await request(app)
        .post("/api/credits")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          customerId: testCustomer._id.toString(),
          amount: 150,
        })
        .expect(201);

      const customer = await Customer.findById(testCustomer._id);
      expect(customer.totalDebt).toBe(150);
    });
  });

  describe("GET /api/credits", () => {
    beforeEach(async () => {
      await Credit.create({
        customer: testCustomer._id,
        business: testBusiness._id,
        createdBy: testUser._id,
        originalAmount: 200,
        remainingAmount: 200,
        status: "pending",
      });
    });

    it("debe obtener lista de créditos", async () => {
      const res = await request(app)
        .get("/api/credits")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.credits).toHaveLength(1);
      expect(res.body.pagination).toBeDefined();
    });

    it("debe filtrar por estado", async () => {
      const res = await request(app)
        .get("/api/credits?status=paid")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.credits).toHaveLength(0);
    });
  });

  describe("POST /api/credits/:id/payments", () => {
    let testCredit;

    beforeEach(async () => {
      testCredit = await Credit.create({
        customer: testCustomer._id,
        business: testBusiness._id,
        createdBy: testUser._id,
        originalAmount: 100,
        remainingAmount: 100,
        status: "pending",
      });
      await Customer.findByIdAndUpdate(testCustomer._id, { totalDebt: 100 });
    });

    it("debe registrar pago parcial", async () => {
      const res = await request(app)
        .post(`/api/credits/${testCredit._id}/payments`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({ amount: 30, paymentMethod: "cash" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.payment.amount).toBe(30);
      expect(res.body.payment.balanceBefore).toBe(100);
      expect(res.body.payment.balanceAfter).toBe(70);
      expect(res.body.credit.status).toBe("partial");
      expect(res.body.credit.remainingAmount).toBe(70);
    });

    it("debe registrar pago total y marcar como pagado", async () => {
      const res = await request(app)
        .post(`/api/credits/${testCredit._id}/payments`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({ amount: 100 });

      expect(res.status).toBe(200);
      expect(res.body.credit.status).toBe("paid");
      expect(res.body.credit.remainingAmount).toBe(0);
      expect(res.body.credit.paidAt).toBeDefined();
    });

    it("debe reducir totalDebt del cliente", async () => {
      await request(app)
        .post(`/api/credits/${testCredit._id}/payments`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({ amount: 40 });

      const customer = await Customer.findById(testCustomer._id);
      expect(customer.totalDebt).toBe(60);
    });

    it("debe fallar si monto excede saldo", async () => {
      const res = await request(app)
        .post(`/api/credits/${testCredit._id}/payments`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({ amount: 150 });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("excede el saldo");
    });
  });

  describe("GET /api/credits/metrics", () => {
    beforeEach(async () => {
      await Credit.create([
        {
          customer: testCustomer._id,
          business: testBusiness._id,
          createdBy: testUser._id,
          originalAmount: 100,
          remainingAmount: 100,
          status: "pending",
        },
        {
          customer: testCustomer._id,
          business: testBusiness._id,
          createdBy: testUser._id,
          originalAmount: 200,
          remainingAmount: 50,
          paidAmount: 150,
          status: "partial",
        },
        {
          customer: testCustomer._id,
          business: testBusiness._id,
          createdBy: testUser._id,
          originalAmount: 50,
          remainingAmount: 0,
          paidAmount: 50,
          status: "paid",
        },
      ]);
    });

    it("debe obtener métricas de créditos", async () => {
      const res = await request(app)
        .get("/api/credits/metrics")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.metrics).toBeDefined();
      expect(res.body.metrics.total.totalCredits).toBe(3);
      expect(res.body.metrics.total.totalOriginalAmount).toBe(350);
      expect(res.body.metrics.total.totalPaidAmount).toBe(200);
      expect(res.body.metrics.byStatus).toBeDefined();
    });
  });

  describe("POST /api/credits/:id/cancel", () => {
    let testCredit;

    beforeEach(async () => {
      testCredit = await Credit.create({
        customer: testCustomer._id,
        business: testBusiness._id,
        createdBy: testUser._id,
        originalAmount: 100,
        remainingAmount: 100,
        status: "pending",
      });
      await Customer.findByIdAndUpdate(testCustomer._id, { totalDebt: 100 });
    });

    it("debe cancelar un crédito", async () => {
      const res = await request(app)
        .post(`/api/credits/${testCredit._id}/cancel`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({ reason: "Cliente canceló pedido" });

      expect(res.status).toBe(200);
      expect(res.body.credit.status).toBe("cancelled");

      // Verificar que se redujo la deuda
      const customer = await Customer.findById(testCustomer._id);
      expect(customer.totalDebt).toBe(0);
    });
  });
});
