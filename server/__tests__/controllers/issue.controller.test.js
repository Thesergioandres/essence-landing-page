/**
 * Tests para el controlador de incidencias/issues
 * Patrón: Import dinámico después de establecer MONGODB_URI
 */

// Establecer MONGODB_URI antes de cualquier import
import { MongoMemoryServer } from "mongodb-memory-server";
const mongoServer = await MongoMemoryServer.create();
process.env.MONGODB_URI = mongoServer.getUri();

// Ahora sí importar módulos que usan mongoose
import { jest } from "@jest/globals";
import mongoose from "mongoose";
import {
  createIssue,
  deleteIssue,
  listIssues,
  updateIssueStatus,
} from "../../controllers/issue.controller.js";
import Business from "../../models/Business.js";
import IssueReport from "../../models/IssueReport.js";
import User from "../../src/infrastructure/database/models/User.js";

// Variables de test
let testBusiness;
let testAdmin;
let testUser;

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

  // Crear usuario admin de prueba
  testAdmin = await User.create({
    name: "Admin Test",
    email: "admin@test.com",
    password: "password123",
    role: "admin",
  });

  // Crear usuario normal de prueba
  testUser = await User.create({
    name: "Usuario Test",
    email: "user@test.com",
    password: "password123",
    role: "distribuidor",
  });

  // Crear negocio de prueba
  testBusiness = await Business.create({
    name: "Negocio Test",
    owner: testAdmin._id,
    createdBy: testAdmin._id,
    slug: "negocio-test",
  });
});

// Helper para crear mock de request
const mockRequest = (body = {}, params = {}, query = {}, user = null) => ({
  body,
  params,
  query,
  user: user || {
    id: testUser._id,
    _id: testUser._id,
    name: testUser.name,
    role: testUser.role,
  },
  reqId: `test-${Date.now()}`,
});

// Helper para crear mock de response
const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("Issue Controller - createIssue", () => {
  it("Debe crear un reporte de incidencia correctamente", async () => {
    const req = mockRequest({
      message: "Error al cargar productos",
      stackTrace: "Error: Failed to fetch at line 42",
      logs: ["[INFO] Loading products", "[ERROR] Network error"],
      clientContext: {
        url: "/products",
        userAgent: "Mozilla/5.0",
        appVersion: "1.0.0",
        businessId: testBusiness._id.toString(),
      },
    });
    const res = mockResponse();

    await createIssue(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalled();

    const responseData = res.json.mock.calls[0][0];
    expect(responseData.report).toBeDefined();
    expect(responseData.report.message).toBe("Error al cargar productos");
    expect(responseData.report.status).toBe("open");
  });

  it("Debe rechazar reporte sin mensaje", async () => {
    const req = mockRequest({
      stackTrace: "Error stack",
    });
    const res = mockResponse();

    await createIssue(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "El mensaje es obligatorio" })
    );
  });

  it("Debe rechazar mensaje vacío", async () => {
    const req = mockRequest({
      message: "   ",
    });
    const res = mockResponse();

    await createIssue(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("Debe aceptar logs como string", async () => {
    const req = mockRequest({
      message: "Error de prueba",
      logs: "Log único como string",
    });
    const res = mockResponse();

    await createIssue(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.report.logs).toContain("Log único como string");
  });

  it("Debe crear reporte con screenshot URL", async () => {
    const req = mockRequest({
      message: "Error con captura",
      screenshotUrl: "https://cloudinary.com/image.png",
      screenshotPublicId: "issue_123",
    });
    const res = mockResponse();

    await createIssue(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.report.screenshotUrl).toBe(
      "https://cloudinary.com/image.png"
    );
  });
});

describe("Issue Controller - listIssues", () => {
  beforeEach(async () => {
    await IssueReport.insertMany([
      {
        user: testUser._id,
        role: "distribuidor",
        message: "Error A",
        status: "open",
      },
      {
        user: testUser._id,
        role: "distribuidor",
        message: "Error B",
        status: "reviewing",
      },
      {
        user: testAdmin._id,
        role: "admin",
        message: "Error C",
        status: "closed",
      },
    ]);
  });

  it("Debe listar todas las incidencias", async () => {
    const req = mockRequest({}, {}, {}, { id: testAdmin._id, role: "admin" });
    const res = mockResponse();

    await listIssues(req, res);

    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    // El controlador retorna data y pagination
    expect(responseData.data).toHaveLength(3);
    expect(responseData.pagination.total).toBe(3);
  });

  it("Debe filtrar por estado", async () => {
    const req = mockRequest(
      {},
      {},
      { status: "open" },
      { id: testAdmin._id, role: "admin" }
    );
    const res = mockResponse();

    await listIssues(req, res);

    const responseData = res.json.mock.calls[0][0];
    expect(responseData.data).toHaveLength(1);
    expect(responseData.data[0].status).toBe("open");
  });

  it("Debe paginar correctamente", async () => {
    const req = mockRequest(
      {},
      {},
      { page: 1, limit: 2 },
      { id: testAdmin._id, role: "admin" }
    );
    const res = mockResponse();

    await listIssues(req, res);

    const responseData = res.json.mock.calls[0][0];
    expect(responseData.data).toHaveLength(2);
    expect(responseData.pagination.total).toBe(3);
    expect(responseData.pagination.pages).toBe(2);
  });

  it("Debe ordenar por fecha descendente (más reciente primero)", async () => {
    const req = mockRequest({}, {}, {}, { id: testAdmin._id, role: "admin" });
    const res = mockResponse();

    await listIssues(req, res);

    const responseData = res.json.mock.calls[0][0];
    const dates = responseData.data.map((r) => new Date(r.createdAt).getTime());
    for (let i = 0; i < dates.length - 1; i++) {
      expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1]);
    }
  });
});

describe("Issue Controller - updateIssueStatus", () => {
  let issue;

  beforeEach(async () => {
    issue = await IssueReport.create({
      user: testUser._id,
      role: "distribuidor",
      message: "Error a revisar",
      status: "open",
    });
  });

  it("Debe actualizar el estado de una incidencia", async () => {
    const req = mockRequest(
      { status: "reviewing" },
      { id: issue._id.toString() },
      {},
      { id: testAdmin._id, role: "admin" }
    );
    const res = mockResponse();

    await updateIssueStatus(req, res);

    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.report.status).toBe("reviewing");

    // Verificar en BD
    const updated = await IssueReport.findById(issue._id);
    expect(updated.status).toBe("reviewing");
  });

  it("Debe rechazar estado inválido", async () => {
    const req = mockRequest(
      { status: "invalid_status" },
      { id: issue._id.toString() },
      {},
      { id: testAdmin._id, role: "admin" }
    );
    const res = mockResponse();

    await updateIssueStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("Debe retornar 404 para incidencia inexistente", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const req = mockRequest(
      { status: "closed" },
      { id: fakeId.toString() },
      {},
      { id: testAdmin._id, role: "admin" }
    );
    const res = mockResponse();

    await updateIssueStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("Issue Controller - deleteIssue", () => {
  let issue;

  beforeEach(async () => {
    issue = await IssueReport.create({
      user: testUser._id,
      role: "distribuidor",
      message: "Error a eliminar",
      status: "closed",
    });
  });

  it("Debe eliminar una incidencia", async () => {
    const req = mockRequest(
      {},
      { id: issue._id.toString() },
      {},
      { id: testAdmin._id, role: "admin" }
    );
    const res = mockResponse();

    await deleteIssue(req, res);

    expect(res.json).toHaveBeenCalled();

    // Verificar eliminación
    const deleted = await IssueReport.findById(issue._id);
    expect(deleted).toBeNull();
  });

  it("Debe retornar 404 al eliminar incidencia inexistente", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const req = mockRequest(
      {},
      { id: fakeId.toString() },
      {},
      { id: testAdmin._id, role: "admin" }
    );
    const res = mockResponse();

    await deleteIssue(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
