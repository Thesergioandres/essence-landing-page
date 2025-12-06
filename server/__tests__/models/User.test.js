import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import User from '../../models/User.js';
import bcrypt from 'bcryptjs';

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

describe('User Model - Creación y Validaciones', () => {
  test('Debe crear usuario con campos válidos', async () => {
    const user = await User.create({
      name: 'Usuario Test',
      email: 'test@example.com',
      password: 'password123',
      role: 'distribuidor',
    });

    expect(user.name).toBe('Usuario Test');
    expect(user.email).toBe('test@example.com');
    expect(user.role).toBe('distribuidor');
    expect(user.password).not.toBe('password123'); // Debe estar hasheada
  });

  test('Debe hashear contraseña automáticamente', async () => {
    const plainPassword = 'mySecurePassword123';
    const user = await User.create({
      name: 'Usuario Test',
      email: 'test@example.com',
      password: plainPassword,
      role: 'distribuidor',
    });

    expect(user.password).not.toBe(plainPassword);
    expect(user.password).toMatch(/^\$2[aby]\$.{56}$/); // Formato bcrypt
  });

  test('Debe requerir campos obligatorios', async () => {
    const user = new User({});
    
    await expect(user.save()).rejects.toThrow();
  });

  test('Email debe ser único', async () => {
    await User.create({
      name: 'Usuario 1',
      email: 'duplicate@example.com',
      password: 'password123',
      role: 'distribuidor',
    });

    await expect(
      User.create({
        name: 'Usuario 2',
        email: 'duplicate@example.com',
        password: 'password456',
        role: 'distribuidor',
      })
    ).rejects.toThrow();
  });

  test('Debe validar formato de email', async () => {
    const user = new User({
      name: 'Usuario Test',
      email: 'invalid-email',
      password: 'password123',
      role: 'distribuidor',
    });

    await expect(user.save()).rejects.toThrow();
  });
});

describe('User Model - Roles', () => {
  test('Debe aceptar role "admin"', async () => {
    const user = await User.create({
      name: 'Admin Test',
      email: 'admin@example.com',
      password: 'password123',
      role: 'admin',
    });

    expect(user.role).toBe('admin');
  });

  test('Debe aceptar role "distribuidor"', async () => {
    const user = await User.create({
      name: 'Distribuidor Test',
      email: 'dist@example.com',
      password: 'password123',
      role: 'distribuidor',
    });

    expect(user.role).toBe('distribuidor');
  });

  test('Debe tener role por defecto "distribuidor"', async () => {
    const user = await User.create({
      name: 'Usuario Test',
      email: 'user@example.com',
      password: 'password123',
    });

    expect(user.role).toBe('distribuidor');
  });

  test('No debe aceptar roles inválidos', async () => {
    const user = new User({
      name: 'Usuario Test',
      email: 'test@example.com',
      password: 'password123',
      role: 'invalid_role',
    });

    await expect(user.save()).rejects.toThrow();
  });
});

describe('User Model - Método comparePassword', () => {
  test('Debe comparar contraseña correcta exitosamente', async () => {
    const plainPassword = 'mySecurePassword123';
    const user = await User.create({
      name: 'Usuario Test',
      email: 'test@example.com',
      password: plainPassword,
      role: 'distribuidor',
    });

    const isMatch = await user.comparePassword(plainPassword);
    expect(isMatch).toBe(true);
  });

  test('Debe rechazar contraseña incorrecta', async () => {
    const user = await User.create({
      name: 'Usuario Test',
      email: 'test@example.com',
      password: 'correctPassword123',
      role: 'distribuidor',
    });

    const isMatch = await user.comparePassword('wrongPassword');
    expect(isMatch).toBe(false);
  });

  test('Debe funcionar con diferentes contraseñas', async () => {
    const passwords = ['test123', 'MyP@ssw0rd!', '12345678', 'verylongpassword123456'];

    for (const password of passwords) {
      const user = await User.create({
        name: `User ${password}`,
        email: `${password}@example.com`,
        password,
        role: 'distribuidor',
      });

      const isMatch = await user.comparePassword(password);
      expect(isMatch).toBe(true);
    }
  });
});

describe('User Model - Información Adicional', () => {
  test('Debe guardar información de contacto opcional', async () => {
    const user = await User.create({
      name: 'Usuario Test',
      email: 'test@example.com',
      password: 'password123',
      role: 'distribuidor',
      phone: '1234567890',
      address: 'Calle Test 123',
    });

    expect(user.phone).toBe('1234567890');
    expect(user.address).toBe('Calle Test 123');
  });

  test('Debe manejar campos opcionales vacíos', async () => {
    const user = await User.create({
      name: 'Usuario Test',
      email: 'test@example.com',
      password: 'password123',
      role: 'distribuidor',
    });

    expect(user.phone).toBeUndefined();
    expect(user.address).toBeUndefined();
  });

  test('Debe tener isActive en true por defecto', async () => {
    const user = await User.create({
      name: 'Usuario Test',
      email: 'test@example.com',
      password: 'password123',
      role: 'distribuidor',
    });

    expect(user.isActive).toBe(true);
  });

  test('Debe poder desactivar usuario', async () => {
    const user = await User.create({
      name: 'Usuario Test',
      email: 'test@example.com',
      password: 'password123',
      role: 'distribuidor',
    });

    user.isActive = false;
    await user.save();

    const updated = await User.findById(user._id);
    expect(updated.isActive).toBe(false);
  });
});

describe('User Model - Timestamps', () => {
  test('Debe agregar createdAt automáticamente', async () => {
    const user = await User.create({
      name: 'Usuario Test',
      email: 'test@example.com',
      password: 'password123',
      role: 'distribuidor',
    });

    expect(user.createdAt).toBeDefined();
    expect(user.createdAt).toBeInstanceOf(Date);
  });

  test('Debe agregar updatedAt automáticamente', async () => {
    const user = await User.create({
      name: 'Usuario Test',
      email: 'test@example.com',
      password: 'password123',
      role: 'distribuidor',
    });

    expect(user.updatedAt).toBeDefined();
    expect(user.updatedAt).toBeInstanceOf(Date);
  });

  test('updatedAt debe cambiar al actualizar usuario', async () => {
    const user = await User.create({
      name: 'Usuario Test',
      email: 'test@example.com',
      password: 'password123',
      role: 'distribuidor',
    });

    const originalUpdatedAt = user.updatedAt;
    
    // Esperar un poco y actualizar
    await new Promise(resolve => setTimeout(resolve, 100));
    
    user.name = 'Usuario Modificado';
    await user.save();

    expect(user.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
  });
});
