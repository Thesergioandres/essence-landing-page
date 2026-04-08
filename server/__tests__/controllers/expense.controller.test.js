/**
 * Tests para el controlador de gastos/expenses
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
  createExpense,
  deleteExpense,
  getExpenseById,
  getExpenses,
  updateExpense,
} from "../../controllers/expense.controller.js";
import Business from "../../models/Business.js";
import Expense from "../../models/Expense.js";
import User from "../../src/infrastructure/database/models/User.js";

// Variables de test
let testBusiness;
let testAdmin;

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

  // Crear negocio de prueba con createdBy
  testBusiness = await Business.create({
    name: "Negocio Test",
    owner: testAdmin._id,
    createdBy: testAdmin._id,
    slug: "negocio-test",
  });
});

// Helper para crear mock de request
const mockRequest = (
  body = {},
  params = {},
  query = {},
  businessId = null
) => ({
  body,
  params,
  query,
  businessId: businessId || testBusiness._id.toString(),
  headers: { "x-business-id": businessId || testBusiness._id.toString() },
  user: {
    id: testAdmin._id,
    _id: testAdmin._id,
    name: testAdmin.name,
    role: testAdmin.role,
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

describe("Expense Controller - createExpense", () => {
  it("Debe crear un gasto correctamente", async () => {
    const req = mockRequest({
      type: "Insumos",
      amount: 50000,
      description: "Compra de materiales",
    });
    const res = mockResponse();

    await createExpense(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalled();

    const responseData = res.json.mock.calls[0][0];
    expect(responseData.expense).toBeDefined();
    expect(responseData.expense.type).toBe("Insumos");
    expect(responseData.expense.amount).toBe(50000);
  });

  it("Debe rechazar gasto sin tipo", async () => {
    const req = mockRequest({
      amount: 50000,
    });
    const res = mockResponse();

    await createExpense(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "El tipo de gasto es obligatorio" })
    );
  });

  it("Debe rechazar monto inválido", async () => {
    const req = mockRequest({
      type: "Insumos",
      amount: -100,
    });
    const res = mockResponse();

    await createExpense(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "El monto es inválido" })
    );
  });

  it("Debe aceptar monto 0", async () => {
    const req = mockRequest({
      type: "Ajuste",
      amount: 0,
      description: "Ajuste de cuentas",
    });
    const res = mockResponse();

    await createExpense(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("Debe usar categoría como tipo si type no existe", async () => {
    const req = mockRequest({
      category: "Servicios",
      amount: 25000,
    });
    const res = mockResponse();

    await createExpense(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.expense.type).toBe("Servicios");
  });
});

describe("Expense Controller - getExpenses", () => {
  beforeEach(async () => {
    const today = new Date();
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    await Expense.insertMany([
      {
        business: testBusiness._id,
        type: "Insumos",
        amount: 10000,
        description: "Gasto A",
        createdBy: testAdmin._id,
        expenseDate: today,
      },
      {
        business: testBusiness._id,
        type: "Servicios",
        amount: 20000,
        description: "Gasto B",
        createdBy: testAdmin._id,
        expenseDate: today,
      },
      {
        business: testBusiness._id,
        type: "Insumos",
        amount: 5000,
        description: "Gasto C",
        createdBy: testAdmin._id,
        expenseDate: lastMonth,
      },
    ]);
  });

  it("Debe listar todos los gastos del negocio", async () => {
    const req = mockRequest();
    const res = mockResponse();

    await getExpenses(req, res);

    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.expenses).toHaveLength(3);
  });

  it("Debe filtrar por tipo de gasto", async () => {
    const req = mockRequest({}, {}, { type: "Insumos" });
    const res = mockResponse();

    await getExpenses(req, res);

    const responseData = res.json.mock.calls[0][0];
    expect(responseData.expenses).toHaveLength(2);
    expect(responseData.expenses.every((e) => e.type === "Insumos")).toBe(true);
  });

  it("Debe filtrar por rango de fechas", async () => {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

    const req = mockRequest(
      {},
      {},
      {
        startDate: startOfMonth.toISOString().slice(0, 10),
        endDate: endOfMonth.toISOString().slice(0, 10),
      }
    );
    const res = mockResponse();

    await getExpenses(req, res);

    const responseData = res.json.mock.calls[0][0];
    expect(responseData.expenses.length).toBeGreaterThanOrEqual(2);
  });

  it("Debe retornar array de gastos con campos poblados", async () => {
    const req = mockRequest();
    const res = mockResponse();

    await getExpenses(req, res);

    const responseData = res.json.mock.calls[0][0];
    expect(responseData.expenses.length).toBe(3);
    // Verificar que createdBy está poblado
    expect(responseData.expenses[0].createdBy).toBeDefined();
  });
});

describe("Expense Controller - getExpenseById", () => {
  let expense;

  beforeEach(async () => {
    expense = await Expense.create({
      business: testBusiness._id,
      type: "Transporte",
      amount: 15000,
      description: "Envío de productos",
      createdBy: testAdmin._id,
    });
  });

  it("Debe obtener un gasto por ID", async () => {
    const req = mockRequest({}, { id: expense._id.toString() });
    const res = mockResponse();

    await getExpenseById(req, res);

    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.expense).toBeDefined();
    expect(responseData.expense._id.toString()).toBe(expense._id.toString());
    expect(responseData.expense.type).toBe("Transporte");
  });

  it("Debe retornar 404 para gasto inexistente", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const req = mockRequest({}, { id: fakeId.toString() });
    const res = mockResponse();

    await getExpenseById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("Expense Controller - updateExpense", () => {
  let expense;

  beforeEach(async () => {
    expense = await Expense.create({
      business: testBusiness._id,
      type: "Insumos",
      amount: 10000,
      description: "Gasto original",
      createdBy: testAdmin._id,
    });
  });

  it("Debe actualizar un gasto correctamente", async () => {
    const req = mockRequest(
      { amount: 15000, description: "Gasto actualizado" },
      { id: expense._id.toString() }
    );
    const res = mockResponse();

    await updateExpense(req, res);

    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.expense.amount).toBe(15000);
    expect(responseData.expense.description).toBe("Gasto actualizado");
  });

  it("Debe rechazar monto negativo en actualización", async () => {
    const req = mockRequest({ amount: -5000 }, { id: expense._id.toString() });
    const res = mockResponse();

    await updateExpense(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});

describe("Expense Controller - deleteExpense", () => {
  let expense;

  beforeEach(async () => {
    expense = await Expense.create({
      business: testBusiness._id,
      type: "Servicios",
      amount: 30000,
      description: "Gasto a eliminar",
      createdBy: testAdmin._id,
    });
  });

  it("Debe eliminar un gasto correctamente", async () => {
    const req = mockRequest({}, { id: expense._id.toString() });
    const res = mockResponse();

    await deleteExpense(req, res);

    expect(res.json).toHaveBeenCalled();

    // Verificar eliminación
    const deleted = await Expense.findById(expense._id);
    expect(deleted).toBeNull();
  });

  it("Debe retornar 404 al eliminar gasto inexistente", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const req = mockRequest({}, { id: fakeId.toString() });
    const res = mockResponse();

    await deleteExpense(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
