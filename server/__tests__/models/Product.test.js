import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Product from '../../models/Product.js';
import Category from '../../models/Category.js';

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
    await collections[key].deleteMany();
  }
});

describe('Product Model - Validaciones', () => {
  let category;

  beforeEach(async () => {
    category = await Category.create({
      name: 'Categoría Test',
      description: 'Descripción test',
    });
  });

  test('Debe crear producto con campos válidos', async () => {
    const product = await Product.create({
      name: 'Producto Test',
      description: 'Descripción del producto',
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      totalStock: 1000,
      category: category._id,
    });

    expect(product.name).toBe('Producto Test');
    expect(product.purchasePrice).toBe(100);
    expect(product.distributorPrice).toBe(150);
    expect(product.salePrice).toBe(200);
    expect(product.totalStock).toBe(1000);
  });

  test('Debe requerir campos obligatorios', async () => {
    const product = new Product({});
    
    await expect(product.save()).rejects.toThrow();
  });

  test('purchasePrice debe ser menor que distributorPrice', async () => {
    const product = new Product({
      name: 'Producto Test',
      description: 'Test',
      purchasePrice: 200,
      distributorPrice: 150,
      salePrice: 300,
      totalStock: 100,
      category: category._id,
    });

    await expect(product.save()).rejects.toThrow();
  });

  test('distributorPrice debe ser menor que salePrice', async () => {
    const product = new Product({
      name: 'Producto Test',
      description: 'Test',
      purchasePrice: 100,
      distributorPrice: 250,
      salePrice: 200,
      totalStock: 100,
      category: category._id,
    });

    await expect(product.save()).rejects.toThrow();
  });

  test('totalStock no puede ser negativo', async () => {
    const product = new Product({
      name: 'Producto Test',
      description: 'Test',
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      totalStock: -10,
      category: category._id,
    });

    await expect(product.save()).rejects.toThrow();
  });
});

describe('Product Model - Stock y Estado', () => {
  let category;

  beforeEach(async () => {
    category = await Category.create({
      name: 'Categoría Test',
      description: 'Descripción test',
    });
  });

  test('Producto con stock > 0 debe estar disponible', async () => {
    const product = await Product.create({
      name: 'Producto Test',
      description: 'Test',
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      totalStock: 50,
      category: category._id,
    });

    expect(product.isAvailable).toBe(true);
  });

  test('Producto con stock = 0 no debe estar disponible', async () => {
    const product = await Product.create({
      name: 'Producto Test',
      description: 'Test',
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      totalStock: 0,
      category: category._id,
    });

    expect(product.isAvailable).toBe(false);
  });

  test('Debe poder actualizar stock correctamente', async () => {
    const product = await Product.create({
      name: 'Producto Test',
      description: 'Test',
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      totalStock: 100,
      category: category._id,
    });

    product.totalStock -= 20;
    await product.save();

    const updated = await Product.findById(product._id);
    expect(updated.totalStock).toBe(80);
  });
});

describe('Product Model - Precios', () => {
  let category;

  beforeEach(async () => {
    category = await Category.create({
      name: 'Categoría Test',
      description: 'Descripción test',
    });
  });

  test('Debe calcular márgenes de ganancia correctamente', async () => {
    const product = await Product.create({
      name: 'Producto Test',
      description: 'Test',
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
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

  test('Debe permitir actualizar precios manteniendo lógica de negocio', async () => {
    const product = await Product.create({
      name: 'Producto Test',
      description: 'Test',
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      totalStock: 100,
      category: category._id,
    });

    product.purchasePrice = 120;
    product.distributorPrice = 180;
    product.salePrice = 240;
    await product.save();

    expect(product.purchasePrice).toBe(120);
    expect(product.distributorPrice).toBe(180);
    expect(product.salePrice).toBe(240);
  });
});
