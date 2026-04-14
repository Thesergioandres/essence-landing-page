import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import Product from "../../src/infrastructure/database/models/Product.js";
import Sale from "../../src/infrastructure/database/models/Sale.js";
import User from "../../src/infrastructure/database/models/User.js";

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();
  await mongoose.connect(uri);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe("Sale Model - Generación de saleId", () => {
  let product;
  let employee;

  beforeEach(async () => {
    // Crear producto de prueba
    product = await Product.create({
      name: "Producto Test",
      description: "Descripción test",
      purchasePrice: 100,
      employeePrice: 150,
      clientPrice: 200,
      totalStock: 1000,
      category: new mongoose.Types.ObjectId(),
    });

    // Crear employee de prueba
    employee = await User.create({
      name: "Employee Test",
      email: "employee@test.com",
      password: "password123",
      role: "employee",
    });
  });

  test("Debe generar saleId automáticamente con formato SALE-YYYYMMDD-HHMMSS-XXXXXX", async () => {
    const sale = await Sale.create({
      employee: employee._id,
      product: product._id,
      quantity: 5,
      purchasePrice: 100,
      employeePrice: 150,
      salePrice: 200,
      commissionBonus: 5,
      employeeProfitPercentage: 25,
    });

    expect(sale.saleId).toBeDefined();
    expect(sale.saleId).toMatch(/^SALE-\d{8}-\d{6}-[A-Z0-9]{6}$/);

    const year = String(new Date().getFullYear());
    expect(sale.saleId.slice(5, 9)).toBe(year);
  });

  test("Debe generar saleId únicos en ventas consecutivas", async () => {
    const sale1 = await Sale.create({
      employee: employee._id,
      product: product._id,
      quantity: 1,
      purchasePrice: 100,
      employeePrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      employeeProfitPercentage: 20,
    });

    const sale2 = await Sale.create({
      employee: employee._id,
      product: product._id,
      quantity: 1,
      purchasePrice: 100,
      employeePrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      employeeProfitPercentage: 20,
    });

    expect(sale1.saleId).toMatch(/^SALE-\d{8}-\d{6}-[A-Z0-9]{6}$/);
    expect(sale2.saleId).toMatch(/^SALE-\d{8}-\d{6}-[A-Z0-9]{6}$/);
    expect(sale1.saleId).not.toBe(sale2.saleId);
  });
});

describe("Sale Model - Cálculo de ganancias", () => {
  let product;
  let employee;

  beforeEach(async () => {
    product = await Product.create({
      name: "Producto Test",
      description: "Descripción test",
      purchasePrice: 100,
      employeePrice: 150,
      salePrice: 200,
      totalStock: 1000,
      category: new mongoose.Types.ObjectId(),
    });

    employee = await User.create({
      name: "Employee Test",
      email: "employee@test.com",
      password: "password123",
      role: "employee",
    });
  });

  test("Debe calcular correctamente ganancia de employee normal (20%)", async () => {
    const sale = await Sale.create({
      employee: employee._id,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      employeePrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      employeeProfitPercentage: 20,
    });

    // employeeProfit = salePrice * 20% * quantity = 200 * 0.20 * 10 = 400
    expect(sale.employeeProfit).toBe(400);
  });

  test("Debe calcular correctamente ganancia de employee 1er lugar (25%)", async () => {
    const sale = await Sale.create({
      employee: employee._id,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      employeePrice: 150,
      salePrice: 200,
      commissionBonus: 5,
      employeeProfitPercentage: 25,
    });

    // employeeProfit = salePrice * 25% * quantity = 200 * 0.25 * 10 = 500
    expect(sale.employeeProfit).toBe(500);
  });

  test("Debe calcular correctamente ganancia de employee 2do lugar (23%)", async () => {
    const sale = await Sale.create({
      employee: employee._id,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      employeePrice: 150,
      salePrice: 200,
      commissionBonus: 3,
      employeeProfitPercentage: 23,
    });

    // employeeProfit = salePrice * 23% * quantity = 200 * 0.23 * 10 = 460
    expect(sale.employeeProfit).toBe(460);
  });

  test("Debe calcular correctamente ganancia de employee 3er lugar (21%)", async () => {
    const sale = await Sale.create({
      employee: employee._id,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      employeePrice: 150,
      salePrice: 200,
      commissionBonus: 1,
      employeeProfitPercentage: 21,
    });

    // employeeProfit = salePrice * 21% * quantity = 200 * 0.21 * 10 = 420
    expect(sale.employeeProfit).toBe(420);
  });

  test("Debe calcular correctamente ganancia admin con employee normal (20%)", async () => {
    const sale = await Sale.create({
      employee: employee._id,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      employeePrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      employeeProfitPercentage: 20,
    });

    // employeePayment = salePrice * 80% = 200 * 0.80 = 160
    // adminProfit = (employeePayment - purchasePrice) * quantity = (160 - 100) * 10 = 600
    expect(sale.adminProfit).toBe(600);
  });

  test("Debe calcular correctamente ganancia admin con employee 1er lugar (25%)", async () => {
    const sale = await Sale.create({
      employee: employee._id,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      employeePrice: 150,
      salePrice: 200,
      commissionBonus: 5,
      employeeProfitPercentage: 25,
    });

    // employeePayment = salePrice * 75% = 200 * 0.75 = 150
    // adminProfit = (employeePayment - purchasePrice) * quantity = (150 - 100) * 10 = 500
    expect(sale.adminProfit).toBe(500);
  });

  test("Debe calcular correctamente ganancia total (employee + admin)", async () => {
    const sale = await Sale.create({
      employee: employee._id,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      employeePrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      employeeProfitPercentage: 20,
    });

    // totalProfit = employeeProfit + adminProfit = 400 + 600 = 1000
    expect(sale.totalProfit).toBe(1000);
  });

  test("Debe calcular correctamente venta directa de admin (sin employee)", async () => {
    const sale = await Sale.create({
      employee: null,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      employeePrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      employeeProfitPercentage: 0,
    });

    // adminProfit = (salePrice - purchasePrice) * quantity = (200 - 100) * 10 = 1000
    expect(sale.adminProfit).toBe(1000);
    expect(sale.employeeProfit).toBe(0);
    expect(sale.totalProfit).toBe(1000);
  });
});

describe("Sale Model - Validaciones", () => {
  let product;
  let employee;

  beforeEach(async () => {
    product = await Product.create({
      name: "Producto Test",
      description: "Descripción test",
      purchasePrice: 100,
      employeePrice: 150,
      salePrice: 200,
      totalStock: 1000,
      category: new mongoose.Types.ObjectId(),
    });

    employee = await User.create({
      name: "Employee Test",
      email: "employee@test.com",
      password: "password123",
      role: "employee",
    });
  });

  test("Debe requerir campos obligatorios", async () => {
    const sale = new Sale({});

    await expect(sale.save()).rejects.toThrow();
  });

  test("Debe aceptar employeeProfitPercentage válidos (0, 20, 21, 23, 25)", async () => {
    const validPercentages = [0, 20, 21, 23, 25];

    for (const percentage of validPercentages) {
      const sale = await Sale.create({
        employee: percentage === 0 ? null : employee._id,
        product: product._id,
        quantity: 1,
        purchasePrice: 100,
        employeePrice: 150,
        salePrice: 200,
        commissionBonus: percentage === 0 ? 0 : percentage - 20,
        employeeProfitPercentage: percentage,
      });

      expect(sale.employeeProfitPercentage).toBe(percentage);
    }
  });

  test('Debe tener status de pago por defecto "pendiente"', async () => {
    const sale = await Sale.create({
      employee: employee._id,
      product: product._id,
      quantity: 1,
      purchasePrice: 100,
      employeePrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      employeeProfitPercentage: 20,
    });

    expect(sale.paymentStatus).toBe("pendiente");
  });
});
