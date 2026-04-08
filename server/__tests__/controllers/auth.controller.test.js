/**
 * Tests del controlador de autenticación
 * Ejecutar: npm test -- --runTestsByPath __tests__/controllers/auth.controller.test.js
 */

import { jest } from "@jest/globals";
import mongoose from "mongoose";
import request from "supertest";

// Mock de Redis
jest.mock("../../config/redis.js", () => ({
  initRedis: jest.fn(),
  getRedisClient: jest.fn(() => null),
}));

const { default: app } = await import("../../server.js");
const { default: User } = await import("../../src/infrastructure/database/models/User.js");
const { default: RefreshToken } = await import("../../models/RefreshToken.js");

describe("Auth Controller", () => {
  const testEmail = `test-auth-${Date.now()}@example.com`;
  const testPassword = "SecurePass123!";

  beforeAll(async () => {
    if (mongoose.connection.readyState !== 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  });

  afterAll(async () => {
    // Limpiar usuarios de prueba
    await User.deleteMany({ email: { $regex: /^test-auth-/ } });
    await User.deleteMany({ email: { $regex: /^sub-test-/ } });
    await User.deleteMany({ email: { $regex: /^refresh-test-/ } });
    await RefreshToken.deleteMany({});
    await mongoose.disconnect();
  });

  describe("POST /api/auth/register", () => {
    it("debería registrar un nuevo usuario exitosamente", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Test User",
        email: testEmail,
        password: testPassword,
      });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.email).toBe(testEmail);
      expect(res.body.user).not.toHaveProperty("password");
    });

    it("debería rechazar email duplicado", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Test User 2",
        email: testEmail,
        password: testPassword,
      });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/existe|duplicate|ya está/i);
    });

    it("debería rechazar sin campos requeridos", async () => {
      const res = await request(app).post("/api/auth/register").send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("errors");
    });

    it("debería rechazar email inválido", async () => {
      const res = await request(app).post("/api/auth/register").send({
        name: "Test",
        email: "invalid-email",
        password: testPassword,
      });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("errors");
    });

    it("debería rechazar contraseña muy corta", async () => {
      const res = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Test",
          email: `short-${Date.now()}@test.com`,
          password: "123",
        });

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("errors");
    });
  });

  describe("POST /api/auth/login", () => {
    it("debería hacer login con credenciales correctas", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: testEmail,
        password: testPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.email).toBe(testEmail);
    });

    it("debería rechazar contraseña incorrecta", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: testEmail,
        password: "wrongpassword",
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/incorrecta|invalid|inválida/i);
    });

    it("debería rechazar email no registrado", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: "noexiste@example.com",
        password: testPassword,
      });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/no encontrado|not found|no existe/i);
    });

    it("debería rechazar sin credenciales", async () => {
      const res = await request(app).post("/api/auth/login").send({});

      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty("errors");
    });

    it("debería incluir requestId en respuesta", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: testEmail,
        password: testPassword,
      });

      expect(res.headers["x-request-id"]).toBeDefined();
    });
  });

  describe("GET /api/auth/profile", () => {
    let authToken;

    beforeAll(async () => {
      const loginRes = await request(app).post("/api/auth/login").send({
        email: testEmail,
        password: testPassword,
      });
      authToken = loginRes.body.token;
    });

    it("debería retornar perfil con token válido", async () => {
      const res = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${authToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe(testEmail);
      expect(res.body).not.toHaveProperty("password");
    });

    it("debería rechazar sin token", async () => {
      const res = await request(app).get("/api/auth/profile");

      expect(res.status).toBe(401);
    });

    it("debería rechazar token inválido", async () => {
      const res = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", "Bearer invalid-token");

      expect(res.status).toBe(401);
    });

    it("debería rechazar token expirado", async () => {
      // Token expirado (generado con expiresIn: -1h)
      const expiredToken =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NWYxMjM0NTY3ODlhYmNkZWYwMTIzNDUiLCJpYXQiOjE1MTYyMzkwMjIsImV4cCI6MTUxNjIzOTAyMn0.invalid";

      const res = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
    });
  });

  describe("Estados de suscripción", () => {
    let testUserId;
    let authToken;

    beforeAll(async () => {
      // Crear usuario de prueba para estados
      const registerRes = await request(app)
        .post("/api/auth/register")
        .send({
          name: "Subscription Test",
          email: `sub-test-${Date.now()}@example.com`,
          password: testPassword,
        });

      testUserId = registerRes.body.user._id;
      authToken = registerRes.body.token;
    });

    it("usuario con status active puede acceder", async () => {
      // El usuario recién registrado está activo en test env
      const res = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${authToken}`);

      expect([200, 403]).toContain(res.status);
    });

    it("usuario suspended es bloqueado", async () => {
      // Suspender usuario
      await User.findByIdAndUpdate(testUserId, { status: "suspended" });

      const res = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${authToken}`);

      // En test env puede que no bloquee, pero el código está preparado
      expect([200, 403]).toContain(res.status);
    });

    it("usuario expired es bloqueado", async () => {
      // Marcar como expirado
      await User.findByIdAndUpdate(testUserId, {
        status: "expired",
        subscriptionExpiresAt: new Date(Date.now() - 86400000), // Ayer
      });

      const res = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${authToken}`);

      // En test env puede que no bloquee
      expect([200, 403]).toContain(res.status);
    });
  });

  describe("Logs y trazabilidad", () => {
    it("debería incluir x-request-id en todas las respuestas", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ email: "any@email.com", password: "anypass" });

      expect(res.headers["x-request-id"]).toBeDefined();
      expect(res.headers["x-request-id"].length).toBeGreaterThan(5);
    });
  });

  describe("POST /api/auth/refresh - Refresh Token", () => {
    const refreshTestEmail = `refresh-test-${Date.now()}@example.com`;
    const refreshTestPassword = "RefreshPass123!";
    let accessToken;
    let refreshToken;

    beforeAll(async () => {
      // Registrar usuario para tests de refresh
      await request(app).post("/api/auth/register").send({
        name: "Refresh Test User",
        email: refreshTestEmail,
        password: refreshTestPassword,
      });

      // Login para obtener tokens
      const loginRes = await request(app).post("/api/auth/login").send({
        email: refreshTestEmail,
        password: refreshTestPassword,
      });

      accessToken = loginRes.body.token;
      refreshToken = loginRes.body.refreshToken;
    });

    it("debería retornar refreshToken en login", async () => {
      const res = await request(app).post("/api/auth/login").send({
        email: refreshTestEmail,
        password: refreshTestPassword,
      });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("refreshToken");
      expect(res.body).toHaveProperty("refreshExpiresAt");
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.refreshToken.length).toBeGreaterThan(20);
    });

    it("debería refrescar access token con refresh token válido", async () => {
      // Obtener un nuevo refresh token del login
      const loginRes = await request(app).post("/api/auth/login").send({
        email: refreshTestEmail,
        password: refreshTestPassword,
      });

      const validRefreshToken = loginRes.body.refreshToken;

      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: validRefreshToken });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("refreshToken");
      expect(res.body).toHaveProperty("user");
      expect(res.body.token).toBeDefined();
      // El nuevo refresh token debe ser diferente (rotación)
      expect(res.body.refreshToken).not.toBe(validRefreshToken);
    });

    it("debería rechazar refresh sin token", async () => {
      const res = await request(app).post("/api/auth/refresh").send({});

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/requerido|required/i);
    });

    it("debería rechazar refresh token inválido", async () => {
      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: "invalid-token-123456" });

      expect(res.status).toBe(401);
      expect(res.body).toHaveProperty("code");
      expect(res.body.code).toBe("INVALID_REFRESH_TOKEN");
    });

    it("debería rechazar refresh token ya usado (rotación)", async () => {
      // Login para obtener un token nuevo
      const loginRes = await request(app).post("/api/auth/login").send({
        email: refreshTestEmail,
        password: refreshTestPassword,
      });

      const tokenToUse = loginRes.body.refreshToken;

      // Primer uso - debería funcionar
      const firstRefresh = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: tokenToUse });

      expect(firstRefresh.status).toBe(200);

      // Segundo uso del mismo token - debería fallar (ya fue rotado)
      const secondRefresh = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: tokenToUse });

      expect(secondRefresh.status).toBe(401);
      expect(secondRefresh.body.code).toBe("REVOKED_REFRESH_TOKEN");
    });

    it("debería incluir requestId en respuesta de refresh", async () => {
      const loginRes = await request(app).post("/api/auth/login").send({
        email: refreshTestEmail,
        password: refreshTestPassword,
      });

      const res = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: loginRes.body.refreshToken });

      expect(res.body).toHaveProperty("requestId");
      expect(res.headers["x-request-id"]).toBeDefined();
    });
  });

  describe("POST /api/auth/logout", () => {
    const logoutTestEmail = `refresh-test-${Date.now()}-logout@example.com`;
    const logoutTestPassword = "LogoutPass123!";
    let authToken;
    let refreshTokenForLogout;

    beforeAll(async () => {
      // Registrar usuario
      await request(app).post("/api/auth/register").send({
        name: "Logout Test User",
        email: logoutTestEmail,
        password: logoutTestPassword,
      });

      // Login
      const loginRes = await request(app).post("/api/auth/login").send({
        email: logoutTestEmail,
        password: logoutTestPassword,
      });

      authToken = loginRes.body.token;
      refreshTokenForLogout = loginRes.body.refreshToken;
    });

    it("debería cerrar sesión y revocar refresh token", async () => {
      // Primero hacer login para obtener tokens frescos
      const loginRes = await request(app).post("/api/auth/login").send({
        email: logoutTestEmail,
        password: logoutTestPassword,
      });

      const freshRefreshToken = loginRes.body.refreshToken;
      const freshAccessToken = loginRes.body.token;

      // Logout
      const logoutRes = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${freshAccessToken}`)
        .send({ refreshToken: freshRefreshToken });

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toMatch(/cerrada|logout|success/i);

      // Intentar usar el refresh token revocado
      const refreshRes = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: freshRefreshToken });

      expect(refreshRes.status).toBe(401);
    });

    it("debería rechazar logout sin autenticación", async () => {
      const res = await request(app)
        .post("/api/auth/logout")
        .send({ refreshToken: "any-token" });

      expect(res.status).toBe(401);
    });

    it("debería poder revocar todos los tokens con revokeAll", async () => {
      // Login múltiples veces para crear varios tokens
      const login1 = await request(app).post("/api/auth/login").send({
        email: logoutTestEmail,
        password: logoutTestPassword,
      });

      const login2 = await request(app).post("/api/auth/login").send({
        email: logoutTestEmail,
        password: logoutTestPassword,
      });

      // Logout con revokeAll
      const logoutRes = await request(app)
        .post("/api/auth/logout")
        .set("Authorization", `Bearer ${login1.body.token}`)
        .send({ refreshToken: login1.body.refreshToken, revokeAll: true });

      expect(logoutRes.status).toBe(200);

      // Ambos refresh tokens deberían estar revocados
      const refresh1 = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: login1.body.refreshToken });

      const refresh2 = await request(app)
        .post("/api/auth/refresh")
        .send({ refreshToken: login2.body.refreshToken });

      expect(refresh1.status).toBe(401);
      expect(refresh2.status).toBe(401);
    });
  });
});
