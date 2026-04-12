# 🎭 ESPECIFICACIÓN: CASOS DE USO EXTENDIDOS

> **Propósito:** Definir de manera metódica los actores e interacciones principales mediante el estándar UML, desglosando los flujos primarios, alternativos y de excepción.

## 1. Diagrama General de Actores

```mermaid
usecaseDiagram
  actor "Administrador (Owner)" as Admin
  actor "Empleado" as Dist
  actor "GOD (Superadmin)" as God
  
  package "Essence ERP" {
    usecase "Aprobar Cuenta" as UC1
    usecase "Crear Producto" as UC2
    usecase "Asignar Stock" as UC3
    usecase "Registrar Venta" as UC4
    usecase "Consultar Finanzas" as UC5
    usecase "Realizar Transferencia" as UC6
  }
  
  God --> UC1
  Admin --> UC2
  Admin --> UC3
  Admin --> UC4
  Admin --> UC5
  Admin --> UC6
  Dist --> UC4
  Dist --> UC5
```

---

## 2. Detalle de Casos de Uso Críticos

### 🛒 CU-04A: Registrar Venta (Como Administrador)
* **Actor:** Administrador (Owner).
* **Precondiciones:** JWT válido, suscripción de negocio activa, producto con stock > 0 en `warehouseStock`.
* **Flujo Principal (Happy Path):**
  1. El Administrador añade N productos al carrito en el POS.
  2. Selecciona método de pago "Efectivo".
  3. El sistema valida stock suficiente en `warehouseStock`.
  4. El sistema ejecuta descuento atómico en base de datos.
  5. El sistema (`FinanceService`) calcula Ganancia = Precio Venta - Costo.
  6. Se guarda el ticket de venta en estado "confirmado".
  7. El sistema arroja éxito HTTP 201 al cliente.
* **Flujos Alternativos:**
  * **(3.A)** El producto no tiene stock: Se aborta la operación y se arroja alerta (`Stock Insuficiente`).
  * **(2.A)** Método de pago "Crédito": El paso 6 cambia a estado `"pendiente"` y no se suma a métricas financieras.

### 💼 CU-04B: Registrar Venta (Como Empleado)
* **Actor:** Empleado.
* **Precondiciones:** JWT válido, y la cuenta del Administrador (Owner del Negocio) debe estar ACTIVA y sin expirar.
* **Flujo Principal:**
  1. El Empleado entra al POS en su móvil.
  2. El catálogo *solo* expone productos donde él tenga `EmployeeStock` > 0.
  3. Ejecuta orden de compra de N productos.
  4. El sistema deduce el stock *exclusivamente* del `EmployeeStock` (NO de `warehouseStock`).
  5. `FinanceService` calcula el % de comisión sobre la base del ranking operativo.
  6. Retorna Ticket donde se revela su comisión ganada pero sin revelar los costos nativos del Owner.
* **Flujos de Excepción:**
  * **(Pre-1)** La cuenta del Owner expiró: Cierre de sesión forzado del Empleado con mensaje "Su administrador no posee servicio activo".

### 📦 CU-03: Asignar Stock Atómico
* **Actor:** Administrador (Owner).
* **Precondiciones:** `warehouseStock` suficiente.
* **Flujo Principal:**
  1. El Admin elige un Empleado y asigna 100 unidades de "Producto X".
  2. Se inicia una Transacción de BD (Transaction Session).
  3. Se deducen 100 unidades de `Product.warehouseStock`.
  4. Se crea o actualiza `EmployeeStock` agregando 100 unidades.
  5. Se consolida transacción y ambas mutaciones aplican.
* **Flujo Alternativo:**
  * **(3.Error)** El servidor o DB se reinicia en medio del proceso: La transacción hace ROLLBACK. El stock del negocio se recupera sin haber inflado la cuenta del empleado.
