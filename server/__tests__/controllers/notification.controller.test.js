/**
 * Tests para el controlador de notificaciones
 * Patrón: Import dinámico después de establecer MONGODB_URI
 */

// Establecer MONGODB_URI antes de cualquier import
import { MongoMemoryServer } from "mongodb-memory-server";
const mongoServer = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongoServer.getUri();

// Ahora sí importar módulos que usan mongoose
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";

// Import dinámico de la app y modelos
const { default: app } = await import("../../server.js");
const { default: User } = await import("../../src/infrastructure/database/models/User.js");
const { default: Business } = await import("../../models/Business.js");
const { default: Notification } = await import("../../models/Notification.js");
const { default: Membership } = await import("../../models/Membership.js");

// Variables de test
let adminToken;
let testUser;
let testBusiness;

// Conectar a la base de datos de memoria
beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

beforeEach(async () => {
  // Limpiar colecciones
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }

  // Crear usuario admin de prueba con password hasheado
  const hashedPassword = await bcrypt.hash("password123", 10);
  testUser = await User.create({
    name: "Admin Notifications",
    email: "admin.notifications@test.com",
    password: hashedPassword,
    role: "admin",
    status: "active",
    active: true,
  });

  // Crear negocio de prueba
  testBusiness = await Business.create({
    name: "Test Business Notifications",
    owner: testUser._id,
    createdBy: testUser._id,
    slug: "test-notifications",
    status: "active",
  });

  // Crear membership
  await Membership.create({
    user: testUser._id,
    business: testBusiness._id,
    role: "admin",
    status: "active",
  });

  // Login para obtener token
  const login = await request(app)
    .post("/api/auth/login")
    .send({ email: "admin.notifications@test.com", password: "password123" })
    .expect(200);
  adminToken = login.body.token;
});

describe("Notification Controller", () => {
  describe("GET /api/notifications", () => {
    beforeEach(async () => {
      // Crear notificaciones de prueba
      await Notification.create([
        {
          business: testBusiness._id,
          user: testUser._id,
          type: "sale",
          title: "Nueva venta",
          message: "Se registró una venta",
          priority: "medium",
          read: false,
        },
        {
          business: testBusiness._id,
          targetRole: "admin",
          type: "low_stock",
          title: "Stock bajo",
          message: "Producto con stock bajo",
          priority: "high",
          read: true,
        },
        {
          business: testBusiness._id,
          targetRole: "all",
          type: "system",
          title: "Actualización",
          message: "Sistema actualizado",
          priority: "low",
          read: false,
        },
      ]);
    });

    it("debe obtener notificaciones del usuario", async () => {
      const res = await request(app)
        .get("/api/notifications")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.notifications).toBeDefined();
      expect(res.body.unreadCount).toBeDefined();
    });

    it("debe filtrar por no leídas", async () => {
      const res = await request(app)
        .get("/api/notifications?read=false")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.notifications.every((n) => !n.read)).toBe(true);
    });
  });

  describe("GET /api/notifications/unread-count", () => {
    beforeEach(async () => {
      await Notification.create([
        {
          business: testBusiness._id,
          user: testUser._id,
          type: "sale",
          title: "Notif 1",
          message: "Mensaje 1",
          read: false,
        },
        {
          business: testBusiness._id,
          user: testUser._id,
          type: "sale",
          title: "Notif 2",
          message: "Mensaje 2",
          read: false,
        },
        {
          business: testBusiness._id,
          user: testUser._id,
          type: "sale",
          title: "Notif 3",
          message: "Mensaje 3",
          read: true,
        },
      ]);
    });

    it("debe retornar el contador de no leídas", async () => {
      const res = await request(app)
        .get("/api/notifications/unread-count")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.unreadCount).toBe(2);
    });
  });

  describe("PATCH /api/notifications/:id/read", () => {
    let testNotification;

    beforeEach(async () => {
      testNotification = await Notification.create({
        business: testBusiness._id,
        user: testUser._id,
        type: "sale",
        title: "Test",
        message: "Test message",
        read: false,
      });
    });

    it("debe marcar como leída", async () => {
      const res = await request(app)
        .patch(`/api/notifications/${testNotification._id}/read`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.notification.read).toBe(true);
      expect(res.body.notification.readAt).toBeDefined();
    });
  });

  describe("POST /api/notifications/read-all", () => {
    beforeEach(async () => {
      await Notification.create([
        {
          business: testBusiness._id,
          user: testUser._id,
          type: "sale",
          title: "N1",
          message: "M1",
          read: false,
        },
        {
          business: testBusiness._id,
          user: testUser._id,
          type: "sale",
          title: "N2",
          message: "M2",
          read: false,
        },
      ]);
    });

    it("debe marcar todas como leídas", async () => {
      const res = await request(app)
        .post("/api/notifications/read-all")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(res.status).toBe(200);
      expect(res.body.modifiedCount).toBe(2);

      // Verificar en DB
      const unread = await Notification.countDocuments({
        business: testBusiness._id,
        read: false,
      });
      expect(unread).toBe(0);
    });
  });

  describe("POST /api/notifications (crear)", () => {
    it("debe crear una notificación (admin)", async () => {
      const res = await request(app)
        .post("/api/notifications")
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString())
        .send({
          type: "system",
          title: "Notificación de prueba",
          message: "Mensaje de prueba",
          priority: "high",
          targetRole: "all",
        });

      expect(res.status).toBe(201);
      expect(res.body.notification).toBeDefined();
      expect(res.body.notification.title).toBe("Notificación de prueba");
    });
  });

  describe("DELETE /api/notifications/:id", () => {
    let testNotification;

    beforeEach(async () => {
      testNotification = await Notification.create({
        business: testBusiness._id,
        user: testUser._id,
        type: "sale",
        title: "Para eliminar",
        message: "Mensaje",
        read: false,
      });
    });

    it("debe eliminar una notificación", async () => {
      const res = await request(app)
        .delete(`/api/notifications/${testNotification._id}`)
        .set("Authorization", `Bearer ${adminToken}`)
        .set("x-business-id", testBusiness._id.toString());

      expect(res.status).toBe(200);

      const exists = await Notification.findById(testNotification._id);
      expect(exists).toBeNull();
    });
  });
});
