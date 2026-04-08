# 📖 MANUAL DE USUARIO (ESSENCE ERP)

> **Propósito:** Guía de uso a nivel de flujos de pantalla y navegación, separada por el rol del usuario final. No contiene tecnicismos, asume a un ser humano operando el panel web/móvil.

---

## 👑 1. Guía del Administrador (Owner)

El nivel Administrador tiene control absoluto de su inventario, finanzas corporativas y distribuidores adscritos.

#### A. ¿Cómo registrar el primer inventario?
1. Dirígete a **Módulo de Inventario > Productos**.
2. Presiona "Nuevo Producto".
3. Rellena los datos vitales. Ojo: El sistema te preguntará tu **Precio de Venta Público**.
4. Ingresa el modelo de costeo: Deja por defecto el *Costo Promedio*. El sistema registrará el costo de tu inversión y todo lo demás será automatizado.
5. Presiona Guardar. El stock ingresado viajará directamente a tu "Bodega Principal" (`warehouseStock`).

#### B. ¿Cómo asignar mercancía a mis distribuidores?
1. Dirígete a **Equipo > Distribuidores**.
2. Dale al botón "Transferir Mercancía".
3. Identifica al distribuidor y el producto. Ingresa la cantidad (ej. 100).
4. El sistema restará mágicamente tus 100 de tu *Bodega Principal* de manera inmediata para protegerte de vender un producto físico dos veces, y le dotará esas 100 unidades al celular o portátil del distribuidor de cara a su inicio de sesión en terreno.

#### C. Control Financiero Diario.
1. Accede al **Dashboard**.
2. Todo lo visualizado en "Ganancia Neta" ya tiene exentos: envíos, comisiones pagadas a distribuidores y ventas que no te han entrado dinero (Fiados). Tienes una contabilidad pura.

---

## 🏃 2. Guía del Distribuidor (Vendedor)

El distribuidor no ve costos de compra, operaciones del dueño o ganancias administrativas. El distribuidor solo utiliza Essence ERP como su POS personal optimizado.

#### A. Inicio de Jornada y Venta
1. Al Iniciar Sesión, observarás una vista diferente. Sólo verás un resumen de "Mis Comisiones" ganadas en el mes o día.
2. Inicia un "**Punto de Venta Automático (POS)**".
3. Agrega productos a tu carrito virtual de las existencias que el administrador confió en tu cuenta (solo lo que tienes tú, no la bodega gigante).
4. Configura porcentaje extra si le cobras envío al cliente y presiona generar venta.

#### B. ¿Por qué se ha suspendido mi acceso al ingresar el lunes?
El ERP trabaja mediante un sistema dependiente. Si tu Patrono Oficial (El Owner) ha dejado caducar la subscripción corporativa de la empresa, el panel no dejará iniciar sesión a ningún distribuidor por regulaciones preventivas del servidor de datos.
> *"Contacta al Dueño del ERP para reactivar operaciones."*
