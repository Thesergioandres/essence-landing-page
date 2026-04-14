import { AuthService } from "../../domain/services/AuthService.js";
import Branch from "../../infrastructure/database/models/Branch.js";
import BranchStock from "../../infrastructure/database/models/BranchStock.js";
import Business from "../../infrastructure/database/models/Business.js";
import Category from "../../infrastructure/database/models/Category.js";
import Customer from "../../infrastructure/database/models/Customer.js";
import DeliveryMethod from "../../infrastructure/database/models/DeliveryMethod.js";
import EmployeeStock from "../../infrastructure/database/models/EmployeeStock.js";
import Expense from "../../infrastructure/database/models/Expense.js";
import InventoryEntry from "../../infrastructure/database/models/InventoryEntry.js";
import Membership from "../../infrastructure/database/models/Membership.js";
import PaymentMethod from "../../infrastructure/database/models/PaymentMethod.js";
import Product from "../../infrastructure/database/models/Product.js";
import ProfitHistory from "../../infrastructure/database/models/ProfitHistory.js";
import Sale from "../../infrastructure/database/models/Sale.js";
import User from "../../infrastructure/database/models/User.js";
import { jwtTokenService } from "../../infrastructure/services/jwtToken.service.js";
import { UserPersistenceUseCase } from "./repository-gateways/UserPersistenceUseCase.js";
import { TeardownDemoTenantUseCase } from "./TeardownDemoTenantUseCase.js";

const DEFAULT_DEMO_TTL_HOURS = 2;
const DEMO_ADMIN_PASSWORD = "DemoAdmin123!";
const DEMO_EMPLOYEE_PASSWORD = "DemoDist123!";

const demoCatalog = [
  {
    name: "Vaporizador Aura X",
    description: "Dispositivo premium para sesiones continuas.",
    image:
      "https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Vaporizador Terra Mini",
    description: "Formato compacto para venta de alta rotacion.",
    image:
      "https://images.unsplash.com/photo-1510557880182-3f8c22f7d7f0?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Vaporizador Pulse Pro",
    description: "Control de potencia y bateria extendida.",
    image:
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Vaporizador Nova Plus",
    description: "Linea de entrada con excelente margen.",
    image:
      "https://images.unsplash.com/photo-1519710164239-da123dc03ef4?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Vaporizador Zenith",
    description: "Modelo para clientes recurrentes.",
    image:
      "https://images.unsplash.com/photo-1512290923902-8a9f81dc236c?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Vaporizador Orion",
    description: "Alto rendimiento para canales mayoristas.",
    image:
      "https://images.unsplash.com/photo-1521790361543-f645cf042ec4?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Vaporizador Lumen",
    description: "Producto con demanda estable en retail.",
    image:
      "https://images.unsplash.com/photo-1503602642458-232111445657?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Vaporizador Flux",
    description: "Unidad de alta conversion para promociones.",
    image:
      "https://images.unsplash.com/photo-1481487196290-c152efe083f5?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Vaporizador Prime",
    description: "Edicion orientada a clientes premium.",
    image:
      "https://images.unsplash.com/photo-1484704849700-f032a568e944?auto=format&fit=crop&w=1200&q=80",
  },
  {
    name: "Vaporizador Core",
    description: "Modelo balanceado entre costo y volumen.",
    image:
      "https://images.unsplash.com/photo-1491553895911-0055eca6402d?auto=format&fit=crop&w=1200&q=80",
  },
];

const customerNames = [
  "Camila Perez",
  "Andres Molina",
  "Daniela Ruiz",
  "Felipe Torres",
  "Natalia Vargas",
  "Juan Giraldo",
  "Luisa Mejia",
  "Esteban Rios",
  "Paula Moreno",
  "Santiago Rojas",
  "Andrea Renteria",
  "Miguel Cardenas",
];

const expenseTypes = [
  "Publicidad digital",
  "Operacion tienda",
  "Transporte",
  "Empaques",
  "Mantenimiento",
  "Comisiones externas",
  "Servicios",
  "Novedades comerciales",
];

const randomInt = (min, max) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;

const pickOne = (values = []) => values[randomInt(0, values.length - 1)];

const randomDateInLastDays = (days) => {
  const now = Date.now();
  const offsetMs = randomInt(0, days * 24 * 60 * 60 * 1000);
  return new Date(now - offsetMs);
};

const buildSaleId = (index) => {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DEMO-${stamp}-${index}-${random}`;
};

const normalizeHours = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DEMO_TTL_HOURS;
  }

  return parsed;
};

export class SetupDemoTenantUseCase {
  constructor() {
    this.userRepository = new UserPersistenceUseCase();
    this.teardownUseCase = new TeardownDemoTenantUseCase();
  }

  async execute(context = {}) {
    const ttlHours = normalizeHours(process.env.DEMO_TTL_HOURS);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + ttlHours * 60 * 60 * 1000);

    const nonce = `${Date.now()}${randomInt(100, 999)}`;
    const demoCode = randomInt(1000, 9999);

    const adminEmail = `demo.admin.${nonce}@essence.local`;
    const employeeEmail = `demo.employee.${nonce}@essence.local`;

    const setupState = {
      adminUser: null,
      employeeUser: null,
      business: null,
    };

    try {
      const adminPasswordHash =
        await AuthService.hashPassword(DEMO_ADMIN_PASSWORD);
      setupState.adminUser = await User.create({
        name: `Demo Admin ${demoCode}`,
        email: adminEmail,
        password: adminPasswordHash,
        role: "admin",
        status: "active",
        active: true,
      });

      setupState.business = await Business.create({
        name: `Demo Corp #${demoCode}-${nonce.slice(-3)}`,
        description: "Entorno temporal generado automaticamente para sandbox.",
        createdBy: setupState.adminUser._id,
        status: "active",
        plan: "pro",
        isDemo: true,
        demoExpiresAt: expiresAt,
        metadata: {
          demo: {
            isDemo: true,
            createdAt: now,
            expiresAt,
            source: "sandbox_engine",
            requestIp: context.ip || null,
            userAgent: context.userAgent || null,
            nonce,
          },
        },
      });

      const employeePasswordHash = await AuthService.hashPassword(
        DEMO_EMPLOYEE_PASSWORD,
      );
      setupState.employeeUser = await User.create({
        name: `Demo Employee ${demoCode}`,
        email: employeeEmail,
        password: employeePasswordHash,
        role: "employee",
        status: "active",
        active: true,
        isCommissionFixed: true,
        customCommissionRate: 30,
      });

      await Membership.create([
        {
          user: setupState.adminUser._id,
          business: setupState.business._id,
          role: "admin",
          status: "active",
        },
        {
          user: setupState.employeeUser._id,
          business: setupState.business._id,
          role: "employee",
          status: "active",
        },
      ]);

      const categories = await Category.insertMany([
        {
          business: setupState.business._id,
          name: "Premium",
          description: "Linea premium de vaporizadores.",
        },
        {
          business: setupState.business._id,
          name: "Retail",
          description: "Productos de alta rotacion para mostrador.",
        },
        {
          business: setupState.business._id,
          name: "Mayorista",
          description: "SKU para volumen y employees.",
        },
      ]);

      const warehouseBranch = await Branch.create({
        business: setupState.business._id,
        name: "Bodega Demo",
        address: "Zona Industrial Sandbox",
        contactName: "Logistica Demo",
        contactPhone: "3000000000",
        isWarehouse: true,
        active: true,
      });

      const storefrontBranch = await Branch.create({
        business: setupState.business._id,
        name: "Sede Centro Demo",
        address: "Centro Comercial Demo",
        contactName: "Ventas Demo",
        contactPhone: "3000000001",
        isWarehouse: false,
        active: true,
      });

      const products = await Product.insertMany(
        demoCatalog.map((item, index) => {
          const purchasePrice = randomInt(42000, 120000);
          const averageCost = roundMoney(
            purchasePrice * (1 + randomInt(-3, 5) / 100),
          );
          const employeePrice = roundMoney(averageCost * 1.35);
          const clientPrice = roundMoney(averageCost * 1.7);
          const warehouseStock = randomInt(60, 180);
          const branchStock = randomInt(18, 54);
          const employeeStock = randomInt(8, 30);
          const totalStock = warehouseStock + branchStock + employeeStock;

          return {
            business: setupState.business._id,
            name: item.name,
            sku: `DEMO-${index + 1}-${nonce.slice(-4)}`,
            description: item.description,
            purchasePrice,
            averageCost,
            employeePrice,
            clientPrice,
            suggestedPrice: roundMoney(clientPrice * 1.05),
            employeeCommission: 30,
            category: categories[index % categories.length]._id,
            image: {
              url: item.image,
              publicId: `demo/${nonce}/${index + 1}`,
            },
            totalStock,
            warehouseStock,
            lowStockAlert: 12,
            costingMethod: "average",
            totalInventoryValue: roundMoney(totalStock * averageCost),
            featured: index < 3,
          };
        }),
      );

      await PaymentMethod.createDefaultMethods(
        setupState.business._id,
        setupState.adminUser._id,
      );
      const deliveryMethods = await DeliveryMethod.createDefaultMethods(
        setupState.business._id,
        setupState.adminUser._id,
      );

      const defaultPaymentMethods = await PaymentMethod.find({
        business: setupState.business._id,
      })
        .select("_id code")
        .lean();

      const paymentCash =
        defaultPaymentMethods.find((method) => method.code === "cash") ||
        defaultPaymentMethods[0] ||
        null;
      const paymentTransfer =
        defaultPaymentMethods.find((method) => method.code === "transfer") ||
        paymentCash;

      const deliveryPersonal =
        deliveryMethods.find((method) => method.code === "personal") ||
        deliveryMethods[0] ||
        null;
      const deliveryHome =
        deliveryMethods.find((method) => method.code === "domicilio") ||
        deliveryPersonal;

      const branchStockDocs = [];
      const employeeStockDocs = [];
      const inventoryEntries = [];

      products.forEach((product) => {
        const warehouseQty = Number(product.warehouseStock || 0);
        const branchQty = randomInt(18, 54);
        const employeeQty = randomInt(8, 30);

        branchStockDocs.push({
          business: setupState.business._id,
          branch: warehouseBranch._id,
          product: product._id,
          quantity: warehouseQty,
          lowStockAlert: product.lowStockAlert || 12,
        });

        branchStockDocs.push({
          business: setupState.business._id,
          branch: storefrontBranch._id,
          product: product._id,
          quantity: branchQty,
          lowStockAlert: product.lowStockAlert || 12,
        });

        employeeStockDocs.push({
          business: setupState.business._id,
          employee: setupState.employeeUser._id,
          product: product._id,
          quantity: employeeQty,
          inTransitQuantity: 0,
          lowStockAlert: 6,
        });

        inventoryEntries.push({
          business: setupState.business._id,
          product: product._id,
          user: setupState.adminUser._id,
          type: "entry",
          quantity: warehouseQty + branchQty + employeeQty,
          unitCost: product.averageCost || product.purchasePrice || 0,
          totalCost:
            (warehouseQty + branchQty + employeeQty) *
            (product.averageCost || product.purchasePrice || 0),
          averageCostAfter: product.averageCost || product.purchasePrice || 0,
          notes: "Seed inicial sandbox demo",
          destination: "warehouse",
        });
      });

      await BranchStock.insertMany(branchStockDocs);
      await EmployeeStock.insertMany(employeeStockDocs);
      await InventoryEntry.insertMany(inventoryEntries);

      const customers = await Customer.insertMany(
        customerNames.map((name, index) => ({
          business: setupState.business._id,
          name,
          email: `demo.customer.${index}.${nonce}@mail.local`,
          phone: `30055${String(index).padStart(4, "0")}`,
          createdBy: setupState.adminUser._id,
        })),
      );

      const commissionRate = 0.3;
      const totalSalesToCreate = 50;
      const salesDocs = [];
      const profitHistoryDocs = [];
      const balanceByUser = new Map();

      for (let index = 0; index < totalSalesToCreate; index += 1) {
        const product = pickOne(products);
        const quantity = randomInt(1, 4);
        const saleDate = randomDateInLastDays(85);
        const withEmployee = Math.random() > 0.28;
        const salePrice = roundMoney(
          (product.clientPrice || 0) * (1 + randomInt(-4, 6) / 100),
        );
        const grossRevenue = roundMoney(quantity * salePrice);
        const discount = roundMoney(grossRevenue * (randomInt(0, 7) / 100));
        const actualPayment = Math.max(0, roundMoney(grossRevenue - discount));
        const averageCostAtSale = roundMoney(
          product.averageCost || product.purchasePrice || 0,
        );
        const totalCost = roundMoney(averageCostAtSale * quantity);
        const employeeProfit = withEmployee
          ? roundMoney(actualPayment * commissionRate)
          : 0;
        const adminProfit = Math.max(
          0,
          roundMoney(actualPayment - totalCost - employeeProfit),
        );
        const totalProfit = roundMoney(adminProfit + employeeProfit);
        const shippingCost = roundMoney(randomInt(0, 12000));

        const selectedPayment =
          Math.random() > 0.35
            ? paymentCash || paymentTransfer
            : paymentTransfer;
        const selectedDelivery =
          Math.random() > 0.55
            ? deliveryPersonal || deliveryHome
            : deliveryHome;

        const customer = pickOne(customers);

        const saleDoc = {
          business: setupState.business._id,
          branch: storefrontBranch._id,
          branchName: storefrontBranch.name,
          customer: customer?._id,
          customerName: customer?.name || null,
          customerEmail: customer?.email || null,
          customerPhone: customer?.phone || null,
          saleId: buildSaleId(index + 1),
          saleGroupId: `DEMO-GROUP-${index + 1}`,
          employee: withEmployee ? setupState.employeeUser._id : null,
          product: product._id,
          productName: product.name,
          quantity,
          purchasePrice: product.purchasePrice || averageCostAtSale,
          averageCostAtSale,
          employeePrice: product.employeePrice || averageCostAtSale,
          salePrice,
          isPromotion: false,
          employeeProfit,
          adminProfit,
          totalProfit,
          totalGroupProfit: totalProfit,
          employeeProfitPercentage: withEmployee ? 30 : 0,
          commissionBonus: 0,
          commissionBonusAmount: 0,
          saleDate,
          sourceLocation: "branch",
          createdBy: setupState.adminUser._id,
          paymentStatus: "confirmado",
          paymentConfirmedAt: saleDate,
          paymentConfirmedBy: setupState.adminUser._id,
          paymentMethod: selectedPayment?._id || null,
          paymentMethodCode: selectedPayment?.code || null,
          deliveryMethod: selectedDelivery?._id || null,
          deliveryMethodCode: selectedDelivery?.code || null,
          shippingCost,
          totalAdditionalCosts: 0,
          actualPayment,
          discount,
          netProfit: Math.max(0, roundMoney(adminProfit - shippingCost)),
        };

        salesDocs.push(saleDoc);
      }

      const sales = await Sale.insertMany(salesDocs, { ordered: true });

      for (const sale of sales) {
        const adminPrevious =
          balanceByUser.get(String(setupState.adminUser._id)) || 0;
        const adminNext = roundMoney(
          adminPrevious + Number(sale.adminProfit || 0),
        );
        balanceByUser.set(String(setupState.adminUser._id), adminNext);

        profitHistoryDocs.push({
          business: setupState.business._id,
          user: setupState.adminUser._id,
          type: "venta_normal",
          amount: roundMoney(sale.adminProfit || 0),
          sale: sale._id,
          product: sale.product,
          description: `Ganancia admin por ${sale.saleId}`,
          date: sale.saleDate,
          balanceAfter: adminNext,
        });

        if (sale.employee) {
          const employeeKey = String(sale.employee);
          const employeePrevious = balanceByUser.get(employeeKey) || 0;
          const employeeNext = roundMoney(
            employeePrevious + Number(sale.employeeProfit || 0),
          );
          balanceByUser.set(employeeKey, employeeNext);

          profitHistoryDocs.push({
            business: setupState.business._id,
            user: sale.employee,
            type: "venta_normal",
            amount: roundMoney(sale.employeeProfit || 0),
            sale: sale._id,
            product: sale.product,
            description: `Comision fija 30% en ${sale.saleId}`,
            date: sale.saleDate,
            balanceAfter: employeeNext,
          });
        }
      }

      await ProfitHistory.insertMany(profitHistoryDocs);

      const expenses = [];
      for (let index = 0; index < 16; index += 1) {
        expenses.push({
          business: setupState.business._id,
          type: pickOne(expenseTypes),
          category: "operativo",
          amount: randomInt(45000, 360000),
          description: `Gasto demo #${index + 1}`,
          expenseDate: randomDateInLastDays(80),
          createdBy: setupState.adminUser._id,
        });
      }
      await Expense.insertMany(expenses);

      const seedSummary = {
        adminUsers: 1,
        employeeUsers: 1,
        categories: categories.length,
        products: products.length,
        customers: customers.length,
        sales: sales.length,
        profitHistory: profitHistoryDocs.length,
        expenses: expenses.length,
      };

      await Business.findByIdAndUpdate(setupState.business._id, {
        $set: {
          isDemo: true,
          demoExpiresAt: expiresAt,
          "metadata.demo": {
            isDemo: true,
            createdAt: now,
            expiresAt,
            source: "sandbox_engine",
            nonce,
            userIds: [setupState.adminUser._id, setupState.employeeUser._id],
            adminUserId: setupState.adminUser._id,
            employeeUserId: setupState.employeeUser._id,
            seedSummary,
            requestIp: context.ip || null,
            userAgent: context.userAgent || null,
          },
        },
      });

      const sessionUser = await this.userRepository.findById(
        setupState.adminUser._id,
      );
      const token = jwtTokenService.generateAccessToken(
        setupState.adminUser._id,
        setupState.adminUser.role,
        setupState.business._id,
      );

      return {
        token,
        user: sessionUser,
        businessId: setupState.business._id.toString(),
        businessName: setupState.business.name,
        expiresAt: expiresAt.toISOString(),
        seeded: seedSummary,
      };
    } catch (error) {
      const fallbackUserIds = [
        setupState.adminUser?._id,
        setupState.employeeUser?._id,
      ].filter(Boolean);

      if (setupState.business?._id) {
        await this.teardownUseCase.execute({
          businessId: setupState.business._id.toString(),
          reason: "setup_failed",
          skipBusinessValidation: true,
          demoUserIds: fallbackUserIds,
        });
      } else if (fallbackUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: fallbackUserIds } });
      }

      throw error;
    }
  }
}
