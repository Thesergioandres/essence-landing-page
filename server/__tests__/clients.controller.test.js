import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import Business from "../models/Business.js";
import Customer from "../models/Customer.js";
import Product from "../src/infrastructure/database/models/Product.js";
import Sale from "../src/infrastructure/database/models/Sale.js";
import Segment from "../models/Segment.js";
import User from "../src/infrastructure/database/models/User.js";

// Integration tests for CRM clients and segments

describe("Clientes y segmentos", () => {
  let app;
  let mongoServer;
  let adminToken;
  let businessId;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();

    const mod = await import("../server.js");
    app = mod.default;

    const adminHashed = await bcrypt.hash("password123", 10);
    const admin = await User.create({
      name: "Admin CRM",
      email: "admin.crm@test.com",
      password: adminHashed,
      role: "admin",
      active: true,
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.crm@test.com", password: "password123" })
      .expect(200);
    adminToken = login.body.token;

    const business = await Business.create({
      name: "Negocio CRM",
      createdBy: admin._id,
    });
    businessId = business._id.toString();
  });

  beforeEach(async () => {
    await Customer.deleteMany({});
    await Segment.deleteMany({});
    await Product.deleteMany({});
    await Sale.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Sale.deleteMany({});
    await Product.deleteMany({});
    await Business.deleteMany({});
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("crea y lista segmentos", async () => {
    const createRes = await request(app)
      .post("/api/segments")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        name: "VIP",
        key: "VIP",
        description: "Clientes importantes",
      })
      .expect(201);

    expect(createRes.body.segment.name).toBe("VIP");
    expect(createRes.body.segment.key).toBe("vip");

    const listRes = await request(app)
      .get("/api/segments")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .expect(200);

    expect(listRes.body.segments).toHaveLength(1);
    expect(listRes.body.segments[0].key).toBe("vip");
  });

  it("crea cliente asociado a segmento y filtra por segmento", async () => {
    const segmentRes = await request(app)
      .post("/api/segments")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({ name: "Frecuentes", key: "freq" })
      .expect(201);

    const segmentId = segmentRes.body.segment._id;

    const customerRes = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({ name: "Cliente Uno", email: "uno@test.com", segment: segmentId })
      .expect(201);

    expect(customerRes.body.customer.segment).toBe(segmentId);

    const listRes = await request(app)
      .get(`/api/customers?segment=${segmentId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .expect(200);

    expect(listRes.body.customers).toHaveLength(1);
    expect(listRes.body.customers[0].name).toBe("Cliente Uno");
  });

  it("ajusta puntos acumulados sin permitir negativos", async () => {
    const customerRes = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({ name: "Cliente Dos" })
      .expect(201);

    const customerId = customerRes.body.customer._id;

    const addRes = await request(app)
      .post(`/api/customers/${customerId}/points`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({ delta: 10 })
      .expect(200);

    expect(addRes.body.customer.points).toBe(10);

    const removeRes = await request(app)
      .post(`/api/customers/${customerId}/points`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({ delta: -15 })
      .expect(200);

    expect(removeRes.body.customer.points).toBe(0);
  });

  it("aisla clientes por negocio", async () => {
    const customerRes = await request(app)
      .post("/api/customers")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({ name: "Cliente Tres" })
      .expect(201);

    const customerId = customerRes.body.customer._id;

    const otherBusiness = await Business.create({
      name: "Otro Negocio",
      createdBy: customerRes.body.customer.createdBy,
    });

    await request(app)
      .get(`/api/customers/${customerId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", otherBusiness._id.toString())
      .expect(404);
  });

  it("actualiza metricas del cliente al registrar venta admin", async () => {
    const customer = await Customer.create({
      name: "Cliente Venta",
      business: businessId,
    });

    const product = await Product.create({
      business: businessId,
      name: "Producto Venta",
      description: "Desc",
      purchasePrice: 50,
      distributorPrice: 60,
      clientPrice: 100,
      category: new mongoose.Types.ObjectId(),
      totalStock: 10,
      warehouseStock: 10,
    });

    await request(app)
      .post("/api/sales/admin")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        productId: product._id,
        quantity: 2,
        salePrice: 120,
        customerId: customer._id,
      })
      .expect(201);

    const updated = await Customer.findById(customer._id).lean();
    expect(updated.ordersCount).toBe(1);
    expect(updated.totalSpend).toBe(240);
    expect(new Date(updated.lastPurchaseAt).getTime()).toBeGreaterThan(0);
  });

  it("retorna estadisticas agregadas de clientes", async () => {
    const now = new Date();
    const oldDate = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);

    await Customer.create([
      {
        name: "Cliente Activo",
        business: businessId,
        email: "activo@test.com",
        phone: "+573000001",
        totalSpend: 300,
        ordersCount: 3,
        lastPurchaseAt: now,
        createdAt: now,
        updatedAt: now,
      },
      {
        name: "Cliente Inactivo",
        business: businessId,
        email: "inactivo@test.com",
        phone: "+573000002",
        totalSpend: 100,
        ordersCount: 1,
        lastPurchaseAt: oldDate,
        createdAt: oldDate,
        updatedAt: oldDate,
      },
    ]);

    const res = await request(app)
      .get(`/api/customers/stats`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .expect(200);

    const { totals, analytics, topCustomers } = res.body;

    expect(totals.totalCustomers).toBe(2);
    expect(totals.totalOrders).toBe(4);
    expect(totals.totalSpend).toBe(400);
    expect(totals.avgTicket).toBeCloseTo(100);

    expect(analytics.avgLTV).toBeCloseTo(200);
    expect(analytics.avgOrdersPerCustomer).toBeCloseTo(2);
    expect(analytics.churnedCustomers).toBe(1);
    expect(analytics.newCustomersLast30d).toBe(1);
    expect(analytics.avgRecencyDays).toBeGreaterThan(50);

    expect(topCustomers[0].name).toBe("Cliente Activo");
  });

  it("calcula RFM y ranking de clientes", async () => {
    const now = new Date();

    await Customer.create([
      {
        name: "Top RFM",
        business: businessId,
        email: "top@test.com",
        phone: "+573100001",
        totalSpend: 3000,
        ordersCount: 12,
        lastPurchaseAt: now,
      },
      {
        name: "Medio RFM",
        business: businessId,
        email: "medio@test.com",
        phone: "+573100002",
        totalSpend: 900,
        ordersCount: 3,
        lastPurchaseAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000),
      },
      {
        name: "Bajo RFM",
        business: businessId,
        email: "bajo@test.com",
        phone: "+573100003",
        totalSpend: 50,
        ordersCount: 1,
        lastPurchaseAt: new Date(now.getTime() - 200 * 24 * 60 * 60 * 1000),
      },
    ]);

    const res = await request(app)
      .get(`/api/customers/rfm`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .expect(200);

    const { distribution, topCustomers, totals } = res.body;

    expect(totals.totalCustomers).toBe(3);
    expect(distribution.length).toBeGreaterThanOrEqual(3);
    expect(topCustomers[0].name).toBe("Top RFM");
    expect(topCustomers[0].rfmScore).toBeGreaterThan(topCustomers[1].rfmScore);
  });
});
