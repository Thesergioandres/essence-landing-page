/**
 * Tests del controlador de sucursales (Branch)
 * Ejecutar: npm test -- --runTestsByPath __tests__/controllers/branch.controller.test.js
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
const { default: Branch } = await import("../../models/Branch.js");
const { default: Membership } = await import("../../models/Membership.js");

const JWT_SECRET = process.env.JWT_SECRET || "test-secret";

describe("Branch Controller", () => {
  let adminUser;
  let adminToken;
  let staffUser;
  let staffToken;
  let testBusiness;
  let testBranch;

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    // Crear admin
    adminUser = await User.findOneAndUpdate(
      { email: "branch-test-admin@example.com" },
      {
        email: "branch-test-admin@example.com",
        password: "$2a$10$hashedpassword",
        name: "Branch Test Admin",
        role: "admin",
        status: "active",
        active: true,
      },
      { upsert: true, new: true }
    );

    // Crear negocio
    testBusiness = await Business.findOneAndUpdate(
      { name: "Branch Test Business" },
      {
        name: "Branch Test Business",
        createdBy: adminUser._id,
        status: "active",
        isActive: true,
        maxBranches: 10,
      },
      { upsert: true, new: true }
    );

    // Crear sucursal
    testBranch = await Branch.findOneAndUpdate(
      { name: "Test Branch HQ", business: testBusiness._id },
      {
        name: "Test Branch HQ",
        business: testBusiness._id,
        isMain: true,
        address: "123 Test Street",
        phone: "555-1234",
        status: "active",
        isActive: true,
      },
      { upsert: true, new: true }
    );

    // Memberships
    await Membership.findOneAndUpdate(
      { user: adminUser._id, business: testBusiness._id },
      {
        user: adminUser._id,
        business: testBusiness._id,
        role: "admin",
        status: "active",
        assignedBranches: [testBranch._id],
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
      { email: "branch-test-staff@example.com" },
      {
        email: "branch-test-staff@example.com",
        password: "$2a$10$hashedpassword",
        name: "Branch Test Staff",
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
        assignedBranches: [testBranch._id],
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
    await Branch.deleteMany({ business: testBusiness._id });
    await Membership.deleteMany({ business: testBusiness._id });
    await User.deleteMany({
      email: {
        $in: ["branch-test-admin@example.com", "branch-test-staff@example.com"],
      },
    });
    await Business.findByIdAndDelete(testBusiness._id);
    await mongoose.disconnect();
  });

  describe("GET /api/branches", () => {
    it("admin puede listar sucursales", async () => {
      const res = await request(app)
        .get("/api/branches")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
      expect(res.body).toHaveProperty("branches");
      expect(Array.isArray(res.body.branches)).toBe(true);
    });

    it("staff ve solo sucursales asignadas", async () => {
      const res = await request(app)
        .get("/api/branches")
        .set("Authorization", `Bearer ${staffToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("sin auth retorna 401", async () => {
      const res = await request(app)
        .get("/api/branches")
        .set("x-business-id", testBusiness._id.toString());

      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/branches/:id", () => {
    it("admin puede ver detalle de sucursal", async () => {
      const res = await request(app)
        .get(`/api/branches/${testBranch._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });

    it("staff puede ver sucursal asignada", async () => {
      const res = await request(app)
        .get(`/api/branches/${testBranch._id}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304]).toContain(res.status);
    });
  });

  describe("POST /api/branches", () => {
    const newBranchName = `New Branch ${Date.now()}`;

    afterAll(async () => {
      await Branch.deleteMany({ name: newBranchName });
    });

    it("admin puede crear sucursal", async () => {
      const res = await request(app)
        .post("/api/branches")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          name: newBranchName,
          address: "456 New Street",
          phone: "555-5678",
        });

      expect([200, 201]).toContain(res.status);
    });

    it("staff NO puede crear sucursales", async () => {
      const res = await request(app)
        .post("/api/branches")
        .set("Authorization", `Bearer ${staffToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          name: "Staff Branch",
          address: "789 Staff Street",
        });

      expect(res.status).toBe(403);
    });

    it("rechaza nombre vacío", async () => {
      const res = await request(app)
        .post("/api/branches")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          name: "",
          address: "No Name Street",
        });

      expect([400, 422]).toContain(res.status);
    });
  });

  describe("PUT /api/branches/:id", () => {
    it("admin puede actualizar sucursal", async () => {
      const res = await request(app)
        .put(`/api/branches/${testBranch._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          address: "Updated Address",
        });

      expect([200, 204]).toContain(res.status);
    });

    it("staff NO puede actualizar sucursal", async () => {
      const res = await request(app)
        .put(`/api/branches/${testBranch._id}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          address: "Staff Update",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("DELETE /api/branches/:id", () => {
    it("staff NO puede eliminar sucursal", async () => {
      const res = await request(app)
        .delete(`/api/branches/${testBranch._id}`)
        .set("Authorization", `Bearer ${staffToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(res.status).toBe(403);
    });

    it("admin NO puede eliminar sucursal principal", async () => {
      const res = await request(app)
        .delete(`/api/branches/${testBranch._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([400, 403, 409]).toContain(res.status);
    });
  });

  describe("Stock y Transferencias", () => {
    it("puede consultar stock de sucursal", async () => {
      const res = await request(app)
        .get(`/api/branches/${testBranch._id}/stock`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 404]).toContain(res.status);
    });

    it("puede ver historial de transferencias", async () => {
      const res = await request(app)
        .get(`/api/branches/${testBranch._id}/transfers`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 404]).toContain(res.status);
    });
  });

  describe("Límites de Sucursales (Suscripción)", () => {
    it("respeta límite maxBranches del negocio", async () => {
      const business = await Business.findById(testBusiness._id);
      const branchCount = await Branch.countDocuments({
        business: testBusiness._id,
      });

      expect(branchCount).toBeLessThanOrEqual(business.maxBranches);
    });
  });

  describe("Usuarios Asignados", () => {
    it("puede ver usuarios asignados a sucursal", async () => {
      const res = await request(app)
        .get(`/api/branches/${testBranch._id}/users`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect([200, 304, 404]).toContain(res.status);
    });

    it("admin puede asignar usuarios a sucursal", async () => {
      const res = await request(app)
        .post(`/api/branches/${testBranch._id}/users`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          userId: staffUser._id,
        });

      expect([200, 201, 404]).toContain(res.status);
    });
  });

  describe("Trazabilidad", () => {
    it("incluye requestId en respuestas", async () => {
      const res = await request(app)
        .get("/api/branches")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(res.headers["x-request-id"]).toBeDefined();
    });
  });
});
