# 🌟 ESSENCE - Sistema de Gestión Comercial Inteligente

---

## 📌 DESCRIPCIÓN GENERAL

**Essence** es una plataforma de gestión comercial integral diseñada para empoderar negocios de venta directa y distribución. Permite administrar desde un solo lugar: inventario, ventas, distribuidores, clientes, créditos, promociones y analíticas avanzadas, todo con una interfaz moderna, rápida y accesible desde cualquier dispositivo.

El sistema está construido con arquitectura **multi-negocio**, lo que significa que una misma instalación puede gestionar múltiples empresas de forma completamente aislada y segura. Cada negocio tiene su propio inventario, usuarios, clientes y configuración.

---

## 🧩 MÓDULOS PRINCIPALES

| #   | Módulo                     | Descripción Breve                                          |
| --- | -------------------------- | ---------------------------------------------------------- |
| 1   | **Productos e Inventario** | Gestión completa de catálogo, stock y costos               |
| 2   | **Ventas**                 | Registro de ventas con múltiples canales y métodos de pago |
| 3   | **Distribuidores**         | Red de vendedores con stock propio y comisiones            |
| 4   | **Créditos/Fiados**        | Sistema completo de créditos a clientes                    |
| 5   | **Clientes**               | CRM con segmentación y programa de puntos                  |
| 6   | **Promociones**            | Combos, bundles, 2x1 y descuentos                          |
| 7   | **Sedes/Sucursales**       | Multi-bodega con transferencias                            |
| 8   | **Analíticas**             | Dashboards con métricas en tiempo real                     |
| 9   | **Gamificación**           | Rankings y bonos para distribuidores                       |
| 10  | **Notificaciones**         | Alertas inteligentes del sistema                           |
| 11  | **Gastos**                 | Control de egresos del negocio                             |
| 12  | **Productos Defectuosos**  | Gestión de garantías y pérdidas                            |
| 13  | **Panel God**              | Administración multi-empresa                               |

---

## 📦 MÓDULO 1: PRODUCTOS E INVENTARIO

### ¿Qué hace?

Gestiona el catálogo completo de productos con control de stock inteligente, cálculo automático de costos promedio ponderados y alertas de inventario bajo.

### Funcionalidades:

| Función                                 | Descripción                                                             |
| --------------------------------------- | ----------------------------------------------------------------------- |
| **Catálogo de productos**               | Nombre, descripción, imágenes, categoría, ingredientes y beneficios     |
| **Sistema de precios múltiple**         | Precio de compra, precio distribuidor, precio sugerido y precio cliente |
| **Cálculo de costo promedio ponderado** | Actualización automática del costo real considerando todas las compras  |
| **Alertas de stock bajo**               | Notificaciones cuando el inventario cae bajo el umbral configurado      |
| **Stock por ubicación**                 | Control separado de stock en bodega, sedes y distribuidores             |
| **Recepción de mercancía**              | Registro de entradas con proveedor, cantidad y costo unitario           |
| **Agrupación de recepciones**           | Múltiples productos en una sola orden de compra                         |
| **Historial completo**                  | Trazabilidad de todas las entradas y movimientos                        |
| **Productos destacados**                | Marcar productos para mostrar en el catálogo público                    |

### Beneficios para el usuario:

- ✅ Conoce siempre tu costo real de inventario
- ✅ Evita quedarte sin stock con alertas automáticas
- ✅ Maneja múltiples bodegas desde un solo lugar
- ✅ Registra compras en lote de forma rápida

---

## 💰 MÓDULO 2: VENTAS

### ¿Qué hace?

Registra todas las ventas del negocio, ya sean realizadas por el administrador o por distribuidores, con cálculo automático de ganancias, comisiones y control de pagos.

### Funcionalidades:

| Función                             | Descripción                                                 |
| ----------------------------------- | ----------------------------------------------------------- |
| **Registro de ventas**              | Producto, cantidad, cliente, método de pago                 |
| **Ventas agrupadas (carrito)**      | Múltiples productos en una sola transacción con ID de grupo |
| **Vista expandible de grupos**      | Colapsar/expandir ventas del mismo carrito en la tabla      |
| **Confirmación de pagos**           | Estados "pendiente" y "confirmado" con fecha y usuario      |
| **Comprobante de pago**             | Adjuntar imagen del comprobante de transferencia            |
| **Métodos de pago personalizables** | Efectivo, transferencia, tarjeta, otros                     |
| **Ventas a crédito (fiados)**       | Marcar ventas como fiado con seguimiento de deuda           |
| **Cálculo automático de ganancias** | Ganancia del admin, del distribuidor y total                |
| **Comisiones variables**            | Porcentaje de comisión según ranking del distribuidor       |
| **Eliminación con restauración**    | Borrar ventas restaura automáticamente el stock             |
| **Filtros avanzados**               | Por fecha, distribuidor, estado de pago, cliente            |
| **Exportación**                     | Descargar datos en Excel                                    |

### Flujo de venta:

```
Cliente solicita → Distribuidor/Admin registra → Sistema descuenta stock →
Calcula ganancias → Registra método de pago → Actualiza métricas del cliente
```

### Beneficios para el usuario:

- ✅ Visibilidad total de quién vendió qué y cuándo
- ✅ Nunca pierdas el control de pagos pendientes
- ✅ Ganancias calculadas automáticamente
- ✅ Ventas en lote procesadas como un solo pedido

---

## 👥 MÓDULO 3: DISTRIBUIDORES

### ¿Qué hace?

Gestiona una red de vendedores externos que tienen su propio stock asignado, realizan ventas y ganan comisiones. Ideal para negocios de venta directa y multinivel.

### Funcionalidades:

| Función                                | Descripción                                          |
| -------------------------------------- | ---------------------------------------------------- |
| **Registro de distribuidores**         | Nombre, email, teléfono, dirección                   |
| **Stock asignado**                     | Cada distribuidor tiene su propio inventario         |
| **Transferencia de stock**             | Mover productos de bodega a distribuidor             |
| **Transferencia entre distribuidores** | Mover stock de un distribuidor a otro                |
| **Panel del distribuidor**             | Dashboard exclusivo con sus ventas y métricas        |
| **Registro de ventas propio**          | El distribuidor registra sus ventas desde su panel   |
| **Catálogo compartible**               | Enlace público con productos y precios para clientes |
| **Ventas agrupadas**                   | Carrito multi-producto con ID de grupo               |
| **Vista de comisiones**                | El distribuidor ve sus ganancias en tiempo real      |
| **Estadísticas individuales**          | Ventas totales, productos vendidos, ranking          |
| **Activar/Desactivar**                 | Control de acceso al sistema                         |

### Catálogo Público:

Cada distribuidor puede compartir un enlace único a su catálogo, donde los clientes ven:

- Foto del producto
- Nombre y descripción
- Precio al público
- Disponibilidad

### Beneficios para el usuario:

- ✅ Escala tu negocio con vendedores independientes
- ✅ Control total del stock que tienen tus distribuidores
- ✅ Comisiones calculadas automáticamente
- ✅ Cada distribuidor tiene su propio acceso seguro

---

## 💳 MÓDULO 4: CRÉDITOS / FIADOS

### ¿Qué hace?

Permite otorgar créditos a clientes con seguimiento completo de pagos parciales, fechas de vencimiento y alertas de morosidad.

### Funcionalidades:

| Función                          | Descripción                                            |
| -------------------------------- | ------------------------------------------------------ |
| **Crear crédito**                | Monto, cliente, fecha de vencimiento, descripción      |
| **Estados del crédito**          | Pendiente, pago parcial, pagado, vencido, cancelado    |
| **Pagos parciales**              | Registrar abonos con método de pago y comprobante      |
| **Historial de pagos**           | Ver todos los abonos realizados a un crédito           |
| **Métricas de créditos**         | Total prestado, recuperado, pendiente, vencido         |
| **Alertas de vencimiento**       | Notificaciones cuando un crédito está por vencer       |
| **Cancelación con restauración** | Eliminar crédito restaura stock y actualiza cliente    |
| **Vinculación con venta**        | El crédito se asocia automáticamente a la venta origen |
| **Deuda del cliente**            | Actualización automática del saldo deudor              |

### Estados del crédito:

```
PENDIENTE → (pago parcial) → PARCIAL → (pago completo) → PAGADO
     ↓
(fecha pasa) → VENCIDO
     ↓
(admin cancela) → CANCELADO
```

### Beneficios para el usuario:

- ✅ Nunca olvides quién te debe y cuánto
- ✅ Recibe alertas antes de que venzan los créditos
- ✅ Acepta pagos parciales con trazabilidad
- ✅ El cliente ve su deuda automáticamente

---

## 🧑‍💼 MÓDULO 5: CLIENTES (CRM)

### ¿Qué hace?

Gestiona la base de datos de clientes con segmentación automática, programa de puntos de fidelización y métricas de comportamiento de compra.

### Funcionalidades:

| Función                       | Descripción                                   |
| ----------------------------- | --------------------------------------------- |
| **Registro de clientes**      | Nombre, teléfono, email, dirección, notas     |
| **Segmentación automática**   | Nuevo, frecuente, VIP, inactivo, con_deuda    |
| **Segmentos personalizables** | Crear tus propios segmentos con reglas        |
| **Programa de puntos**        | Acumulación y canje de puntos por compras     |
| **Historial de puntos**       | Puntos ganados, canjeados, ajustes, expirados |
| **Métricas del cliente**      | Total gastado, deuda, número de compras       |
| **Última compra**             | Fecha de la última transacción                |
| **Vinculación con ventas**    | Las ventas guardan nombre/email del cliente   |
| **Vinculación con créditos**  | Los créditos se asocian al cliente            |
| **Búsqueda avanzada**         | Por nombre, teléfono, email, segmento         |

### Sistema de puntos:

```
Cliente compra → Sistema calcula puntos según monto →
Acumula en cuenta → Cliente puede canjear por beneficios
```

### Beneficios para el usuario:

- ✅ Conoce a tus mejores clientes
- ✅ Identifica clientes inactivos para reactivarlos
- ✅ Programa de lealtad que fideliza
- ✅ Toda la información del cliente en un solo lugar

---

## 🎁 MÓDULO 6: PROMOCIONES

### ¿Qué hace?

Crea promociones atractivas para impulsar ventas: combos, bundles, 2x1, descuentos por volumen y más.

### Tipos de promociones:

| Tipo           | Descripción                            | Ejemplo                     |
| -------------- | -------------------------------------- | --------------------------- |
| **Bundle**     | Paquete de productos a precio especial | Kit de belleza $99,000      |
| **Combo**      | Combinación con descuento              | Crema + Sérum 15% OFF       |
| **2x1 (BOGO)** | Compra uno, lleva otro                 | Compra 2 labiales, 1 gratis |
| **Descuento**  | Porcentaje o monto fijo                | 20% en toda la línea facial |
| **Volumen**    | Descuento por cantidad                 | Compra 3+, 10% OFF          |

### Funcionalidades:

| Función                 | Descripción                                     |
| ----------------------- | ----------------------------------------------- |
| **Crear promoción**     | Nombre, tipo, productos, precio especial        |
| **Imagen de promoción** | Foto atractiva para el catálogo                 |
| **Fechas de vigencia**  | Inicio y fin de la promoción                    |
| **Límite por sucursal** | Aplicar solo en sedes específicas               |
| **Límite por segmento** | Solo para clientes VIP, por ejemplo             |
| **Estados**             | Activa, pausada, borrador, archivada            |
| **Métricas**            | Ventas generadas por cada promoción             |
| **Mostrar en catálogo** | Visible en el catálogo público del distribuidor |

### Beneficios para el usuario:

- ✅ Impulsa ventas con ofertas irresistibles
- ✅ Promociones temporales con fechas automáticas
- ✅ Mide el impacto de cada promoción
- ✅ Segmenta promociones por cliente o sucursal

---

## 🏢 MÓDULO 7: SEDES Y SUCURSALES

### ¿Qué hace?

Administra múltiples ubicaciones físicas del negocio con stock independiente, transferencias entre sedes y configuración por sucursal.

### Funcionalidades:

| Función                         | Descripción                                |
| ------------------------------- | ------------------------------------------ |
| **Crear sede**                  | Nombre, dirección, contacto, zona horaria  |
| **Bodega central**              | Una sede marcada como almacén principal    |
| **Stock por sede**              | Cada sucursal tiene su propio inventario   |
| **Ver inventario de sede**      | Consultar stock de una sucursal específica |
| **Transferencias entre sedes**  | Mover productos de una sucursal a otra     |
| **Estado de transferencia**     | Pendiente, completada, rechazada           |
| **Historial de transferencias** | Trazabilidad de todos los movimientos      |
| **Activar/Desactivar sede**     | Control de sucursales activas              |
| **Recepción por sede**          | Mercancía puede llegar a bodega o a sede   |

### Flujo de transferencia:

```
Sede A solicita → Admin aprueba → Sistema descuenta de A →
Incrementa en B → Registra historial
```

### Beneficios para el usuario:

- ✅ Maneja múltiples sucursales sin confusión
- ✅ Transfiere stock entre sedes fácilmente
- ✅ Cada sede con su inventario independiente
- ✅ Trazabilidad completa de movimientos

---

## 📊 MÓDULO 8: ANALÍTICAS Y DASHBOARDS

### ¿Qué hace?

Proporciona visibilidad completa del negocio con dashboards interactivos, gráficos y métricas en tiempo real.

### Dashboard Básico:

- Total de productos, categorías, destacados
- Productos con stock bajo
- Distribuidores activos
- Ventas del mes
- Ganancias del mes vs mes anterior
- Gastos del mes
- Métricas de créditos

### Dashboard Avanzado:

| Sección                        | Métricas                                         |
| ------------------------------ | ------------------------------------------------ |
| **KPIs Financieros**           | Ingresos, ganancias, ticket promedio, conversión |
| **Gráfico de ventas**          | Timeline por día/semana/mes                      |
| **Top productos**              | Más vendidos en cantidad y valor                 |
| **Distribución por categoría** | Pastel de ventas por categoría                   |
| **Ranking de distribuidores**  | Tabla de mejores vendedores                      |
| **Alertas de stock**           | Productos que necesitan reposición               |
| **Rotación de productos**      | Velocidad de venta de cada producto              |
| **Funnel de ventas**           | Pendientes vs confirmadas                        |
| **Análisis comparativo**       | Periodo actual vs anterior                       |

### Filtros disponibles:

- Por rango de fechas (7 días, 30 días, mes actual, personalizado)
- Por distribuidor
- Por categoría
- Por sede

### Exportación:

- **PDF**: Reportes de KPIs y rankings
- **Excel**: Datos de rankings y ventas

### Beneficios para el usuario:

- ✅ Toma decisiones basadas en datos reales
- ✅ Identifica productos estrella y de baja rotación
- ✅ Mide el rendimiento de tu equipo de ventas
- ✅ Compara periodos para detectar tendencias

---

## 🏆 MÓDULO 9: GAMIFICACIÓN Y RANKINGS

### ¿Qué hace?

Motiva a los distribuidores con un sistema de rankings, bonos por desempeño y comisiones variables según su posición.

### Funcionalidades:

| Función                           | Descripción                                            |
| --------------------------------- | ------------------------------------------------------ |
| **Ranking en tiempo real**        | Posición de cada distribuidor por ventas               |
| **Periodos configurables**        | Semanal, quincenal, mensual, personalizado             |
| **Comisiones variables**          | Top 1: +5%, Top 2: +3%, Top 3: +1% adicional           |
| **Bonos monetarios**              | Premio para el #1 (configurable)                       |
| **Historial de ganadores**        | Registro de todos los campeones anteriores             |
| **Logros y badges**               | Insignias por metas alcanzadas                         |
| **Estadísticas del distribuidor** | Victorias totales, bonos acumulados                    |
| **Auto-evaluación**               | El sistema evalúa automáticamente al final del periodo |
| **Mínimo para ranking**           | Requisito de ganancia mínima para participar           |

### Sistema de comisiones:

```
Base: 20% de ganancia para el distribuidor
+ Top 1: 25% total (+5%)
+ Top 2: 23% total (+3%)
+ Top 3: 21% total (+1%)
Resto: 20% base
```

### Beneficios para el usuario:

- ✅ Distribuidores motivados por competencia sana
- ✅ Los mejores ganan más, incentivando el esfuerzo
- ✅ Transparencia total en la posición de cada uno
- ✅ Historial de logros que genera orgullo

---

## 🔔 MÓDULO 10: NOTIFICACIONES

### ¿Qué hace?

Sistema de alertas inteligentes que mantiene informados a administradores y distribuidores sobre eventos importantes.

### Tipos de notificaciones:

| Tipo                   | Destinatario | Ejemplo                             |
| ---------------------- | ------------ | ----------------------------------- |
| **Stock bajo**         | Admin        | "Crema facial con solo 5 unidades"  |
| **Nueva venta**        | Admin        | "Venta registrada por María García" |
| **Crédito vencido**    | Admin        | "Fiado de Juan Pérez venció ayer"   |
| **Pago recibido**      | Admin        | "Abono de $50,000 a crédito #123"   |
| **Cambio en ranking**  | Distribuidor | "¡Subiste al puesto #2!"            |
| **Logro desbloqueado** | Distribuidor | "Ganaste el badge de Top Performer" |
| **Recordatorio**       | Todos        | "Cierre de periodo en 2 días"       |
| **Sistema**            | Admin        | "Backup completado exitosamente"    |

### Funcionalidades:

- Prioridad: baja, media, alta, urgente
- Estado: leída / no leída
- Enlace directo a la entidad relacionada
- Expiración automática de notificaciones antiguas

### Beneficios para el usuario:

- ✅ Nunca te pierdas eventos importantes
- ✅ Actúa rápido ante alertas críticas
- ✅ Los distribuidores se mantienen informados

---

## 💸 MÓDULO 11: GASTOS

### ¿Qué hace?

Registra y categoriza los gastos operativos del negocio para tener visibilidad del flujo de efectivo.

### Funcionalidades:

| Función                    | Descripción                             |
| -------------------------- | --------------------------------------- |
| **Registrar gasto**        | Tipo, monto, descripción, fecha         |
| **Categorías de gasto**    | Operativos, servicios, marketing, etc.  |
| **Filtros por fecha**      | Ver gastos de cualquier periodo         |
| **Métricas de gastos**     | Total mes actual vs mes anterior        |
| **Desglose por categoría** | Gráfico de distribución de gastos       |
| **Historial completo**     | Todos los gastos con quien los registró |

### Beneficios para el usuario:

- ✅ Control total de tus egresos
- ✅ Identifica categorías de mayor gasto
- ✅ Compara gastos entre periodos

---

## 🔧 MÓDULO 12: PRODUCTOS DEFECTUOSOS

### ¿Qué hace?

Gestiona productos con defectos reportados por distribuidores o en bodega, con flujo de garantía y recuperación de stock.

### Funcionalidades:

| Función                   | Descripción                                  |
| ------------------------- | -------------------------------------------- |
| **Reportar defecto**      | Producto, cantidad, razón, imágenes          |
| **Flujo de garantía**     | Con garantía / sin garantía                  |
| **Estados**               | Pendiente, confirmado, rechazado             |
| **Restauración de stock** | Si hay garantía aprobada, se repone stock    |
| **Pérdida registrada**    | Si no hay garantía, se registra como pérdida |
| **Origen del stock**      | Bodega, sede o distribuidor                  |
| **Notas del admin**       | Comentarios sobre la resolución              |

### Flujo de garantía:

```
Distribuidor reporta → Admin revisa →
(Tiene garantía) → Aprueba → Stock restaurado
(No tiene garantía) → Registra pérdida
```

### Beneficios para el usuario:

- ✅ Trazabilidad de productos defectuosos
- ✅ Proceso claro de garantías
- ✅ Evita pérdidas por productos dañados

---

## 👑 MÓDULO 13: PANEL GOD (Super Administrador)

### ¿Qué hace?

Panel exclusivo para el administrador de la plataforma que permite gestionar múltiples negocios desde un solo lugar.

### Funcionalidades:

| Función                        | Descripción                                    |
| ------------------------------ | ---------------------------------------------- |
| **Lista de negocios**          | Todos los negocios registrados                 |
| **Métricas globales**          | Usuarios, negocios, ventas totales del sistema |
| **Usuarios por estado**        | Activos, pendientes, suspendidos, expirados    |
| **Top negocios**               | Los 10 negocios con más ventas                 |
| **Gestión de suscripciones**   | Activar/pausar/extender suscripciones          |
| **Crear negocios**             | Registrar nuevas empresas en la plataforma     |
| **Acceso a cualquier negocio** | Entrar como admin a cualquier empresa          |

### Beneficios para el usuario:

- ✅ Administración centralizada de la plataforma
- ✅ Visibilidad de todos los clientes (negocios)
- ✅ Control de suscripciones y accesos

---

## 🔄 FLUJOS CLAVE DEL SISTEMA

### 1. Flujo de Venta Completo

```
[Recepción de mercancía] → Stock en bodega
        ↓
[Transferencia] → Stock en distribuidor
        ↓
[Venta] → Descuenta stock → Calcula ganancias
        ↓
(Pago diferido) → [Crédito] → Seguimiento
        ↓
[Confirmación de pago] → Venta completada
        ↓
[Métricas] → Dashboard actualizado
```

### 2. Flujo de Inventario

```
[Proveedor entrega] → [Recepción] → Actualiza costo promedio
        ↓
[Stock en bodega] → [Transferencia a sede/distribuidor]
        ↓
[Venta] → Descuenta del origen → [Alerta si bajo]
```

### 3. Flujo de Créditos

```
[Venta a crédito] → Crea fiado → Actualiza deuda cliente
        ↓
[Pago parcial] → Actualiza saldo → Estado "partial"
        ↓
[Pago final] → Estado "paid" → Cliente sin deuda
```

### 4. Flujo de Rankings

```
[Ventas del periodo] → Suma por distribuidor → Ordena ranking
        ↓
[Fin de periodo] → Evalúa ganador → Asigna bono
        ↓
[Nuevo periodo] → Comisiones según posición
```

---

## 🛠️ TECNOLOGÍAS UTILIZADAS

| Capa                           | Tecnología                                |
| ------------------------------ | ----------------------------------------- |
| **Frontend**                   | React 19, TypeScript, Vite, TailwindCSS 4 |
| **Backend**                    | Node.js 20+, Express 4.18, ES Modules     |
| **Base de datos**              | MongoDB 8 con Mongoose                    |
| **Caché**                      | Redis 7 para rendimiento                  |
| **Almacenamiento de imágenes** | Cloudinary                                |
| **Autenticación**              | JWT con refresh tokens                    |
| **Infraestructura**            | Docker, Nginx                             |
| **PWA**                        | Instalable como aplicación                |

---

## ⭐ PUNTOS FUERTES DEL SISTEMA

### Arquitectura

- ✅ **Multi-negocio**: Una instalación, múltiples empresas aisladas
- ✅ **Multi-sede**: Bodegas y sucursales con stock independiente
- ✅ **API RESTful**: Preparado para integraciones futuras
- ✅ **Caché inteligente**: Respuestas rápidas con Redis

### Experiencia de Usuario

- ✅ **Interfaz moderna**: Diseño oscuro elegante y responsive
- ✅ **PWA**: Se instala como app en celular
- ✅ **Carga rápida**: Optimizado para conexiones lentas
- ✅ **Tablas virtualizadas**: Miles de registros sin lag

### Negocio

- ✅ **Costos automáticos**: Promedio ponderado calculado
- ✅ **Ganancias en tiempo real**: Sabe cuánto ganas al instante
- ✅ **Comisiones variables**: Incentiva a tu equipo
- ✅ **Créditos con seguimiento**: Control total de fiados

### Seguridad

- ✅ **Autenticación robusta**: JWT + refresh tokens
- ✅ **Roles y permisos**: Admin, distribuidor, God
- ✅ **Protección contra ataques**: Rate limiting, headers seguros
- ✅ **Aislamiento de datos**: Cada negocio ve solo lo suyo

---

## 📝 RESUMEN COMERCIAL

---

### Para compartir con clientes:

---

**Essence** es la solución integral que tu negocio necesita para dejar de perder tiempo en hojas de cálculo y empezar a crecer con datos reales.

Con Essence puedes:

🛒 **Vender más** con un sistema ágil que registra ventas en segundos, calcula ganancias automáticamente y te permite dar crédito a clientes sin perder el control.

📦 **Controlar tu inventario** con alertas de stock bajo, costos promedio actualizados y la capacidad de manejar múltiples bodegas y sucursales desde un solo lugar.

👥 **Potenciar tu equipo de distribuidores** con su propio panel, stock asignado, catálogo compartible para clientes y un sistema de rankings con bonos que los motiva a vender más.

📊 **Tomar decisiones inteligentes** con dashboards que te muestran en tiempo real tus productos estrella, tus mejores vendedores, tus ganancias del mes y tendencias de crecimiento.

🎁 **Impulsar ventas** con promociones tipo bundle, combo, 2x1 y descuentos que puedes crear en minutos y medir su impacto.

💳 **Gestionar créditos** con seguimiento de pagos parciales, alertas de vencimiento y la deuda de cada cliente siempre actualizada.

📱 **Acceder desde cualquier lugar** porque es una app web moderna que funciona en computadora, tablet y celular, incluso instalándose como aplicación.

---

**¿Por qué Essence?**

- ✅ No necesitas instalar software, funciona desde el navegador
- ✅ Tus datos seguros en la nube con respaldos automáticos
- ✅ Actualizaciones constantes sin costo adicional
- ✅ Soporte técnico incluido
- ✅ Escalable: crece contigo

---

**Essence: La esencia de un negocio bien administrado.**

---

_Documento generado el 11 de Enero de 2026_
