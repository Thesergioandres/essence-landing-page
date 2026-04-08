import { jest } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import {
  createCustomer,
  deleteCustomer,
  getCustomerById,
  listCustomers,
  updateCustomer,
} from "../../controllers/customer.controller.js";
import Business from "../../models/Business.js";
import Customer from "../../models/Customer.js";
import Segment from "../../models/Segment.js";
import User from "../../src/infrastructure/database/models/User.js";

let mongoServer;
let testBusiness;
let testUser;
let testSegment;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
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

  // Crear datos de prueba
  testUser = await User.create({
    name: "Admin Test",
    email: "admin@test.com",
    password: "password123",
    role: "admin",
  });

  testBusiness = await Business.create({
    name: "Negocio Test",
    owner: testUser._id,
    createdBy: testUser._id,
    slug: "negocio-test",
  });

  testSegment = await Segment.create({
    business: testBusiness._id,
    name: "VIP",
    key: "vip",
    description: "Clientes VIP",
  });
});

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
    _id: testUser._id,
    name: testUser.name,
    email: testUser.email,
    role: testUser.role,
  },
  reqId: `test-${Date.now()}`,
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("Customer Controller - createCustomer", () => {
  it("Debe crear un cliente correctamente", async () => {
    const req = mockRequest({
      name: "Juan Pérez",
      email: "juan@test.com",
      phone: "3001234567",
    });
    const res = mockResponse();

    await createCustomer(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalled();

    const responseData = res.json.mock.calls[0][0];
    expect(responseData.customer.name).toBe("Juan Pérez");
    expect(responseData.customer.email).toBe("juan@test.com");
    expect(responseData.customer.phone).toBe("3001234567");

    // Verificar que se guardó en BD
    const customer = await Customer.findById(responseData.customer._id);
    expect(customer).toBeTruthy();
    expect(customer.name).toBe("Juan Pérez");
  });

  it("Debe rechazar cliente sin nombre", async () => {
    const req = mockRequest({
      email: "sinNombre@test.com",
    });
    const res = mockResponse();

    await createCustomer(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "El nombre es obligatorio" })
    );
  });

  it("Debe rechazar email duplicado en el mismo negocio", async () => {
    // Crear primer cliente
    await Customer.create({
      business: testBusiness._id,
      name: "Cliente Original",
      email: "duplicado@test.com",
    });

    const req = mockRequest({
      name: "Cliente Nuevo",
      email: "duplicado@test.com",
    });
    const res = mockResponse();

    await createCustomer(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "El email ya está registrado" })
    );
  });

  it("Debe crear cliente con segmento válido", async () => {
    const req = mockRequest({
      name: "Cliente VIP",
      email: "vip@test.com",
      segment: testSegment._id.toString(),
    });
    const res = mockResponse();

    await createCustomer(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.customer.segment.toString()).toBe(
      testSegment._id.toString()
    );
  });

  it("Debe rechazar segmento inválido", async () => {
    const fakeSegmentId = new mongoose.Types.ObjectId();
    const req = mockRequest({
      name: "Cliente con segmento inválido",
      segment: fakeSegmentId.toString(),
    });
    const res = mockResponse();

    await createCustomer(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Segmento inválido" })
    );
  });

  it("Debe normalizar email a minúsculas", async () => {
    const req = mockRequest({
      name: "Cliente Email",
      email: "MAYUSCULAS@TEST.COM",
    });
    const res = mockResponse();

    await createCustomer(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.customer.email).toBe("mayusculas@test.com");
  });
});

describe("Customer Controller - listCustomers", () => {
  beforeEach(async () => {
    // Crear varios clientes de prueba
    await Customer.insertMany([
      {
        business: testBusiness._id,
        name: "Cliente A",
        email: "a@test.com",
        phone: "3001111111",
      },
      {
        business: testBusiness._id,
        name: "Cliente B",
        email: "b@test.com",
        phone: "3002222222",
      },
      {
        business: testBusiness._id,
        name: "Cliente C",
        email: "c@test.com",
        phone: "3003333333",
      },
    ]);
  });

  it("Debe listar todos los clientes del negocio", async () => {
    const req = mockRequest();
    const res = mockResponse();

    await listCustomers(req, res);

    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.customers).toHaveLength(3);
  });

  it("Debe filtrar clientes por búsqueda", async () => {
    const req = mockRequest({}, {}, { search: "Cliente A" });
    const res = mockResponse();

    await listCustomers(req, res);

    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.customers.length).toBeGreaterThanOrEqual(1);
    expect(responseData.customers[0].name).toContain("Cliente A");
  });

  it("Debe paginar resultados correctamente", async () => {
    const req = mockRequest({}, {}, { page: 1, limit: 2 });
    const res = mockResponse();

    await listCustomers(req, res);

    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.customers).toHaveLength(2);
    expect(responseData.pagination.total).toBe(3);
    expect(responseData.pagination.pages).toBe(2);
  });
});

describe("Customer Controller - getCustomerById", () => {
  let customer;

  beforeEach(async () => {
    customer = await Customer.create({
      business: testBusiness._id,
      name: "Cliente Detalle",
      email: "detalle@test.com",
      phone: "3004444444",
    });
  });

  it("Debe obtener un cliente por ID", async () => {
    const req = mockRequest({}, { id: customer._id.toString() });
    const res = mockResponse();

    await getCustomerById(req, res);

    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.customer._id.toString()).toBe(customer._id.toString());
    expect(responseData.customer.name).toBe("Cliente Detalle");
  });

  it("Debe retornar 404 para cliente inexistente", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const req = mockRequest({}, { id: fakeId.toString() });
    const res = mockResponse();

    await getCustomerById(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});

describe("Customer Controller - updateCustomer", () => {
  let customer;

  beforeEach(async () => {
    customer = await Customer.create({
      business: testBusiness._id,
      name: "Cliente Original",
      email: "original@test.com",
      phone: "3005555555",
    });
  });

  it("Debe actualizar un cliente correctamente", async () => {
    const req = mockRequest(
      { name: "Cliente Actualizado", email: "actualizado@test.com" },
      { id: customer._id.toString() }
    );
    const res = mockResponse();

    await updateCustomer(req, res);

    expect(res.json).toHaveBeenCalled();
    const responseData = res.json.mock.calls[0][0];
    expect(responseData.customer.name).toBe("Cliente Actualizado");
    expect(responseData.customer.email).toBe("actualizado@test.com");
  });

  it("Debe rechazar actualización con email duplicado", async () => {
    // Crear otro cliente
    await Customer.create({
      business: testBusiness._id,
      name: "Otro Cliente",
      email: "otro@test.com",
      phone: "3006666666",
    });

    const req = mockRequest(
      { email: "otro@test.com" },
      { id: customer._id.toString() }
    );
    const res = mockResponse();

    await updateCustomer(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
  });
});

describe("Customer Controller - deleteCustomer", () => {
  let customer;

  beforeEach(async () => {
    customer = await Customer.create({
      business: testBusiness._id,
      name: "Cliente a Eliminar",
      email: "eliminar@test.com",
      phone: "3007777777",
    });
  });

  it("Debe eliminar un cliente correctamente", async () => {
    const req = mockRequest({}, { id: customer._id.toString() });
    const res = mockResponse();

    await deleteCustomer(req, res);

    expect(res.json).toHaveBeenCalled();

    // Verificar que se eliminó
    const deleted = await Customer.findById(customer._id);
    expect(deleted).toBeNull();
  });

  it("Debe retornar 404 al eliminar cliente inexistente", async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const req = mockRequest({}, { id: fakeId.toString() });
    const res = mockResponse();

    await deleteCustomer(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
