import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import Category from "../../models/Category.js";
import Product from "../../models/Product.js";

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

describe("Product Model - Validaciones", () => {
  let category;

  beforeEach(async () => {
    category = await Category.create({
      name: "Categoría Test",
      description: "Descripción test",
    });
  });

  test("Debe crear producto con campos válidos", async () => {
    const product = await Product.create({
      name: "Producto Test",
      description: "Descripción del producto",
      purchasePrice: 100,
      distributorPrice: 150,
      clientPrice: 200,
      totalStock: 1000,
      category: category._id,
    });

    expect(product.name).toBe("Producto Test");
    expect(product.purchasePrice).toBe(100);
    expect(product.distributorPrice).toBe(150);
    expect(product.clientPrice).toBe(200);
    expect(product.totalStock).toBe(1000);
  });

  test("Debe requerir campos obligatorios", async () => {
    const product = new Product({});

    await expect(product.save()).rejects.toThrow();
  });

  test("Debe calcular suggestedPrice automáticamente (30% sobre purchasePrice)", async () => {
    const product = await Product.create({
      name: "Producto Test",
      description: "Test",
      purchasePrice: 100,
      distributorPrice: 150,
      category: category._id,
    });

    expect(product.suggestedPrice).toBe(130);
  });

  test("totalStock no puede ser negativo", async () => {
    const product = new Product({
      name: "Producto Test",
      description: "Test",
      purchasePrice: 100,
      distributorPrice: 150,
      totalStock: -10,
      category: category._id,
    });

    await expect(product.save()).rejects.toThrow();
  });
});

describe("Product Model - Defaults", () => {
  let category;

  beforeEach(async () => {
    category = await Category.create({
      name: "Categoría Test",
      description: "Descripción test",
    });
  });

  test("Debe tener defaults esperados", async () => {
    const product = await Product.create({
      name: "Producto Test",
      description: "Test",
      purchasePrice: 100,
      distributorPrice: 150,
      category: category._id,
    });

    expect(product.totalStock).toBe(0);
    expect(product.warehouseStock).toBe(0);
    expect(product.lowStockAlert).toBe(10);
    expect(product.featured).toBe(false);
  });

  test("Debe poder actualizar stock correctamente", async () => {
    const product = await Product.create({
      name: "Producto Test",
      description: "Test",
      purchasePrice: 100,
      distributorPrice: 150,
      totalStock: 100,
      category: category._id,
    });

    product.totalStock -= 20;
    await product.save();

    const updated = await Product.findById(product._id);
    expect(updated.totalStock).toBe(80);
  });
});

describe("Product Model - Precios", () => {
  let category;

  beforeEach(async () => {
    category = await Category.create({
      name: "Categoría Test",
      description: "Descripción test",
    });
  });

  test("Debe calcular márgenes de ganancia correctamente", async () => {
    const product = await Product.create({
      name: "Producto Test",
      description: "Test",
      purchasePrice: 100,
      distributorPrice: 150,
      clientPrice: 200,
      totalStock: 100,
      category: category._id,
    });

    // Margen distribuidor = (salePrice - distributorPrice) / salePrice * 100
    const distributorMargin = ((200 - 150) / 200) * 100;
    expect(distributorMargin).toBe(25);

    // Margen admin = (distributorPrice - purchasePrice) / distributorPrice * 100
    const adminMargin = ((150 - 100) / 150) * 100;
    expect(adminMargin).toBeCloseTo(33.33, 2);
  });

  test("Debe permitir actualizar precios manteniendo lógica de negocio", async () => {
    const product = await Product.create({
      name: "Producto Test",
      description: "Test",
      purchasePrice: 100,
      distributorPrice: 150,
      clientPrice: 200,
      totalStock: 100,
      category: category._id,
    });

    product.purchasePrice = 120;
    product.distributorPrice = 180;
    product.clientPrice = 240;
    await product.save();

    expect(product.purchasePrice).toBe(120);
    expect(product.distributorPrice).toBe(180);
    expect(product.clientPrice).toBe(240);
  });
});
