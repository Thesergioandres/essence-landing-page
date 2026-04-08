# 📖 BACKLOG Y HISTORIAS DE USUARIO (ESSENCE ERP)

> **Propósito:** Catálogo exhaustivo de requerimientos ágiles estructurados en Épicas e Historias de Usuario (HU) con sus Criterios de Aceptación (CA), listos para integrarse en un flujo de trabajo Scrum/Kanban.

---

## 🏔️ ÉPICA 1: Gestión Multi-Tenant y Accesos

**HU-1.1: Registro inicial y estado de cuarentena**
* **Como** administrador de un nuevo negocio,
* **Quiero** poder registrar mi perfil y empresa en la plataforma,
* **Para** comenzar el proceso de onboarding en Essence.
* **Criterios de Aceptación (CA):**
  * CA1: El perfil debe nacer con `status: "pending"`.
  * CA2: No se permite acceso a ningún módulo (HTTP 403) hasta la aprobación de un GOD.

**HU-1.2: Aprobación jerárquica (GOD Mode)**
* **Como** superusuario GOD,
* **Quiero** poder listar usuarios pendientes y cambiar su estado a `active`,
* **Para** autorizarlos a usar el sistema.

**HU-1.3: Ceguera del Distribuidor**
* **Como** owner del negocio,
* **Quiero** que cuando mis distribuidores ingresen al sistema,
* **Para** que no puedan ver mi `purchasePrice`, `averageCost`, ni márgenes de ganancia.
* **CA:**
  * CA1: El API debe mutilar estos campos financieros en los responses hacia JWTs con rol `distribuidor`.

---

## 🏔️ ÉPICA 2: Operaciones de Inventario

**HU-2.1: Transferencias atómicas entre Sedes**
* **Como** bodeguero o admin,
* **Quiero** transferir 50 unidades de la Bodega a la Sucursal Norte,
* **Para** mantener las sedes abastecidas.
* **CA:**
  * CA1: Si la bodega no tiene 50 unidades, arrojar error de validación.
  * CA2: La operación de resta y suma debe ser una transacción atómica; o pasan ambas o ninguna.

**HU-2.2: Asignación a Distribuidores**
* **Como** owner,
* **Quiero** asignar stock específicamente a un distribuidor,
* **Para** que él lo venda por su cuenta.
* **CA:**
  * CA1: Deduce de `warehouseStock` e incrementa el registro en `DistributorStock`.

---

## 🏔️ ÉPICA 3: Finanzas y Punto de Venta (POS)

**HU-3.1: Comisiones Dinámicas por Ranking**
* **Como** distribuidor,
* **Quiero** ganar más porcentaje si soy el vendedor número 1,
* **Para** sentirme motivado.
* **CA:**
  * CA1: El motor financiero calculará la ganancia con 25% si está en rango Oro, 20% si es estándar.

**HU-3.2: Ventas a Crédito (Fiado)**
* **Como** cajero,
* **Quiero** registrar una salida de inventario bajo el método "Crédito",
* **Para** entregar el producto sin recibir el dinero inmediato.
* **CA:**
  * CA1: Deduce inventario normalmente.
  * CA2: Se guarda con `paymentStatus: "pendiente"`.
  * CA3: No refleja suma en las analíticas de caja neta ni ganancia corporativa hasta ser confirmado.
