import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import Business from "../models/Business.js";
import Provider from "../models/Provider.js";
import User from "../src/infrastructure/database/models/User.js";

let app;

describe("Providers API", () => {
  let mongo;
  let token;
  let businessId;

  beforeAll(async () => {
    process.env.NODE_ENV = "test";
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
    mongo = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongo.getUri();
    const mod = await import("../server.js");
    app = mod.default;

    const hashed = await bcrypt.hash("password123", 10);
    const admin = await User.create({
      name: "Admin",
      email: "admin@test.com",
      password: hashed,
      role: "admin",
      status: "active",
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin@test.com", password: "password123" })
      .expect(200);
    token = login.body.token;

    const business = await Business.create({
      name: "Biz Providers",
      createdBy: admin._id,
      config: { features: { inventory: true, providers: true } },
    });
    businessId = business._id.toString();
  });

  afterAll(async () => {
    await Provider.deleteMany({});
    await Business.deleteMany({});
    await User.deleteMany({});
    await mongoose.disconnect();
    await mongo.stop();
  });

  it("crea y lista proveedores", async () => {
    const createRes = await request(app)
      .post("/api/providers")
      .set("Authorization", `Bearer ${token}`)
      .set("x-business-id", businessId)
      .send({ name: "Proveedor 1", contactPhone: "123" })
      .expect(201);

    expect(createRes.body.provider.name).toBe("Proveedor 1");

    const listRes = await request(app)
      .get("/api/providers")
      .set("Authorization", `Bearer ${token}`)
      .set("x-business-id", businessId)
      .expect(200);

    expect(listRes.body.providers.length).toBe(1);
  });

  it("actualiza y elimina proveedor", async () => {
    const provider = await Provider.create({
      name: "Proveedor 2",
      business: businessId,
    });

    const updateRes = await request(app)
      .patch(`/api/providers/${provider._id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-business-id", businessId)
      .send({ contactName: "Nuevo" })
      .expect(200);

    expect(updateRes.body.provider.contactName).toBe("Nuevo");

    await request(app)
      .delete(`/api/providers/${provider._id}`)
      .set("Authorization", `Bearer ${token}`)
      .set("x-business-id", businessId)
      .expect(200);

    const afterDelete = await Provider.findById(provider._id);
    expect(afterDelete).toBeNull();
  });
});
