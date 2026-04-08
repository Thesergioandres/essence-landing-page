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
import Branch from "../models/Branch.js";
import Business from "../models/Business.js";
import Customer from "../models/Customer.js";
import Product from "../src/infrastructure/database/models/Product.js";
import Promotion from "../models/Promotion.js";
import User from "../src/infrastructure/database/models/User.js";

// Integration tests for promotions engine

describe("Promotions engine", () => {
  let app;
  let mongoServer;
  let adminToken;
  let businessId;
  let branchA;
  let branchB;
  let productId;
  let customerVip;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret";

    mongoServer = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongoServer.getUri();

    const mod = await import("../server.js");
    app = mod.default;

    const adminHashed = await bcrypt.hash("password123", 10);
    const admin = await User.create({
      name: "Admin Promo",
      email: "admin.promo@test.com",
      password: adminHashed,
      role: "admin",
      active: true,
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.promo@test.com", password: "password123" })
      .expect(200);
    adminToken = login.body.token;

    const business = await Business.create({
      name: "Negocio Promos",
      createdBy: admin._id,
    });
    businessId = business._id.toString();

    const branchDocA = await Branch.create({
      business: businessId,
      name: "Sede Promo A",
    });
    branchA = branchDocA._id.toString();

    const branchDocB = await Branch.create({
      business: businessId,
      name: "Sede Promo B",
    });
    branchB = branchDocB._id.toString();

    const product = await Product.create({
      name: "Producto Promo",
      description: "Para promos",
      purchasePrice: 50,
      distributorPrice: 60,
      clientPrice: 100,
      salePrice: 100,
      category: new mongoose.Types.ObjectId(),
      totalStock: 100,
      warehouseStock: 80,
    });
    productId = product._id.toString();

    customerVip = await Customer.create({
      name: "Cliente VIP",
      business: businessId,
      segments: ["vip"],
    });
  });

  beforeEach(async () => {
    await Promotion.deleteMany({});
    await Customer.deleteMany({});
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Promotion.deleteMany({});
    await Product.deleteMany({});
    await Branch.deleteMany({});
    await Customer.deleteMany({});
    await Business.deleteMany({});
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("crea una promo 2x1 y la evalúa", async () => {
    const createRes = await request(app)
      .post("/api/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        name: "2x1 Producto",
        type: "bogo",
        status: "active",
        startDate: new Date(Date.now() - 1000),
        endDate: new Date(Date.now() + 24 * 3600 * 1000),
        exclusive: true,
        branches: [branchA],
        segments: ["vip"],
        buyItems: [{ product: productId, quantity: 2 }],
        rewardItems: [
          { product: productId, quantity: 1, discountType: "free" },
        ],
      })
      .expect(201);

    const promoId = createRes.body.promotion._id;

    const evalRes = await request(app)
      .post(`/api/promotions/${promoId}/evaluate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        branchId: branchA,
        segments: ["vip"],
        items: [
          {
            product: productId,
            quantity: 2,
            price: 100,
          },
        ],
      })
      .expect(200);

    expect(evalRes.body.result.applicable).toBe(true);
    expect(evalRes.body.result.discountAmount).toBe(100);
  });

  it("rechaza la promo si la sede no coincide", async () => {
    const createRes = await request(app)
      .post("/api/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        name: "Promo restringida",
        type: "discount",
        status: "active",
        exclusive: false,
        branches: [branchA],
        discount: { type: "percentage", value: 10 },
        thresholds: { minSubtotal: 50 },
      })
      .expect(201);

    const promoId = createRes.body.promotion._id;

    const evalRes = await request(app)
      .post(`/api/promotions/${promoId}/evaluate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        branchId: branchB,
        items: [
          {
            product: productId,
            quantity: 1,
            price: 100,
          },
        ],
      })
      .expect(200);

    expect(evalRes.body.result.applicable).toBe(false);
    expect(evalRes.body.result.discountAmount).toBe(0);
  });

  it("aplica descuento por volumen", async () => {
    const createRes = await request(app)
      .post("/api/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        name: "Volumen 10%",
        type: "volume",
        status: "active",
        volumeRule: {
          minQty: 5,
          discountType: "percentage",
          discountValue: 10,
        },
      })
      .expect(201);

    const promoId = createRes.body.promotion._id;

    const evalRes = await request(app)
      .post(`/api/promotions/${promoId}/evaluate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        items: [
          {
            product: productId,
            quantity: 5,
            price: 50,
          },
        ],
      })
      .expect(200);

    expect(evalRes.body.result.applicable).toBe(true);
    expect(evalRes.body.result.discountAmount).toBe(25);
  });

  it("aplica solo al cliente permitido", async () => {
    const createRes = await request(app)
      .post("/api/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        name: "Solo cliente",
        type: "discount",
        status: "active",
        customers: [customerVip._id],
        discount: { type: "percentage", value: 20 },
      })
      .expect(201);

    const promoId = createRes.body.promotion._id;

    // Sin customerId debe bloquear
    const blocked = await request(app)
      .post(`/api/promotions/${promoId}/evaluate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        items: [{ product: productId, quantity: 1, price: 100 }],
      })
      .expect(200);
    expect(blocked.body.result.applicable).toBe(false);
    expect(blocked.body.result.reason).toBe("customer_required");

    // Con otro customer bloquea
    const otherCustomer = await Customer.create({
      name: "Otro",
      business: businessId,
    });

    const blocked2 = await request(app)
      .post(`/api/promotions/${promoId}/evaluate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        customerId: otherCustomer._id,
        items: [{ product: productId, quantity: 1, price: 100 }],
      })
      .expect(200);
    expect(blocked2.body.result.applicable).toBe(false);
    expect(blocked2.body.result.reason).toBe("customer_blocked");

    // Con el cliente permitido aplica
    const ok = await request(app)
      .post(`/api/promotions/${promoId}/evaluate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        customerId: customerVip._id,
        items: [{ product: productId, quantity: 1, price: 100 }],
      })
      .expect(200);

    expect(ok.body.result.applicable).toBe(true);
    expect(ok.body.result.discountAmount).toBe(20);
  });

  it("respeta segmentos de cliente", async () => {
    const createRes = await request(app)
      .post("/api/promotions")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        name: "Segmento VIP",
        type: "discount",
        status: "active",
        segments: ["vip"],
        discount: { type: "percentage", value: 15 },
      })
      .expect(201);

    const promoId = createRes.body.promotion._id;

    const blocked = await request(app)
      .post(`/api/promotions/${promoId}/evaluate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        customerId: customerVip._id,
        customerSegments: ["regular"],
        items: [{ product: productId, quantity: 1, price: 100 }],
      })
      .expect(200);

    expect(blocked.body.result.applicable).toBe(false);
    expect(blocked.body.result.reason).toBe("segment_blocked");

    const ok = await request(app)
      .post(`/api/promotions/${promoId}/evaluate`)
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .send({
        customerId: customerVip._id,
        customerSegments: ["vip"],
        items: [{ product: productId, quantity: 1, price: 100 }],
      })
      .expect(200);

    expect(ok.body.result.applicable).toBe(true);
    expect(ok.body.result.discountAmount).toBe(15);
  });
});
