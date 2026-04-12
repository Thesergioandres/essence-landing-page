# ðŸ“˜ DOCUMENTACIÃ“N MAESTRA ESSENCE

## _"El Manual Sagrado"_

> **Fecha de GeneraciÃ³n:** 2 de Febrero de 2026  
> **VersiÃ³n del Sistema:** Essence Business Management Platform  
> **PropÃ³sito:** Documento definitivo que explica la lÃ³gica de negocio, fÃ³rmulas matemÃ¡ticas, flujos de usuario y reglas invisibles del sistema.

---

# ðŸ“‘ ÃNDICE

1. [El Flujo de Vida del Negocio](#1--el-flujo-de-vida-del-negocio-the-golden-flow)
2. [El NÃºcleo MatemÃ¡tico](#2--el-nÃºcleo-matemÃ¡tico-financial-logic)
3. [LÃ³gica de Inventario](#3--lÃ³gica-de-inventario-inventory-rules)
4. [Seguridad y Roles](#4-ï¸-seguridad-y-roles)
5. [Anexos TÃ©cnicos](#5--anexos-tÃ©cnicos)

---

# 1. ðŸ”„ EL FLUJO DE VIDA DEL NEGOCIO (The Golden Flow)

## 1.1 Diagrama del Ciclo de Vida

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚   REGISTRO  â”‚â”€â”€â”€â–¶â”‚  APROBACIÃ“N â”‚â”€â”€â”€â–¶â”‚CONFIGURACIÃ“Nâ”‚â”€â”€â”€â–¶â”‚  OPERACIÃ“N  â”‚
â”‚   Usuario   â”‚    â”‚    GOD      â”‚    â”‚   Negocio   â”‚    â”‚    Diaria   â”‚
â”‚  (pending)  â”‚    â”‚  (active)   â”‚    â”‚             â”‚    â”‚             â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                                                â”‚
                   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”           â”‚
                   â”‚  ASIGNACIÃ“N â”‚â—€â”€â”€â”€â”‚  EXPANSIÃ“N  â”‚â—€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                   â”‚   de Stock  â”‚    â”‚   Sedes &   â”‚
                   â”‚             â”‚    â”‚Empleadosâ”‚
                   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 1.2 Etapa 1: REGISTRO DE USUARIO

### DescripciÃ³n

Cuando un usuario nuevo se registra en la plataforma, se crea con estado `pending` y no puede operar hasta ser aprobado.

### UbicaciÃ³n en CÃ³digo

- **Archivo:** `server/src/application/use-cases/RegisterUserUseCase.js`
- **Modelo:** `server/src/infrastructure/database/models/User.js`

### Estados de Usuario Disponibles

| Estado      | DescripciÃ³n                          | Puede Operar |
| ----------- | ------------------------------------ | ------------ |
| `pending`   | ReciÃ©n registrado, espera aprobaciÃ³n | âŒ No        |
| `active`    | Cuenta activa y operativa            | âœ… SÃ­        |
| `expired`   | SuscripciÃ³n vencida                  | âŒ No        |
| `suspended` | Suspendido por administraciÃ³n        | âŒ No        |
| `paused`    | Pausado temporalmente                | âŒ No        |

### Flujo de Registro (CÃ³digo Real)

```javascript
// RegisterUserUseCase.js - LÃ­neas clave
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
  default: "pending",  // âš ï¸ IMPORTANTE: Siempre inicia pendiente
},
subscriptionExpiresAt: {
  type: Date,
  default: null,
},
```

---

## 1.3 Etapa 2: APROBACIÃ“N GOD

### DescripciÃ³n

Solo usuarios con rol `god` pueden activar cuentas. El sistema verifica el estado en cada peticiÃ³n.

### Roles del Sistema

| Rol            | Nivel        | DescripciÃ³n                               |
| -------------- | ------------ | ----------------------------------------- |
| `god`          | ðŸ”± Supremo   | Control total del sistema, activa cuentas |
| `super_admin`  | â­ Alto      | Administrador general de negocios         |
| `admin`        | ðŸ› ï¸ Medio     | Administrador dentro de un negocio        |
| `empleado` | ðŸ“¦ Operativo | Vendedor con stock asignado               |
| `user`         | ðŸ‘¤ BÃ¡sico    | Usuario estÃ¡ndar                          |

### Middleware de ProtecciÃ³n

```javascript
// auth.middleware.js - LÃ­nea 119-128
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
// auth.middleware.js - LÃ­nea 38-41
if (owner.role === "god") {
  console.warn("[Essence Debug]", "âœ… GOD BYPASS ACTIVATED");
  return { hasAccess: true };
}
```

---

## 1.4 Etapa 3: CONFIGURACIÃ“N DEL NEGOCIO

### Secuencia de ConfiguraciÃ³n Requerida

```
1. Crear Empresa (Business)
      â†“
2. Crear CategorÃ­as
      â†“
3. Crear Productos
      â†“
4. Configurar MÃ©todos de Pago
      â†“
5. Configurar MÃ©todos de Entrega
      â†“
6. Registrar Clientes
```

### Modelo Business (Empresa)

```javascript
// Business.js - Estructura principal
{
  name: String,           // Nombre Ãºnico
  description: String,
  logoUrl: String,
  contactEmail: String,
  contactPhone: String,
  contactWhatsapp: String,
  contactLocation: String,
  config: {
    features: {           // Feature Flags (activar/desactivar mÃ³dulos)
      products: Boolean,
      inventory: Boolean,
      sales: Boolean,
      promotions: Boolean,
      providers: Boolean,
      clients: Boolean,
      gamification: Boolean,
      expenses: Boolean,
      employees: Boolean,
      rankings: Boolean,
      branches: Boolean,
      credits: Boolean,
      customers: Boolean,
      // ... mÃ¡s features
    }
  },
  createdBy: ObjectId,    // Usuario que creÃ³ el negocio (owner)
  status: "active" | "archived"
}
```

---

## 1.5 Etapa 4: OPERACIÃ“N DIARIA

### Flujo de una Venta

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  Seleccionar â”‚â”€â”€â”€â”€â–¶â”‚   Validar    â”‚â”€â”€â”€â”€â–¶â”‚   Calcular   â”‚
â”‚   Productos  â”‚     â”‚    Stock     â”‚     â”‚   Finanzas   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                                                  â”‚
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”     â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”             â”‚
â”‚   Registrar  â”‚â—€â”€â”€â”€â”€â”‚   Deducir    â”‚â—€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â”‚    Venta     â”‚     â”‚    Stock     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜     â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 1.6 Etapa 5: EXPANSIÃ“N (Sedes y Empleados)

### CreaciÃ³n de Sedes (Branches)

```javascript
// Branch.js - Modelo
{
  business: ObjectId,     // A quÃ© negocio pertenece
  name: String,
  address: String,
  contactName: String,
  contactPhone: String,
  timezone: "America/Bogota",
  isWarehouse: Boolean,   // Â¿Es la bodega principal?
  active: Boolean
}
```

### CreaciÃ³n de Empleados

```javascript
// EmployeeRepository.js - Proceso de creaciÃ³n
const employee = await User.create({
  name: data.name,
  email: data.email,
  password: hashedPassword,
  phone: data.phone,
  address: data.address,
  role: "empleado",
  status: "active", // âš ï¸ Empleados se activan inmediatamente
  active: true,
});

// Crear membership (membresÃ­a) en el negocio
await Membership.findOneAndUpdate(
  { user: employee._id, business: businessId },
  { role: "empleado", status: "active" },
  { upsert: true, new: true },
);
```

---

## 1.7 Etapa 6: ASIGNACIÃ“N DE STOCK A EMPLEADOS

### Proceso de Transferencia

```javascript
// StockRepository.js - assignToEmployee
async assignToEmployee(businessId, employeeId, productId, quantity) {
  // 1. Verificar stock en bodega
  const product = await Product.findOne({ _id: productId, business: businessId });
  if (!product || product.warehouseStock < quantity) {
    throw new Error("Stock insuficiente");
  }

  // 2. Crear o actualizar stock del empleado
  let distStock = await EmployeeStock.findOne({
    employee: employeeId,
    product: productId,
    business: businessId,
  });

  if (distStock) {
    distStock.quantity += quantity;
    await distStock.save();
  } else {
    distStock = await EmployeeStock.create({
      employee: employeeId,
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
  const user = await User.findById(employeeId);
  if (user && !user.assignedProducts.includes(productId)) {
    user.assignedProducts.push(productId);
    await user.save();
  }
}
```

### Transferencias Inmediatas âœ…

> **CONFIRMADO:** Las transferencias de stock son **inmediatas**. No hay estado "pendiente" para asignaciones de bodega a empleado.

---

# 2. ðŸ§® EL NÃšCLEO MATEMÃTICO (Financial Logic)

## 2.1 Arquitectura Financiera

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                   REGISTRO DE VENTA                       â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  FinanceService.js         RegisterSaleUseCase.js        â”‚
â”‚  (CÃ¡lculos Puros)          (OrquestaciÃ³n)                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                              â†“
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                   FÃ“RMULAS MAESTRAS                       â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  â€¢ Precio Empleado = PrecioVenta Ã— (100 - %Com)/100  â”‚
â”‚  â€¢ Ganancia Dist = (PrecioVenta - PrecioDist) Ã— Cantidad â”‚
â”‚  â€¢ Ganancia Admin = Venta - Costo - GananciaDist         â”‚
â”‚  â€¢ Ganancia Neta = TotalProfit - EnvÃ­o - CostosExtra     â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 2.2 FÃ“RMULA: Precio para Empleado

### DefiniciÃ³n

El **Precio Empleado** es lo que el empleado "paga" al admin por cada unidad.

### FÃ³rmula Exacta

```
Precio Empleado = Precio Venta Ã— (100 - ComisiÃ³n%) / 100
```

### CÃ³digo Fuente

```javascript
// FinanceService.js - LÃ­nea 11-17
static calculateEmployeePrice(salePrice, profitPercentage) {
  if (salePrice < 0) throw new Error("Sale price cannot be negative");
  const percentage = profitPercentage || 20; // Default: 20%
  return salePrice * ((100 - percentage) / 100);
}
```

### Ejemplo PrÃ¡ctico

| Concepto                | Valor                        |
| ----------------------- | ---------------------------- |
| Precio de Venta         | $22,000                      |
| ComisiÃ³n Empleado   | 20%                          |
| **Precio Empleado** | $22,000 Ã— 0.80 = **$17,600** |

> ðŸ’¡ **InterpretaciÃ³n:** El empleado "le paga" $17,600 al admin por cada unidad vendida a $22,000.

---

## 2.3 FÃ“RMULA: Ganancia del Empleado

### DefiniciÃ³n

La ganancia del empleado es su **comisiÃ³n** por vender el producto.

### FÃ³rmula Exacta

```
Ganancia Empleado = (Precio Venta - Precio Empleado) Ã— Cantidad
```

### CÃ³digo Fuente

```javascript
// FinanceService.js - LÃ­nea 24-27
static calculateEmployeeProfit(salePrice, employeePrice, quantity) {
  return (salePrice - employeePrice) * quantity;
}
```

### Ejemplo PrÃ¡ctico (ContinuaciÃ³n)

| Concepto                  | Valor                                 |
| ------------------------- | ------------------------------------- |
| Precio de Venta           | $22,000                               |
| Precio Empleado       | $17,600                               |
| Cantidad                  | 3 unidades                            |
| **Ganancia Empleado** | ($22,000 - $17,600) Ã— 3 = **$13,200** |

---

## 2.4 FÃ“RMULA: Ganancia del Administrador

### DefiniciÃ³n

La ganancia del admin es lo que queda **despuÃ©s de restar el costo del producto y la comisiÃ³n del empleado**.

### FÃ³rmula Exacta

```
Ganancia Admin = (Precio Venta Ã— Cantidad) - (Costo Ã— Cantidad) - Ganancia Empleado
```

### CÃ³digo Fuente

```javascript
// FinanceService.js - LÃ­nea 35-44
static calculateAdminProfit(salePrice, costBasis, employeeProfit, quantity) {
  const totalRevenue = salePrice * quantity;
  const totalCost = costBasis * quantity;
  // Revenue - Cost - EmployeeShare
  return totalRevenue - totalCost - employeeProfit;
}
```

### Ejemplo PrÃ¡ctico (ContinuaciÃ³n)

| Concepto                 | Valor                                                 |
| ------------------------ | ----------------------------------------------------- |
| Precio de Venta          | $22,000                                               |
| Costo Base (averageCost) | $10,500                                               |
| Cantidad                 | 3 unidades                                            |
| Ganancia Empleado    | $13,200                                               |
| **Ganancia Admin**       | ($22,000 Ã— 3) - ($10,500 Ã— 3) - $13,200 = **$21,300** |

**Desglose:**

- Ingreso Total: $66,000
- Costo Total: $31,500
- ComisiÃ³n Empleado: $13,200
- Ganancia Admin: $66,000 - $31,500 - $13,200 = **$21,300**

---

## 2.5 FÃ“RMULA: Ganancia Neta

### DefiniciÃ³n

La ganancia neta considera **todos los costos adicionales**.

### FÃ³rmula Exacta

```
Ganancia Neta = Total Profit - Costo EnvÃ­o - Costos Adicionales - Descuento
```

### CÃ³digo Fuente

```javascript
// FinanceService.js - LÃ­nea 52-58
static calculateNetProfit(totalProfit, shippingCost = 0, additionalCosts = 0, discount = 0) {
  return totalProfit - shippingCost - additionalCosts - discount;
}
```

### Pre-Save Hook en Sale.js

```javascript
// Sale.js - LÃ­nea 340-345
const totalExtraCosts = this.totalAdditionalCosts + (this.shippingCost || 0);
this.netProfit = this.totalProfit - totalExtraCosts - (this.discount || 0);
```

---

## 2.6 SISTEMA DE COMISIONES POR RANKING

### Tabla de Comisiones

| PosiciÃ³n    | Porcentaje Base | DescripciÃ³n   |
| ----------- | --------------- | ------------- |
| ðŸ¥‡ 1Âº lugar | 25%             | Top performer |
| ðŸ¥ˆ 2Âº lugar | 23%             | Second best   |
| ðŸ¥‰ 3Âº lugar | 21%             | Third place   |
| ðŸ“¦ Resto    | 20%             | EstÃ¡ndar      |

### CÃ³digo de Referencia

```javascript
// Sale.js - Pre-save hook, LÃ­nea 313-325
// El empleado recibe una comisiÃ³n sobre el precio de venta segÃºn su ranking
// ðŸ¥‡ 1Âº: 25%, ðŸ¥ˆ 2Âº: 23%, ðŸ¥‰ 3Âº: 21%, Resto: 20%
const profitPercentage = this.employeeProfitPercentage || 20;
```

---

## 2.7 VENTAS A CRÃ‰DITO (FIADO): Regla de ContabilizaciÃ³n

### Regla de Oro ðŸ’°

> **Las ventas a crÃ©dito NO cuentan como ingreso/ganancia hasta que son CONFIRMADAS (pagadas).**

### Estados de Pago

| Estado       | Cuenta en MÃ©tricas | DescripciÃ³n                     |
| ------------ | ------------------ | ------------------------------- |
| `pendiente`  | âŒ NO              | Venta registrada pero no pagada |
| `confirmado` | âœ… SÃ              | Venta pagada y confirmada       |

### ImplementaciÃ³n en RegisterSaleUseCase.js

```javascript
// RegisterSaleUseCase.js - LÃ­nea 173-178
const saleData = {
  // ... otros campos
  paymentStatus: paymentMethodId === "credit" ? "pendiente" : "confirmado",
  paymentConfirmedAt: paymentMethodId === "credit" ? null : new Date(),
};
```

### AgregaciÃ³n en Analytics (Solo Confirmadas)

```javascript
// AnalyticsRepository.js - getDashboardKPIs
totalRevenue: {
  $sum: {
    $cond: [
      { $eq: ["$paymentStatus", "confirmado"] }, // âš ï¸ SOLO CONFIRMADAS
      "$salePrice",
      0,
    ],
  },
},
totalProfit: {
  $sum: {
    $cond: [
      { $eq: ["$paymentStatus", "confirmado"] }, // âš ï¸ SOLO CONFIRMADAS
      { $ifNull: ["$netProfit", "$totalProfit"] },
      0,
    ],
  },
},
```

---

## 2.8 UTILIDAD NETA (Con Gastos)

### FÃ³rmula Completa

```
Utilidad Neta del PerÃ­odo = Î£(Ganancias Netas de Ventas Confirmadas) - Î£(Gastos del PerÃ­odo)
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

## 2.9 TABLA RESUMEN DE FÃ“RMULAS

| MÃ©trica                   | FÃ³rmula                                 | Archivo              |
| ------------------------- | --------------------------------------- | -------------------- |
| **Precio Empleado**   | `PV Ã— (100 - Com%) / 100`               | FinanceService.js:14 |
| **Ganancia Empleado** | `(PV - PD) Ã— Qty`                       | FinanceService.js:25 |
| **Ganancia Admin**        | `(PV Ã— Qty) - (Costo Ã— Qty) - GanDist`  | FinanceService.js:40 |
| **Ganancia Total**        | `GanAdmin + GanDist`                    | Sale.js:335          |
| **Ganancia Neta**         | `TotalProfit - EnvÃ­o - CostosAd - Desc` | Sale.js:342          |
| **% Rentabilidad**        | `(NetProfit / TotalSale) Ã— 100`         | Sale.js:349          |
| **% Costo**               | `(CostoBase / PrecioVenta) Ã— 100`       | Sale.js:350          |

---

# 3. ðŸ“¦ LÃ“GICA DE INVENTARIO (Inventory Rules)

## 3.1 Estructura de Inventario

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                    PRODUCTO (Product)                        â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  totalStock        â†’  Stock total (contador global)         â”‚
â”‚  warehouseStock    â†’  Stock en bodega (disponible admin)    â”‚
â”‚  averageCost       â†’  Costo promedio ponderado              â”‚
â”‚  totalInventoryValue â†’ Valor total del inventario           â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
          â”‚                         â”‚
          â–¼                         â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”       â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  BranchStock    â”‚       â”‚EmployeeStock â”‚
â”‚  (Por Sede)     â”‚       â”‚(Por Empleado)â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜       â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

## 3.2 Regla de DeducciÃ³n de Stock

### Venta del Administrador (Admin Sale)

```javascript
// RegisterSaleUseCase.js - LÃ­nea 134-145
if (!employeeId) {
  // Admin Sale â†’ Deduct from Warehouse
  await this.productRepository.updateWarehouseStock(
    productId,
    -quantity,
    session,
  );
  console.warn("[Essence Debug]", `ðŸ“¦ Deducted ${quantity} from Warehouse (admin sale)`);
}
```

**Flujo:**

```
Venta Admin â†’ Deduce de warehouseStock â†’ Actualiza totalStock
```

### Venta del Empleado (Employee Sale)

```javascript
// RegisterSaleUseCase.js - LÃ­nea 123-133
if (employeeId) {
  // Employee Sale â†’ Deduct from EmployeeStock
  const distStock = await EmployeeStock.findOneAndUpdate(
    { business: businessId, employee: employeeId, product: productId },
    { $inc: { quantity: -quantity } },
    session ? { session, new: true } : { new: true },
  );
  console.warn("[Essence Debug]", `ðŸ“¦ Deducted ${quantity} from EmployeeStock`);
}
```

**Flujo:**

```
Venta Empleado â†’ Deduce de EmployeeStock â†’ Actualiza totalStock
```

---

## 3.3 Costo Promedio Ponderado (WAC - Weighted Average Cost)

### DefiniciÃ³n

El sistema utiliza el mÃ©todo de **Costo Promedio Ponderado** para valorar el inventario.

### ConfiguraciÃ³n por Producto

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
  default: "average",  // âš ï¸ Por defecto: Promedio
},
```

### CuÃ¡ndo se Actualiza el Costo Promedio

```javascript
// ProductRepository.js - updateStock (Comentario lÃ­nea 47-48)
// â„¹ï¸ averageCost intentionally remains unchanged during sales.
// It only updates when NEW inventory is received at a different price.
```

### FÃ³rmula de ActualizaciÃ³n

```
Nuevo Costo Promedio = (Stock Actual Ã— Costo Actual + Nuevas Unidades Ã— Nuevo Costo)
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

### Â¿Las Transferencias son Inmediatas?

> âœ… **SÃ.** Las transferencias entre sedes se ejecutan en una **transacciÃ³n atÃ³mica** y se completan inmediatamente.

```javascript
// BranchTransferRepository.js - Estado final
const transfer = await BranchTransfer.create(
  [
    {
      // ...
      status: "completed", // âš ï¸ Se marca completada inmediatamente
    },
  ],
  { session },
);
```

---

## 3.5 ValidaciÃ³n de Stock Suficiente

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
                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                    â”‚    PRODUCTO     â”‚
                    â”‚   totalStock    â”‚
                    â””â”€â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                             â”‚
            â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
            â”‚                â”‚                â”‚
            â–¼                â–¼                â–¼
    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
    â”‚   Warehouse   â”‚ â”‚   Branches    â”‚ â”‚  Employees â”‚
    â”‚warehouseStock â”‚ â”‚  BranchStock  â”‚ â”‚EmployeeStockâ”‚
    â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”€â”€â”˜
            â”‚                 â”‚                 â”‚
            â”‚    Transferir   â”‚                 â”‚
            â”‚â—€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”‚                 â”‚
            â”‚     Asignar     â”‚                 â”‚
            â”‚â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â–¶â”‚
            â”‚                                   â”‚
            â–¼                                   â–¼
    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”                   â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
    â”‚  VENTA ADMIN  â”‚                   â”‚VENTA DISTRIB. â”‚
    â”‚  Deduce WH    â”‚                   â”‚ Deduce DS     â”‚
    â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜                   â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

---

# 4. ðŸ›¡ï¸ SEGURIDAD Y ROLES

## 4.1 JerarquÃ­a de Roles

```
                    â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
                    â”‚    GOD    â”‚  ðŸ”± Nivel Supremo
                    â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜
                          â”‚
                    â”Œâ”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”
                    â”‚SUPER_ADMINâ”‚  â­ Nivel Sistema
                    â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜
                          â”‚
                    â”Œâ”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”
                    â”‚   ADMIN   â”‚  ðŸ› ï¸ Nivel Negocio
                    â””â”€â”€â”€â”€â”€â”¬â”€â”€â”€â”€â”€â”˜
                          â”‚
              â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¼â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
              â”‚           â”‚           â”‚
        â”Œâ”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â” â”Œâ”€â”€â”€â–¼â”€â”€â”€â” â”Œâ”€â”€â”€â”€â”€â–¼â”€â”€â”€â”€â”€â”
        â”‚EMPLEADOâ”‚ â”‚VIEWER â”‚ â”‚   USER    â”‚
        â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”˜ â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
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

### Permisos de EMPLEADO

```javascript
// permissions.js
empleado: {
  products: { read: true },          // Solo lectura
  inventory: { read: true },         // Solo lectura
  sales: { read: true, create: true }, // Puede crear ventas
  promotions: { read: true },        // Solo lectura
  providers: { read: false },        // âŒ SIN ACCESO
  clients: { read: false },          // âŒ SIN ACCESO
  expenses: { read: false },         // âŒ SIN ACCESO
  analytics: { read: true },         // Solo lectura
  config: { read: false },           // âŒ SIN ACCESO
  transfers: { read: true, create: true }, // Puede solicitar
}
```

---

## 4.3 LA CEGUERA DEL EMPLEADO ðŸ”’

### Campos Ocultos para Empleados

El empleado **NO PUEDE VER** los siguientes campos sensibles:

| Campo                 | DescripciÃ³n            | RazÃ³n de Ocultamiento               |
| --------------------- | ---------------------- | ----------------------------------- |
| `purchasePrice`       | Precio de compra/costo | InformaciÃ³n financiera confidencial |
| `averageCost`         | Costo promedio         | Margen de ganancia del admin        |
| `adminProfit`         | Ganancia del admin     | InformaciÃ³n financiera confidencial |
| `totalInventoryValue` | Valor del inventario   | InformaciÃ³n estratÃ©gica             |

### ImplementaciÃ³n en API

```javascript
// EmployeeRepository.js - getProducts (LÃ­nea 343-365)
async getProducts(employeeId, businessId, filters = {}) {
  const [stocks, total] = await Promise.all([
    EmployeeStock.find(query)
      .populate("product") // âš ï¸ Populate incluye todos los campos
      .skip(skip)
      .limit(limit)
      .lean(),
    EmployeeStock.countDocuments(query),
  ]);

  // Nota: El filtrado de campos sensibles debe hacerse en el Controller
  // o usando .select() en el populate
}
```

### RecomendaciÃ³n de ImplementaciÃ³n

```javascript
// Populate seguro para empleados
.populate("product", "name image employeePrice clientPrice category")
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
  // 4. Para empleados: verificar owner del negocio activo
};
```

### Middleware: businessContext

```javascript
// business.middleware.js - Resuelve contexto de negocio
export const businessContext = async (req, res, next) => {
  // 1. Obtener businessId de header o query
  // 2. Verificar negocio existe
  // 3. Verificar membership del usuario en el negocio
  // 4. Verificar owner activo (para empleados)
};
```

### Middleware: requirePermission

```javascript
// business.middleware.js - Verifica permisos granulares
export const requirePermission = ({ module, action }) => {
  return (req, res, next) => {
    // 1. GOD/Super Admin: bypass
    // 2. Construir permisos efectivos del membership
    // 3. Verificar si acciÃ³n estÃ¡ permitida
    // 4. Verificar acceso a sede si aplica
  };
};
```

---

## 4.5 Herencia de Acceso: Owner â†’ Empleado

### Regla CrÃ­tica

> Si el **owner/admin** del negocio tiene su cuenta **inactiva o expirada**, todos los **empleados** de ese negocio **pierden acceso**.

### ImplementaciÃ³n

```javascript
// business.middleware.js - LÃ­nea 77-108
if (membership?.role === "empleado" && !isGod) {
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

## 4.6 Feature Flags (ActivaciÃ³n de MÃ³dulos)

### Middleware: requireFeature

```javascript
// business.middleware.js
export const requireFeature = (featureKey) => {
  return (req, res, next) => {
    // Super admin/god: bypass
    if (isSuperAdmin || isGod) return next();

    const isEnabled = req.business?.config?.features?.[featureKey];
    // Si no estÃ¡ definido, asumir habilitado
    if (isEnabled !== false) return next();

    return res.status(403).json({
      message: "Funcionalidad desactivada para este negocio",
    });
  };
};
```

---

# 5. ðŸ“Ž ANEXOS TÃ‰CNICOS

## 5.1 Arquitectura del Sistema

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                        FRONTEND                              â”‚
â”‚                   (React + TailwindCSS)                      â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                              â”‚
                              â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                     API REST (Express)                       â”‚
â”œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”¤
â”‚  Routes â†’ Controllers â†’ Use Cases â†’ Services â†’ Repositories â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
                              â”‚
                              â–¼
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚                       MongoDB                                â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
```

## 5.2 Estructura de Carpetas Clave

```
server/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ application/
â”‚   â”‚   â””â”€â”€ use-cases/          # LÃ³gica de aplicaciÃ³n
â”‚   â”‚       â”œâ”€â”€ RegisterSaleUseCase.js
â”‚   â”‚       â”œâ”€â”€ RegisterUserUseCase.js
â”‚   â”‚       â””â”€â”€ UpdateStockUseCase.js
â”‚   â”œâ”€â”€ domain/
â”‚   â”‚   â””â”€â”€ services/           # Servicios de dominio puros
â”‚   â”‚       â”œâ”€â”€ FinanceService.js
â”‚   â”‚       â”œâ”€â”€ InventoryService.js
â”‚   â”‚       â””â”€â”€ AuthService.js
â”‚   â””â”€â”€ infrastructure/
â”‚       â”œâ”€â”€ database/
â”‚       â”‚   â”œâ”€â”€ models/         # Modelos Mongoose
â”‚       â”‚   â””â”€â”€ repositories/   # Acceso a datos
â”‚       â””â”€â”€ http/
â”‚           â”œâ”€â”€ controllers/    # Controladores HTTP
â”‚           â””â”€â”€ routes/         # Rutas Express
â”œâ”€â”€ middleware/                 # Middlewares Express
â”œâ”€â”€ models/                     # Modelos legacy
â””â”€â”€ utils/                      # Utilidades
```

## 5.3 Modelos de Datos Principales

| Modelo             | PropÃ³sito                | Relaciones Clave          |
| ------------------ | ------------------------ | ------------------------- |
| `User`             | Usuarios del sistema     | Business (via Membership) |
| `Business`         | Empresas/Negocios        | Users, Products, Sales    |
| `Membership`       | RelaciÃ³n Userâ†”Business   | User, Business            |
| `Product`          | Productos del inventario | Business, Category        |
| `Sale`             | Registros de ventas      | Business, Product, User   |
| `EmployeeStock` | Stock por empleado   | User, Product, Business   |
| `BranchStock`      | Stock por sede           | Branch, Product, Business |
| `Branch`           | Sedes/Sucursales         | Business                  |
| `Credit`           | CrÃ©ditos/Fiados          | Customer, Business        |
| `Expense`          | Gastos del negocio       | Business                  |
| `Customer`         | Clientes                 | Business                  |

## 5.4 Ãndices de Base de Datos CrÃ­ticos

### Sale Model

```javascript
saleSchema.index({ business: 1, saleDate: -1 });
saleSchema.index({ business: 1, paymentStatus: 1, saleDate: -1 });
saleSchema.index({ business: 1, saleId: 1 }, { unique: true });
```

### EmployeeStock Model

```javascript
employeeStockSchema.index(
  { business: 1, employee: 1, product: 1 },
  { unique: true },
);
```

---

## 5.5 Checklist de VerificaciÃ³n de LÃ³gica de Negocio

### âœ… Flujo de Usuarios

- [ ] Usuario nuevo inicia en `status: "pending"`
- [ ] Solo `god` puede activar cuentas
- [ ] Empleados heredan estado del owner

### âœ… CÃ¡lculos Financieros

- [ ] ComisiÃ³n default es 20%
- [ ] Ventas a crÃ©dito no cuentan hasta confirmarse
- [ ] Ganancia neta resta envÃ­o, costos adicionales y descuentos

### âœ… Inventario

- [ ] Venta admin deduce de `warehouseStock`
- [ ] Venta empleado deduce de `EmployeeStock`
- [ ] Transferencias son inmediatas

### âœ… Seguridad

- [ ] Empleado no ve `purchasePrice`, `averageCost`, `adminProfit`
- [ ] Feature flags respetados
- [ ] Permisos granulares por mÃ³dulo/acciÃ³n

---

> **Documento generado automÃ¡ticamente a partir del anÃ¡lisis del cÃ³digo fuente.**  
> **Para actualizaciones, volver a ejecutar el anÃ¡lisis.**

---

_Fin del Manual Sagrado de Essence_

