import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import bcrypt from "bcryptjs";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request from "supertest";
import Business from "../models/Business.js";
import Membership from "../models/Membership.js";
import User from "../src/infrastructure/database/models/User.js";

// Basic auth/scoping checks for analytics and profit history endpoints

describe("Analytics and profit history scoping", () => {
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

    await User.deleteMany({});
    await Business.deleteMany({});
    await Membership.deleteMany({});

    const passwordHash = await bcrypt.hash("password123", 10);
    const admin = await User.create({
      name: "Admin Analytics",
      email: "admin.analytics@test.com",
      password: passwordHash,
      role: "admin",
      active: true,
    });

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email: "admin.analytics@test.com", password: "password123" })
      .expect(200);
    adminToken = login.body.token;

    const business = await Business.create({
      name: "Negocio Analytics",
      createdBy: admin._id,
    });
    businessId = business._id.toString();

    await Membership.create({
      user: admin._id,
      business: businessId,
      role: "admin",
      status: "active",
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Business.deleteMany({});
    await Membership.deleteMany({});
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  it("rechaza analytics sin x-business-id", async () => {
    const res = await request(app)
      .get("/api/analytics/monthly-profit")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);

    expect(res.body.message).toContain("Falta x-business-id");
  });

  it("rechaza profit history summary sin x-business-id", async () => {
    const res = await request(app)
      .get("/api/profit-history/summary")
      .set("Authorization", `Bearer ${adminToken}`)
      .expect(400);

    expect(res.body.message).toContain("Falta x-business-id");
  });

  it("permite llamadas con x-business-id aunque no haya datos", async () => {
    const res = await request(app)
      .get("/api/analytics/monthly-profit")
      .set("Authorization", `Bearer ${adminToken}`)
      .set("x-business-id", businessId)
      .expect(200);

    expect(res.body).toHaveProperty("currentMonth");
  });
});
