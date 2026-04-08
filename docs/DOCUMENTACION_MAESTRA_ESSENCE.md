# 📘 DOCUMENTACIÓN MAESTRA ESSENCE

## _"El Manual Sagrado"_

> **Fecha de Generación:** 2 de Febrero de 2026  
> **Versión del Sistema:** Essence Business Management Platform  
> **Propósito:** Documento definitivo que explica la lógica de negocio, fórmulas matemáticas, flujos de usuario y reglas invisibles del sistema.

---

# 📑 ÍNDICE

1. [El Flujo de Vida del Negocio](#1--el-flujo-de-vida-del-negocio-the-golden-flow)
2. [El Núcleo Matemático](#2--el-núcleo-matemático-financial-logic)
3. [Lógica de Inventario](#3--lógica-de-inventario-inventory-rules)
4. [Seguridad y Roles](#4-️-seguridad-y-roles)
5. [Anexos Técnicos](#5--anexos-técnicos)

---

# 1. 🔄 EL FLUJO DE VIDA DEL NEGOCIO (The Golden Flow)

## 1.1 Diagrama del Ciclo de Vida

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   REGISTRO  │───▶│  APROBACIÓN │───▶│CONFIGURACIÓN│───▶│  OPERACIÓN  │
│   Usuario   │    │    GOD      │    │   Negocio   │    │    Diaria   │
│  (pending)  │    │  (active)   │    │             │    │             │
└─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘
                                                                │
                   ┌─────────────┐    ┌─────────────┐           │
                   │  ASIGNACIÓN │◀───│  EXPANSIÓN  │◀──────────┘
                   │   de Stock  │    │   Sedes &   │
                   │             │    │Distribuidores│
                   └─────────────┘    └─────────────┘
```

---

## 1.2 Etapa 1: REGISTRO DE USUARIO

### Descripción

Cuando un usuario nuevo se registra en la plataforma, se crea con estado `pending` y no puede operar hasta ser aprobado.

### Ubicación en Código

- **Archivo:** `server/src/application/use-cases/RegisterUserUseCase.js`
- **Modelo:** `server/src/infrastructure/database/models/User.js`

### Estados de Usuario Disponibles

| Estado      | Descripción                          | Puede Operar |
| ----------- | ------------------------------------ | ------------ |
| `pending`   | Recién registrado, espera aprobación | ❌ No        |
| `active`    | Cuenta activa y operativa            | ✅ Sí        |
| `expired`   | Suscripción vencida                  | ❌ No        |
| `suspended` | Suspendido por administración        | ❌ No        |
| `paused`    | Pausado temporalmente                | ❌ No        |

### Flujo de Registro (Código Real)

```javascript
// RegisterUserUseCase.js - Líneas clave
const newUser = await this.userRepository.createUser({
  name,
  email,
  password: hashedPassword,
  role: role || "super_admin", // Rol por defecto
  business: businessId,
  // status: "pending" - Definido en Schema por defecto
});
```

### Schema del Usuario

```javascript
// User.js - Campos relevantes
status: {
  type: String,
  enum: ["pending", "active", "expired", "suspended", "paused"],
  default: "pending",  // ⚠️ IMPORTANTE: Siempre inicia pendiente
},
subscriptionExpiresAt: {
  type: Date,
  default: null,
},
```

---

## 1.3 Etapa 2: APROBACIÓN GOD

### Descripción

Solo usuarios con rol `god` pueden activar cuentas. El sistema verifica el estado en cada petición.

### Roles del Sistema

| Rol            | Nivel        | Descripción                               |
| -------------- | ------------ | ----------------------------------------- |
| `god`          | 🔱 Supremo   | Control total del sistema, activa cuentas |
| `super_admin`  | ⭐ Alto      | Administrador general de negocios         |
| `admin`        | 🛠️ Medio     | Administrador dentro de un negocio        |
| `distribuidor` | 📦 Operativo | Vendedor con stock asignado               |
| `user`         | 👤 Básico    | Usuario estándar                          |

### Middleware de Protección

```javascript
// auth.middleware.js - Línea 119-128
if (user.status !== "active") {
  return res.status(403).json({
    message: "Acceso restringido por estado de cuenta",
    code: user.status,
    subscriptionExpiresAt: user.subscriptionExpiresAt,
  });
}
```

### GOD Bypass

```javascript
// auth.middleware.js - Línea 38-41
if (owner.role === "god") {
  console.log("✅ GOD BYPASS ACTIVATED");
  return { hasAccess: true };
}
```

---

## 1.4 Etapa 3: CONFIGURACIÓN DEL NEGOCIO

### Secuencia de Configuración Requerida

```
1. Crear Empresa (Business)
      ↓
2. Crear Categorías
      ↓
3. Crear Productos
      ↓
4. Configurar Métodos de Pago
      ↓
5. Configurar Métodos de Entrega
      ↓
6. Registrar Clientes
```

### Modelo Business (Empresa)

```javascript
// Business.js - Estructura principal
{
  name: String,           // Nombre único
  description: String,
  logoUrl: String,
  contactEmail: String,
  contactPhone: String,
  contactWhatsapp: String,
  contactLocation: String,
  config: {
    features: {           // Feature Flags (activar/desactivar módulos)
      products: Boolean,
      inventory: Boolean,
      sales: Boolean,
      promotions: Boolean,
      providers: Boolean,
      clients: Boolean,
      gamification: Boolean,
      expenses: Boolean,
      distributors: Boolean,
      rankings: Boolean,
      branches: Boolean,
      credits: Boolean,
      customers: Boolean,
      // ... más features
    }
  },
  createdBy: ObjectId,    // Usuario que creó el negocio (owner)
  status: "active" | "archived"
}
```

---

## 1.5 Etapa 4: OPERACIÓN DIARIA

### Flujo de una Venta

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Seleccionar │────▶│   Validar    │────▶│   Calcular   │
│   Productos  │     │    Stock     │     │   Finanzas   │
└──────────────┘     └──────────────┘     └──────────────┘
                                                  │
┌──────────────┐     ┌──────────────┐             │
│   Registrar  │◀────│   Deducir    │◀────────────┘
│    Venta     │     │    Stock     │
└──────────────┘     └──────────────┘
```

---

## 1.6 Etapa 5: EXPANSIÓN (Sedes y Distribuidores)

### Creación de Sedes (Branches)

```javascript
// Branch.js - Modelo
{
  business: ObjectId,     // A qué negocio pertenece
  name: String,
  address: String,
  contactName: String,
  contactPhone: String,
  timezone: "America/Bogota",
  isWarehouse: Boolean,   // ¿Es la bodega principal?
  active: Boolean
}
```

### Creación de Distribuidores

```javascript
// DistributorRepository.js - Proceso de creación
const distributor = await User.create({
  name: data.name,
  email: data.email,
  password: hashedPassword,
  phone: data.phone,
  address: data.address,
  role: "distribuidor",
  status: "active", // ⚠️ Distribuidores se activan inmediatamente
  active: true,
});

// Crear membership (membresía) en el negocio
await Membership.findOneAndUpdate(
  { user: distributor._id, business: businessId },
  { role: "distribuidor", status: "active" },
  { upsert: true, new: true },
);
```

---

## 1.7 Etapa 6: ASIGNACIÓN DE STOCK A DISTRIBUIDORES

### Proceso de Transferencia

```javascript
// StockRepository.js - assignToDistributor
async assignToDistributor(businessId, distributorId, productId, quantity) {
  // 1. Verificar stock en bodega
  const product = await Product.findOne({ _id: productId, business: businessId });
  if (!product || product.warehouseStock < quantity) {
    throw new Error("Stock insuficiente");
  }

  // 2. Crear o actualizar stock del distribuidor
  let distStock = await DistributorStock.findOne({
    distributor: distributorId,
    product: productId,
    business: businessId,
  });

  if (distStock) {
    distStock.quantity += quantity;
    await distStock.save();
  } else {
    distStock = await DistributorStock.create({
      distributor: distributorId,
      product: productId,
      quantity,
      business: businessId,
    });
  }

  // 3. Deducir de bodega
  await Product.findOneAndUpdate(
    { _id: productId, business: businessId, warehouseStock: { $gte: quantity } },
    { $inc: { warehouseStock: -quantity } },
    { new: true }
  );

  // 4. Agregar producto a lista de asignados
  const user = await User.findById(distributorId);
  if (user && !user.assignedProducts.includes(productId)) {
    user.assignedProducts.push(productId);
    await user.save();
  }
}
```

### Transferencias Inmediatas ✅

> **CONFIRMADO:** Las transferencias de stock son **inmediatas**. No hay estado "pendiente" para asignaciones de bodega a distribuidor.

---

# 2. 🧮 EL NÚCLEO MATEMÁTICO (Financial Logic)

## 2.1 Arquitectura Financiera

```
┌──────────────────────────────────────────────────────────┐
│                   REGISTRO DE VENTA                       │
├──────────────────────────────────────────────────────────┤
│  FinanceService.js         RegisterSaleUseCase.js        │
│  (Cálculos Puros)          (Orquestación)                │
└──────────────────────────────────────────────────────────┘
                              ↓
┌──────────────────────────────────────────────────────────┐
│                   FÓRMULAS MAESTRAS                       │
├──────────────────────────────────────────────────────────┤
│  • Precio Distribuidor = PrecioVenta × (100 - %Com)/100  │
│  • Ganancia Dist = (PrecioVenta - PrecioDist) × Cantidad │
│  • Ganancia Admin = Venta - Costo - GananciaDist         │
│  • Ganancia Neta = TotalProfit - Envío - CostosExtra     │
└──────────────────────────────────────────────────────────┘
```

---

## 2.2 FÓRMULA: Precio para Distribuidor

### Definición

El **Precio Distribuidor** es lo que el distribuidor "paga" al admin por cada unidad.

### Fórmula Exacta

```
Precio Distribuidor = Precio Venta × (100 - Comisión%) / 100
```

### Código Fuente

```javascript
// FinanceService.js - Línea 11-17
static calculateDistributorPrice(salePrice, profitPercentage) {
  if (salePrice < 0) throw new Error("Sale price cannot be negative");
  const percentage = profitPercentage || 20; // Default: 20%
  return salePrice * ((100 - percentage) / 100);
}
```

### Ejemplo Práctico

| Concepto                | Valor                        |
| ----------------------- | ---------------------------- |
| Precio de Venta         | $22,000                      |
| Comisión Distribuidor   | 20%                          |
| **Precio Distribuidor** | $22,000 × 0.80 = **$17,600** |

> 💡 **Interpretación:** El distribuidor "le paga" $17,600 al admin por cada unidad vendida a $22,000.

---

## 2.3 FÓRMULA: Ganancia del Distribuidor

### Definición

La ganancia del distribuidor es su **comisión** por vender el producto.

### Fórmula Exacta

```
Ganancia Distribuidor = (Precio Venta - Precio Distribuidor) × Cantidad
```

### Código Fuente

```javascript
// FinanceService.js - Línea 24-27
static calculateDistributorProfit(salePrice, distributorPrice, quantity) {
  return (salePrice - distributorPrice) * quantity;
}
```

### Ejemplo Práctico (Continuación)

| Concepto                  | Valor                                 |
| ------------------------- | ------------------------------------- |
| Precio de Venta           | $22,000                               |
| Precio Distribuidor       | $17,600                               |
| Cantidad                  | 3 unidades                            |
| **Ganancia Distribuidor** | ($22,000 - $17,600) × 3 = **$13,200** |

---

## 2.4 FÓRMULA: Ganancia del Administrador

### Definición

La ganancia del admin es lo que queda **después de restar el costo del producto y la comisión del distribuidor**.

### Fórmula Exacta

```
Ganancia Admin = (Precio Venta × Cantidad) - (Costo × Cantidad) - Ganancia Distribuidor
```

### Código Fuente

```javascript
// FinanceService.js - Línea 35-44
static calculateAdminProfit(salePrice, costBasis, distributorProfit, quantity) {
  const totalRevenue = salePrice * quantity;
  const totalCost = costBasis * quantity;
  // Revenue - Cost - DistributorShare
  return totalRevenue - totalCost - distributorProfit;
}
```

### Ejemplo Práctico (Continuación)

| Concepto                 | Valor                                                 |
| ------------------------ | ----------------------------------------------------- |
| Precio de Venta          | $22,000                                               |
| Costo Base (averageCost) | $10,500                                               |
| Cantidad                 | 3 unidades                                            |
| Ganancia Distribuidor    | $13,200                                               |
| **Ganancia Admin**       | ($22,000 × 3) - ($10,500 × 3) - $13,200 = **$21,300** |

**Desglose:**

- Ingreso Total: $66,000
- Costo Total: $31,500
- Comisión Distribuidor: $13,200
- Ganancia Admin: $66,000 - $31,500 - $13,200 = **$21,300**

---

## 2.5 FÓRMULA: Ganancia Neta

### Definición

La ganancia neta considera **todos los costos adicionales**.

### Fórmula Exacta

```
Ganancia Neta = Total Profit - Costo Envío - Costos Adicionales - Descuento
```

### Código Fuente

```javascript
// FinanceService.js - Línea 52-58
static calculateNetProfit(totalProfit, shippingCost = 0, additionalCosts = 0, discount = 0) {
  return totalProfit - shippingCost - additionalCosts - discount;
}
```

### Pre-Save Hook en Sale.js

```javascript
// Sale.js - Línea 340-345
const totalExtraCosts = this.totalAdditionalCosts + (this.shippingCost || 0);
this.netProfit = this.totalProfit - totalExtraCosts - (this.discount || 0);
```

---

## 2.6 SISTEMA DE COMISIONES POR RANKING

### Tabla de Comisiones

| Posición    | Porcentaje Base | Descripción   |
| ----------- | --------------- | ------------- |
| 🥇 1º lugar | 25%             | Top performer |
| 🥈 2º lugar | 23%             | Second best   |
| 🥉 3º lugar | 21%             | Third place   |
| 📦 Resto    | 20%             | Estándar      |

### Código de Referencia

```javascript
// Sale.js - Pre-save hook, Línea 313-325
// El distribuidor recibe una comisión sobre el precio de venta según su ranking
// 🥇 1º: 25%, 🥈 2º: 23%, 🥉 3º: 21%, Resto: 20%
const profitPercentage = this.distributorProfitPercentage || 20;
```

---

## 2.7 VENTAS A CRÉDITO (FIADO): Regla de Contabilización

### Regla de Oro 💰

> **Las ventas a crédito NO cuentan como ingreso/ganancia hasta que son CONFIRMADAS (pagadas).**

### Estados de Pago

| Estado       | Cuenta en Métricas | Descripción                     |
| ------------ | ------------------ | ------------------------------- |
| `pendiente`  | ❌ NO              | Venta registrada pero no pagada |
| `confirmado` | ✅ SÍ              | Venta pagada y confirmada       |

### Implementación en RegisterSaleUseCase.js

```javascript
// RegisterSaleUseCase.js - Línea 173-178
const saleData = {
  // ... otros campos
  paymentStatus: paymentMethodId === "credit" ? "pendiente" : "confirmado",
  paymentConfirmedAt: paymentMethodId === "credit" ? null : new Date(),
};
```

### Agregación en Analytics (Solo Confirmadas)

```javascript
// AnalyticsRepository.js - getDashboardKPIs
totalRevenue: {
  $sum: {
    $cond: [
      { $eq: ["$paymentStatus", "confirmado"] }, // ⚠️ SOLO CONFIRMADAS
      "$salePrice",
      0,
    ],
  },
},
totalProfit: {
  $sum: {
    $cond: [
      { $eq: ["$paymentStatus", "confirmado"] }, // ⚠️ SOLO CONFIRMADAS
      { $ifNull: ["$netProfit", "$totalProfit"] },
      0,
    ],
  },
},
```

---

## 2.8 UTILIDAD NETA (Con Gastos)

### Fórmula Completa

```
Utilidad Neta del Período = Σ(Ganancias Netas de Ventas Confirmadas) - Σ(Gastos del Período)
```

### Modelo de Gastos

```javascript
// Expense.js
{
  business: ObjectId,
  type: String,        // Tipo de gasto
  amount: Number,      // Monto
  description: String,
  expenseDate: Date,
  createdBy: ObjectId
}
```

---

## 2.9 TABLA RESUMEN DE FÓRMULAS

| Métrica                   | Fórmula                                 | Archivo              |
| ------------------------- | --------------------------------------- | -------------------- |
| **Precio Distribuidor**   | `PV × (100 - Com%) / 100`               | FinanceService.js:14 |
| **Ganancia Distribuidor** | `(PV - PD) × Qty`                       | FinanceService.js:25 |
| **Ganancia Admin**        | `(PV × Qty) - (Costo × Qty) - GanDist`  | FinanceService.js:40 |
| **Ganancia Total**        | `GanAdmin + GanDist`                    | Sale.js:335          |
| **Ganancia Neta**         | `TotalProfit - Envío - CostosAd - Desc` | Sale.js:342          |
| **% Rentabilidad**        | `(NetProfit / TotalSale) × 100`         | Sale.js:349          |
| **% Costo**               | `(CostoBase / PrecioVenta) × 100`       | Sale.js:350          |

---

# 3. 📦 LÓGICA DE INVENTARIO (Inventory Rules)

## 3.1 Estructura de Inventario

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTO (Product)                        │
├─────────────────────────────────────────────────────────────┤
│  totalStock        →  Stock total (contador global)         │
│  warehouseStock    →  Stock en bodega (disponible admin)    │
│  averageCost       →  Costo promedio ponderado              │
│  totalInventoryValue → Valor total del inventario           │
└─────────────────────────────────────────────────────────────┘
          │                         │
          ▼                         ▼
┌─────────────────┐       ┌─────────────────┐
│  BranchStock    │       │DistributorStock │
│  (Por Sede)     │       │(Por Distribuidor)│
└─────────────────┘       └─────────────────┘
```

---

## 3.2 Regla de Deducción de Stock

### Venta del Administrador (Admin Sale)

```javascript
// RegisterSaleUseCase.js - Línea 134-145
if (!distributorId) {
  // Admin Sale → Deduct from Warehouse
  await this.productRepository.updateWarehouseStock(
    productId,
    -quantity,
    session,
  );
  console.log(`📦 Deducted ${quantity} from Warehouse (admin sale)`);
}
```

**Flujo:**

```
Venta Admin → Deduce de warehouseStock → Actualiza totalStock
```

### Venta del Distribuidor (Distributor Sale)

```javascript
// RegisterSaleUseCase.js - Línea 123-133
if (distributorId) {
  // Distributor Sale → Deduct from DistributorStock
  const distStock = await DistributorStock.findOneAndUpdate(
    { business: businessId, distributor: distributorId, product: productId },
    { $inc: { quantity: -quantity } },
    session ? { session, new: true } : { new: true },
  );
  console.log(`📦 Deducted ${quantity} from DistributorStock`);
}
```

**Flujo:**

```
Venta Distribuidor → Deduce de DistributorStock → Actualiza totalStock
```

---

## 3.3 Costo Promedio Ponderado (WAC - Weighted Average Cost)

### Definición

El sistema utiliza el método de **Costo Promedio Ponderado** para valorar el inventario.

### Configuración por Producto

```javascript
// Product.js - Campos de costeo
averageCost: {
  type: Number,
  default: function() {
    return this.purchasePrice || 0;
  },
},
costingMethod: {
  type: String,
  enum: ["fixed", "average"],
  default: "average",  // ⚠️ Por defecto: Promedio
},
```

### Cuándo se Actualiza el Costo Promedio

```javascript
// ProductRepository.js - updateStock (Comentario línea 47-48)
// ℹ️ averageCost intentionally remains unchanged during sales.
// It only updates when NEW inventory is received at a different price.
```

### Fórmula de Actualización

```
Nuevo Costo Promedio = (Stock Actual × Costo Actual + Nuevas Unidades × Nuevo Costo)
                       / (Stock Actual + Nuevas Unidades)
```

---

## 3.4 Transferencias entre Sedes (Branch Transfers)

### Proceso de Transferencia

```javascript
// BranchTransferRepository.js - create()
// 1. Verificar stock en sede origen
const originStock = await BranchStock.findOne({
  branch: originBranchId,
  product: item.productId,
});
if (!originStock || originStock.quantity < item.quantity) {
  throw new Error(`Stock insuficiente para ${product.name}`);
}

// 2. Deducir de origen
originStock.quantity -= item.quantity;
await originStock.save({ session });

// 3. Agregar a destino
let targetStock = await BranchStock.findOne({
  branch: targetBranchId,
  product: item.productId,
});
if (!targetStock) {
  targetStock = await BranchStock.create(
    [
      {
        branch: targetBranchId,
        product: item.productId,
        business: businessId,
        quantity: item.quantity,
      },
    ],
    { session },
  );
} else {
  targetStock.quantity += item.quantity;
  await targetStock.save({ session });
}
```

### ¿Las Transferencias son Inmediatas?

> ✅ **SÍ.** Las transferencias entre sedes se ejecutan en una **transacción atómica** y se completan inmediatamente.

```javascript
// BranchTransferRepository.js - Estado final
const transfer = await BranchTransfer.create(
  [
    {
      // ...
      status: "completed", // ⚠️ Se marca completada inmediatamente
    },
  ],
  { session },
);
```

---

## 3.5 Validación de Stock Suficiente

### Servicio de Dominio

```javascript
// InventoryService.js
static hasSufficientStock(currentStock, quantityRequested) {
  if (typeof currentStock !== "number" || currentStock < 0) return false;
  if (quantityRequested <= 0) return true;
  return currentStock >= quantityRequested;
}

static calculateNewStockLevel(currentStock, changeAmount) {
  const newLevel = currentStock + changeAmount;
  if (newLevel < 0) {
    throw new Error(`Insufficient stock. Current: ${currentStock}`);
  }
  return newLevel;
}
```

---

## 3.6 Diagrama de Flujo de Stock

```
                    ┌─────────────────┐
                    │    PRODUCTO     │
                    │   totalStock    │
                    └────────┬────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
    │   Warehouse   │ │   Branches    │ │  Distributors │
    │warehouseStock │ │  BranchStock  │ │DistributorStock│
    └───────┬───────┘ └───────┬───────┘ └───────┬───────┘
            │                 │                 │
            │    Transferir   │                 │
            │◀────────────────│                 │
            │     Asignar     │                 │
            │─────────────────────────────────▶│
            │                                   │
            ▼                                   ▼
    ┌───────────────┐                   ┌───────────────┐
    │  VENTA ADMIN  │                   │VENTA DISTRIB. │
    │  Deduce WH    │                   │ Deduce DS     │
    └───────────────┘                   └───────────────┘
```

---

# 4. 🛡️ SEGURIDAD Y ROLES

## 4.1 Jerarquía de Roles

```
                    ┌───────────┐
                    │    GOD    │  🔱 Nivel Supremo
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │SUPER_ADMIN│  ⭐ Nivel Sistema
                    └─────┬─────┘
                          │
                    ┌─────▼─────┐
                    │   ADMIN   │  🛠️ Nivel Negocio
                    └─────┬─────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
        ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
        │DISTRIBUIDOR│ │VIEWER │ │   USER    │
        └───────────┘ └───────┘ └───────────┘
```

---

## 4.2 Matriz de Permisos por Rol

### Permisos de ADMIN

```javascript
// permissions.js
admin: {
  products: { read: true, create: true, update: true, delete: true },
  inventory: { read: true, create: true, update: true, delete: true },
  sales: { read: true, create: true, update: true, delete: true },
  promotions: { read: true, create: true, update: true, delete: true },
  providers: { read: true, create: true, update: true, delete: true },
  clients: { read: true, create: true, update: true, delete: true },
  expenses: { read: true, create: true, update: true, delete: true },
  analytics: { read: true, create: true, update: true, delete: true },
  config: { read: true, create: true, update: true, delete: true },
  transfers: { read: true, create: true, update: true, delete: true },
}
```

### Permisos de DISTRIBUIDOR

```javascript
// permissions.js
distribuidor: {
  products: { read: true },          // Solo lectura
  inventory: { read: true },         // Solo lectura
  sales: { read: true, create: true }, // Puede crear ventas
  promotions: { read: true },        // Solo lectura
  providers: { read: false },        // ❌ SIN ACCESO
  clients: { read: false },          // ❌ SIN ACCESO
  expenses: { read: false },         // ❌ SIN ACCESO
  analytics: { read: true },         // Solo lectura
  config: { read: false },           // ❌ SIN ACCESO
  transfers: { read: true, create: true }, // Puede solicitar
}
```

---

## 4.3 LA CEGUERA DEL DISTRIBUIDOR 🔒

### Campos Ocultos para Distribuidores

El distribuidor **NO PUEDE VER** los siguientes campos sensibles:

| Campo                 | Descripción            | Razón de Ocultamiento               |
| --------------------- | ---------------------- | ----------------------------------- |
| `purchasePrice`       | Precio de compra/costo | Información financiera confidencial |
| `averageCost`         | Costo promedio         | Margen de ganancia del admin        |
| `adminProfit`         | Ganancia del admin     | Información financiera confidencial |
| `totalInventoryValue` | Valor del inventario   | Información estratégica             |

### Implementación en API

```javascript
// DistributorRepository.js - getProducts (Línea 343-365)
async getProducts(distributorId, businessId, filters = {}) {
  const [stocks, total] = await Promise.all([
    DistributorStock.find(query)
      .populate("product") // ⚠️ Populate incluye todos los campos
      .skip(skip)
      .limit(limit)
      .lean(),
    DistributorStock.countDocuments(query),
  ]);

  // Nota: El filtrado de campos sensibles debe hacerse en el Controller
  // o usando .select() en el populate
}
```

### Recomendación de Implementación

```javascript
// Populate seguro para distribuidores
.populate("product", "name image distributorPrice clientPrice category")
// Excluye: purchasePrice, averageCost, totalInventoryValue
```

---

## 4.4 Middlewares de Seguridad

### Middleware: protect

```javascript
// auth.middleware.js - Verifica JWT y estado de cuenta
export const protect = async (req, res, next) => {
  // 1. Verificar token
  // 2. Verificar usuario existe
  // 3. Verificar status === "active"
  // 4. Para distribuidores: verificar owner del negocio activo
};
```

### Middleware: businessContext

```javascript
// business.middleware.js - Resuelve contexto de negocio
export const businessContext = async (req, res, next) => {
  // 1. Obtener businessId de header o query
  // 2. Verificar negocio existe
  // 3. Verificar membership del usuario en el negocio
  // 4. Verificar owner activo (para distribuidores)
};
```

### Middleware: requirePermission

```javascript
// business.middleware.js - Verifica permisos granulares
export const requirePermission = ({ module, action }) => {
  return (req, res, next) => {
    // 1. GOD/Super Admin: bypass
    // 2. Construir permisos efectivos del membership
    // 3. Verificar si acción está permitida
    // 4. Verificar acceso a sede si aplica
  };
};
```

---

## 4.5 Herencia de Acceso: Owner → Distribuidor

### Regla Crítica

> Si el **owner/admin** del negocio tiene su cuenta **inactiva o expirada**, todos los **distribuidores** de ese negocio **pierden acceso**.

### Implementación

```javascript
// business.middleware.js - Línea 77-108
if (membership?.role === "distribuidor" && !isGod) {
  // Resolver owner del negocio
  const primaryAdminMembership = await Membership.findOne({
    business: businessId,
    role: "admin",
    status: "active",
  }).sort({ createdAt: 1 });

  const ownerUserId = primaryAdminMembership?.user || business.createdBy;
  const owner = await User.findById(ownerUserId);

  const ownerExpired =
    owner?.subscriptionExpiresAt &&
    new Date(owner.subscriptionExpiresAt).getTime() < Date.now();

  const ownerInactive =
    !owner || !owner.active || owner.status !== "active" || ownerExpired;

  if (ownerInactive) {
    return res.status(403).json({
      message: "El administrador del negocio no tiene acceso activo",
      code: "owner_inactive",
    });
  }
}
```

---

## 4.6 Feature Flags (Activación de Módulos)

### Middleware: requireFeature

```javascript
// business.middleware.js
export const requireFeature = (featureKey) => {
  return (req, res, next) => {
    // Super admin/god: bypass
    if (isSuperAdmin || isGod) return next();

    const isEnabled = req.business?.config?.features?.[featureKey];
    // Si no está definido, asumir habilitado
    if (isEnabled !== false) return next();

    return res.status(403).json({
      message: "Funcionalidad desactivada para este negocio",
    });
  };
};
```

---

# 5. 📎 ANEXOS TÉCNICOS

## 5.1 Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                        FRONTEND                              │
│                   (React + TailwindCSS)                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     API REST (Express)                       │
├─────────────────────────────────────────────────────────────┤
│  Routes → Controllers → Use Cases → Services → Repositories │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       MongoDB                                │
└─────────────────────────────────────────────────────────────┘
```

## 5.2 Estructura de Carpetas Clave

```
server/
├── src/
│   ├── application/
│   │   └── use-cases/          # Lógica de aplicación
│   │       ├── RegisterSaleUseCase.js
│   │       ├── RegisterUserUseCase.js
│   │       └── UpdateStockUseCase.js
│   ├── domain/
│   │   └── services/           # Servicios de dominio puros
│   │       ├── FinanceService.js
│   │       ├── InventoryService.js
│   │       └── AuthService.js
│   └── infrastructure/
│       ├── database/
│       │   ├── models/         # Modelos Mongoose
│       │   └── repositories/   # Acceso a datos
│       └── http/
│           ├── controllers/    # Controladores HTTP
│           └── routes/         # Rutas Express
├── middleware/                 # Middlewares Express
├── models/                     # Modelos legacy
└── utils/                      # Utilidades
```

## 5.3 Modelos de Datos Principales

| Modelo             | Propósito                | Relaciones Clave          |
| ------------------ | ------------------------ | ------------------------- |
| `User`             | Usuarios del sistema     | Business (via Membership) |
| `Business`         | Empresas/Negocios        | Users, Products, Sales    |
| `Membership`       | Relación User↔Business   | User, Business            |
| `Product`          | Productos del inventario | Business, Category        |
| `Sale`             | Registros de ventas      | Business, Product, User   |
| `DistributorStock` | Stock por distribuidor   | User, Product, Business   |
| `BranchStock`      | Stock por sede           | Branch, Product, Business |
| `Branch`           | Sedes/Sucursales         | Business                  |
| `Credit`           | Créditos/Fiados          | Customer, Business        |
| `Expense`          | Gastos del negocio       | Business                  |
| `Customer`         | Clientes                 | Business                  |

## 5.4 Índices de Base de Datos Críticos

### Sale Model

```javascript
saleSchema.index({ business: 1, saleDate: -1 });
saleSchema.index({ business: 1, paymentStatus: 1, saleDate: -1 });
saleSchema.index({ business: 1, saleId: 1 }, { unique: true });
```

### DistributorStock Model

```javascript
distributorStockSchema.index(
  { business: 1, distributor: 1, product: 1 },
  { unique: true },
);
```

---

## 5.5 Checklist de Verificación de Lógica de Negocio

### ✅ Flujo de Usuarios

- [ ] Usuario nuevo inicia en `status: "pending"`
- [ ] Solo `god` puede activar cuentas
- [ ] Distribuidores heredan estado del owner

### ✅ Cálculos Financieros

- [ ] Comisión default es 20%
- [ ] Ventas a crédito no cuentan hasta confirmarse
- [ ] Ganancia neta resta envío, costos adicionales y descuentos

### ✅ Inventario

- [ ] Venta admin deduce de `warehouseStock`
- [ ] Venta distribuidor deduce de `DistributorStock`
- [ ] Transferencias son inmediatas

### ✅ Seguridad

- [ ] Distribuidor no ve `purchasePrice`, `averageCost`, `adminProfit`
- [ ] Feature flags respetados
- [ ] Permisos granulares por módulo/acción

---

> **Documento generado automáticamente a partir del análisis del código fuente.**  
> **Para actualizaciones, volver a ejecutar el análisis.**

---

_Fin del Manual Sagrado de Essence_
