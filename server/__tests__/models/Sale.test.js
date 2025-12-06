import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import Sale from '../../models/Sale.js';
import Product from '../../models/Product.js';
import User from '../../models/User.js';

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

describe('Sale Model - Generación de saleId', () => {
  let product;
  let distributor;

  beforeEach(async () => {
    // Crear producto de prueba
    product = await Product.create({
      name: 'Producto Test',
      description: 'Descripción test',
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      totalStock: 1000,
      category: new mongoose.Types.ObjectId(),
    });

    // Crear distribuidor de prueba
    distributor = await User.create({
      name: 'Distribuidor Test',
      email: 'distributor@test.com',
      password: 'password123',
      role: 'distribuidor',
    });
  });

  test('Debe generar saleId automáticamente con formato VTA-YYYY-NNNN', async () => {
    const sale = await Sale.create({
      distributor: distributor._id,
      product: product._id,
      quantity: 5,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 5,
      distributorProfitPercentage: 25,
    });

    expect(sale.saleId).toBeDefined();
    expect(sale.saleId).toMatch(/^VTA-\d{4}-\d{4}$/);
    
    const year = new Date().getFullYear();
    expect(sale.saleId).toContain(`VTA-${year}`);
  });

  test('Debe incrementar el contador de saleId secuencialmente', async () => {
    const sale1 = await Sale.create({
      distributor: distributor._id,
      product: product._id,
      quantity: 1,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 20,
    });

    const sale2 = await Sale.create({
      distributor: distributor._id,
      product: product._id,
      quantity: 1,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 20,
    });

    const num1 = parseInt(sale1.saleId.split('-')[2]);
    const num2 = parseInt(sale2.saleId.split('-')[2]);
    
    expect(num2).toBe(num1 + 1);
  });
});

describe('Sale Model - Cálculo de ganancias', () => {
  let product;
  let distributor;

  beforeEach(async () => {
    product = await Product.create({
      name: 'Producto Test',
      description: 'Descripción test',
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      totalStock: 1000,
      category: new mongoose.Types.ObjectId(),
    });

    distributor = await User.create({
      name: 'Distribuidor Test',
      email: 'distributor@test.com',
      password: 'password123',
      role: 'distribuidor',
    });
  });

  test('Debe calcular correctamente ganancia de distribuidor normal (20%)', async () => {
    const sale = await Sale.create({
      distributor: distributor._id,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 20,
    });

    // distributorProfit = salePrice * 20% * quantity = 200 * 0.20 * 10 = 400
    expect(sale.distributorProfit).toBe(400);
  });

  test('Debe calcular correctamente ganancia de distribuidor 1er lugar (25%)', async () => {
    const sale = await Sale.create({
      distributor: distributor._id,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 5,
      distributorProfitPercentage: 25,
    });

    // distributorProfit = salePrice * 25% * quantity = 200 * 0.25 * 10 = 500
    expect(sale.distributorProfit).toBe(500);
  });

  test('Debe calcular correctamente ganancia de distribuidor 2do lugar (23%)', async () => {
    const sale = await Sale.create({
      distributor: distributor._id,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 3,
      distributorProfitPercentage: 23,
    });

    // distributorProfit = salePrice * 23% * quantity = 200 * 0.23 * 10 = 460
    expect(sale.distributorProfit).toBe(460);
  });

  test('Debe calcular correctamente ganancia de distribuidor 3er lugar (21%)', async () => {
    const sale = await Sale.create({
      distributor: distributor._id,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 1,
      distributorProfitPercentage: 21,
    });

    // distributorProfit = salePrice * 21% * quantity = 200 * 0.21 * 10 = 420
    expect(sale.distributorProfit).toBe(420);
  });

  test('Debe calcular correctamente ganancia admin con distribuidor normal (20%)', async () => {
    const sale = await Sale.create({
      distributor: distributor._id,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 20,
    });

    // distributorPayment = salePrice * 80% = 200 * 0.80 = 160
    // adminProfit = (distributorPayment - purchasePrice) * quantity = (160 - 100) * 10 = 600
    expect(sale.adminProfit).toBe(600);
  });

  test('Debe calcular correctamente ganancia admin con distribuidor 1er lugar (25%)', async () => {
    const sale = await Sale.create({
      distributor: distributor._id,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 5,
      distributorProfitPercentage: 25,
    });

    // distributorPayment = salePrice * 75% = 200 * 0.75 = 150
    // adminProfit = (distributorPayment - purchasePrice) * quantity = (150 - 100) * 10 = 500
    expect(sale.adminProfit).toBe(500);
  });

  test('Debe calcular correctamente ganancia total (distribuidor + admin)', async () => {
    const sale = await Sale.create({
      distributor: distributor._id,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 20,
    });

    // totalProfit = distributorProfit + adminProfit = 400 + 600 = 1000
    expect(sale.totalProfit).toBe(1000);
  });

  test('Debe calcular correctamente venta directa de admin (sin distribuidor)', async () => {
    const sale = await Sale.create({
      distributor: null,
      product: product._id,
      quantity: 10,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 0,
    });

    // adminProfit = (salePrice - purchasePrice) * quantity = (200 - 100) * 10 = 1000
    expect(sale.adminProfit).toBe(1000);
    expect(sale.distributorProfit).toBe(0);
    expect(sale.totalProfit).toBe(1000);
  });
});

describe('Sale Model - Validaciones', () => {
  let product;
  let distributor;

  beforeEach(async () => {
    product = await Product.create({
      name: 'Producto Test',
      description: 'Descripción test',
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      totalStock: 1000,
      category: new mongoose.Types.ObjectId(),
    });

    distributor = await User.create({
      name: 'Distribuidor Test',
      email: 'distributor@test.com',
      password: 'password123',
      role: 'distribuidor',
    });
  });

  test('Debe requerir campos obligatorios', async () => {
    const sale = new Sale({});
    
    await expect(sale.save()).rejects.toThrow();
  });

  test('Debe aceptar distributorProfitPercentage válidos (0, 20, 21, 23, 25)', async () => {
    const validPercentages = [0, 20, 21, 23, 25];

    for (const percentage of validPercentages) {
      const sale = await Sale.create({
        distributor: percentage === 0 ? null : distributor._id,
        product: product._id,
        quantity: 1,
        purchasePrice: 100,
        distributorPrice: 150,
        salePrice: 200,
        commissionBonus: percentage === 0 ? 0 : percentage - 20,
        distributorProfitPercentage: percentage,
      });

      expect(sale.distributorProfitPercentage).toBe(percentage);
    }
  });

  test('Debe tener status de pago por defecto "pendiente"', async () => {
    const sale = await Sale.create({
      distributor: distributor._id,
      product: product._id,
      quantity: 1,
      purchasePrice: 100,
      distributorPrice: 150,
      salePrice: 200,
      commissionBonus: 0,
      distributorProfitPercentage: 20,
    });

    expect(sale.paymentStatus).toBe('pendiente');
  });
});
