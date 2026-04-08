import { gsap } from "gsap";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Compass,
  Copy,
  CreditCard,
  Crown,
  Layers,
  Lock,
  LogIn,
  Megaphone,
  Package,
  Search,
  ShieldCheck,
  ShoppingCart,
  Trophy,
  Truck,
  Warehouse,
} from "lucide-react";
import {
  type ComponentType,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ManualSection = {
  id: string;
  title: string;
  subtitle: string;
  audience: string;
  readingTime: string;
  tags: string[];
  icon: ComponentType<{ className?: string }>;
  checkpoints: string[];
  markdown: string;
};

const routeCoverage = [
  {
    label: "Publicas",
    count: 8,
    detail: "Landing, manual, catalogo y vistas compartidas",
  },
  {
    label: "Acceso y autenticacion",
    count: 7,
    detail: "Login unificado, onboarding y cuenta en espera",
  },
  {
    label: "Admin",
    count: 48,
    detail: "Operacion, ventas, reportes, configuracion y soporte",
  },
  {
    label: "Distribuidor",
    count: 27,
    detail: "Catalogo, ventas, envios y modo operativo",
  },
];

const manualSections: ManualSection[] = [
  {
    id: "01-fundamentos",
    title: "Fundamentos Del ERP",
    subtitle: "Como se organiza la operacion y quien decide cada proceso.",
    audience: "Direccion, gerencia y equipo operativo",
    readingTime: "6 min",
    tags: ["fundamentos", "roles", "navegacion"],
    icon: BookOpen,
    checkpoints: [
      "Ingresar con el perfil correcto antes de abrir turno.",
      "Confirmar que la cuenta de tu Empresa activa sea la correcta.",
      "Trabajar solo en el modulo que corresponde a tu responsabilidad.",
    ],
    markdown: `## Objetivo operativo real

Essence ERP concentra en un solo lugar la operacion diaria de ventas, inventario y rentabilidad.

- Control de mercancia en bodega, sedes y distribuidores.
- Registro de ventas normales, promocionales y ventas con pago a plazos.
- Seguimiento de garantias, novedades de calidad y traslados.
- Lectura de indicadores para cuidar utilidad y flujo de caja.
- Gobierno central para usuarios, planes y continuidad del servicio.

## Matriz de roles

| Rol | Alcance principal | Limites clave |
| --- | --- | --- |
| dueño | Direccion total de la plataforma y de todas las empresas | No requiere operar cada venta del dia |
| Gerencia administrativa | Gestion completa de la empresa activa | Depende del plan y permisos de su equipo |
| Distribuidor | Ventas, catalogo y logistica asignada | Puede operar sin acceso a costos sensibles |
| Equipo operativo | Tareas puntuales segun autorizacion | No realiza cambios de administracion global |

## Verticales del dominio

- Barberias: activo y operando en produccion.
- Restaurantes: preparado para habilitacion futura.
- Gimnasios: preparado para habilitacion futura.

## Resultado esperado

La plataforma esta diseniada para que el equipo venda mas rapido, cometa menos errores y mantenga control de inventario y rentabilidad sin exponer datos sensibles.
`,
  },
  {
    id: "02-acceso-sesion",
    title: "Acceso, Sesion Y Redireccion",
    subtitle:
      "Ingreso unificado para todo el equipo con continuidad de trabajo.",
    audience: "Todo el personal",
    readingTime: "7 min",
    tags: ["acceso", "seguridad", "inicio"],
    icon: LogIn,
    checkpoints: [
      "Usar siempre /login como puerta principal.",
      "Si la sesion se recupera sola, continuar operacion sin reingresar datos.",
      "Si la cuenta esta suspendida o vencida, revisar /account-hold.",
    ],
    markdown: `## Flujo de entrada oficial

- Las rutas antiguas de acceso redirigen a /login para evitar confusiones.
- Al iniciar sesion, el sistema lleva automaticamente al panel correcto segun tu perfil.
- Si existe una sesion reciente valida, se recupera para que no pierdas continuidad.

## Comportamientos de seguridad en sesión

- Si no hay credenciales vigentes, se solicita ingreso nuevamente.
- Si la sesion ya no puede recuperarse, se cierra por seguridad.
- Si la cuenta requiere revision administrativa, se dirige a /account-hold.

## Recuperacion automatica de sesion

La plataforma prioriza continuidad para el equipo:

1. Busca si ya hay una sesion activa en el equipo.
2. Si no la encuentra, valida si hay datos de recuperacion.
3. Si puede restablecer acceso, te devuelve al panel de trabajo.
4. Si no puede, solicita ingreso normal.

## Redirecciones por rol

- dueño y gerencia administrativa: panel de gestion.
- Distribuidor: panel distribuidor.
- Si alguien entra a una zona no autorizada, se redirige al panel permitido.
`,
  },
  {
    id: "03-contexto-negocio",
    title: "Contexto De Empresa Y Plan",
    subtitle: "Seleccion de la cuenta activa y de las funciones disponibles.",
    audience: "Direccion, gerencia y distribucion",
    readingTime: "8 min",
    tags: ["negocio", "planes", "modulos"],
    icon: Building2,
    checkpoints: [
      "Elegir la cuenta de tu Empresa correcta antes de operar.",
      "Si una pantalla no aparece, revisar si ese modulo esta incluido en el plan.",
      "Completar la configuracion inicial cuando sea la primera entrada.",
    ],
    markdown: `## Que define la cuenta activa

- Empresa con la que vas a trabajar en ese momento.
- Permisos de cada usuario dentro de esa empresa.
- Modulos habilitados segun plan contratado.

## Reglas clave

- Si no hay empresa seleccionada, el sistema solicita elegir una.
- Si un responsable no tiene acceso activo, se guia por la configuracion inicial.
- Algunas herramientas avanzadas dependen del plan contratado.

## Habilitacion de modulos en pantalla

Si un modulo no esta incluido en tu plan, no se habilita en la operacion diaria.

Ejemplos de modulos que pueden variar por plan:

- Catalogo de productos
- Inventario
- Ventas
- Reportes
- Transferencias
- Promociones
- Gamificacion comercial

## Modo operativo distribuidor

Si un distribuidor entra por una ruta administrativa, la plataforma lo dirige automaticamente a su ruta operativa equivalente.
`,
  },
  {
    id: "04-mapa-rutas",
    title: "Mapa De Navegacion Completo",
    subtitle: "Mapa oficial de rutas disponibles para cada tipo de usuario.",
    audience: "Todos los perfiles",
    readingTime: "10 min",
    tags: ["rutas", "navegacion", "modulos"],
    icon: Compass,
    checkpoints: [
      "Usar el prefijo correcto (/admin o /distributor).",
      "Confirmar permisos vigentes antes de acciones criticas.",
      "Revisar redirecciones antiguas antes de reportar un problema.",
    ],
    markdown: `## Rutas públicas

- / (landing comercial)
- /manual
- /demo
- /productos
- /producto/:id
- /categoria/:slug
- /distributor-catalog/:distributorId
- /account-hold

## Rutas de autenticación

- /login
- /login/admin
- /login/distributor
- /login/god
- /register
- /onboarding
- /god

## Rutas admin (familias principales)

- Inventario: products, categories, add-product, edit, global-inventory, inventory-entries.
- Ventas: sales, register-sale, register-promotion, special-sales, credits.
- Logistica: stock-management, transfer-history, dispatch, branches.
- Analitica: analytics, profit-history, audit-logs, rankings.
- Configuracion: business-settings, team, user-settings, payment-methods, delivery-methods.
- Comercial: promotions, advertising, customers, segments, providers.
- Calidad: warranties, defective-products.

## Rutas distribuidor

- Core: dashboard, products, catalog, share-catalog, advertising.
- Venta: register-sale, register-promotion, sales, credits.
- Logistica: transfer-stock, request-dispatch, my-shipments.
- Operativo: operativo/stock-management, operativo/global-inventory, operativo/branches, operativo/transfer-history, operativo/sales, operativo/analytics, operativo/expenses, operativo/team, operativo/promotions, operativo/providers, operativo/customers.
- Calidad y gamificacion: defective-reports, warranties, stats, level.
`,
  },
  {
    id: "05-catalogo",
    title: "Catalogo Publico Y Distribuidor",
    subtitle:
      "Venta asistida con filtros, enlaces compartibles y PDF comercial.",
    audience: "Admin, distribuidor, equipo comercial",
    readingTime: "9 min",
    tags: ["catalogo", "ventas", "marketing"],
    icon: Megaphone,
    checkpoints: [
      "Confirmar que estas publicando desde la cuenta correcta de tu Empresa.",
      "Verificar que el enlace compartido abre el catalogo esperado.",
      "Descargar el PDF y validar logo, nombre y precios antes de enviarlo.",
    ],
    markdown: `## Catalogo publico de negocio

- Permite filtrar por categoria, precio, destacados y disponibilidad.
- Genera enlaces para compartir por redes o mensajeria.
- Muestra promociones activas para acelerar conversion comercial.
- Permite descargar un PDF listo para enviar a clientes.

## Catalogo distribuidor

- Muestra solo los productos que el distribuidor puede ofrecer.
- Incluye filtros de precio, categoria y disponibilidad.
- Cada distribuidor puede compartir su enlace publico individual.
- Incluye botones rapidos para WhatsApp, Telegram, Facebook, X, LinkedIn y correo.

## Compartir catalogo

- La pantalla de compartir permite copiar enlace y validar vista previa.
- En celular usa la opcion de compartir del equipo; en escritorio permite copiado rapido.

## Catalogo publico de distribuidor

- Presenta el catalogo como vitrina para cliente final.
- Puede mostrar datos de contacto para cierre directo.
- Mantiene opcion de descarga comercial en PDF.
`,
  },
  {
    id: "06-inventario",
    title: "Inventario, Productos Y CPP",
    subtitle: "Control de productos, compras y costo promedio del inventario.",
    audience: "Gerencia y responsables de inventario",
    readingTime: "10 min",
    tags: ["inventario", "costos", "productos"],
    icon: Package,
    checkpoints: [
      "Registrar cada ingreso con proveedor y cantidades correctas.",
      "Revisar costo unitario antes de confirmar la compra.",
      "Verificar el costo promedio despues de ingresos grandes.",
    ],
    markdown: `## Inventario de producto

- Permite crear, actualizar y organizar productos por categoria.
- Guarda historial de ingresos para auditoria y control.
- Controla existencias en bodega y en cada sede.

## Calculo de costo

Cuando ingresas nueva mercancia, el sistema recalcula el costo promedio para mantener una utilidad realista.

- Este calculo protege decisiones de precio y evita vender por debajo de margen.
- Tambien deja trazabilidad del costo anterior y del costo actualizado.

## Historial de entradas

- Cada ingreso deja evidencia de proveedor, cantidad, costo y observaciones.
- Esto permite auditar compras y explicar cualquier variacion de margen.

## Regla operativa

No confirmar ventas con stock incierto. La consistencia de bodega, sedes y distribuidores depende de mantener entradas y salidas sincronizadas.
`,
  },
  {
    id: "07-stock-transferencias",
    title: "Gestion De Stock Y Transferencias",
    subtitle: "Asignar, retirar y trasladar mercancia entre equipos y sedes.",
    audience: "Admin, distribuidor operativo",
    readingTime: "9 min",
    tags: ["inventario", "logistica", "traslados"],
    icon: Warehouse,
    checkpoints: [
      "Validar origen y destino antes de mover stock.",
      "Evitar transferencias al mismo destino.",
      "Cerrar turno revisando historial de transferencias.",
    ],
    markdown: `## Gestion de stock (administracion)

- Permite asignar mercancia a distribuidores y tambien retirarla cuando corresponde.
- Permite trasladar unidades entre sedes con observaciones de control.
- Antes de mover inventario, muestra disponibilidad real en el punto de salida.

## Transferencias distribuidor

- El distribuidor puede trasladar mercancia a otro distribuidor autorizado.
- Tambien puede enviar stock a sedes habilitadas.
- Siempre hay confirmacion previa para evitar errores de digitacion.

## Historial de transferencias

- Incluye filtros por origen, destino, producto, fecha y estado.
- Tiene vista de escritorio y vista movil.
- Muestra cuanto habia antes y cuanto quedo despues del movimiento.
`,
  },
  {
    id: "08-despachos",
    title: "Despachos Y Transito",
    subtitle: "Seguimiento completo desde solicitud hasta recepcion final.",
    audience: "Admin logistica y distribuidor",
    readingTime: "9 min",
    tags: ["despachos", "logistica", "traslados"],
    icon: Truck,
    checkpoints: [
      "Crear solicitudes con productos validos y cantidades correctas.",
      "Despachar con evidencia de envio cuando aplique.",
      "Confirmar recepcion para habilitar la mercancia para venta.",
    ],
    markdown: `## Central de despachos

- Reune en una sola pantalla solicitudes pendientes, despachadas y recibidas.
- Permite crear solicitudes rapidamente cuando la reposicion se pide por llamada o chat.
- Muestra carga logistica para priorizar entregas urgentes.

## Reglas de estados

- PENDIENTE: solicitud creada, sin salida de bodega.
- DESPACHADO: la mercancia sale de bodega y queda en camino.
- RECIBIDO: la mercancia llega y queda disponible para vender.

## Trazabilidad de movimiento

Cada salida y cada recepcion quedan registradas en el historial de movimientos para auditoria.

Al aprobar la recepcion, la mercancia se suma al inventario disponible para la venta.

## Sectores calientes

- Permite ver las zonas con mayor movimiento por unidades.
- En perfiles restringidos, los datos financieros sensibles se mantienen ocultos.
`,
  },
  {
    id: "09-ventas-estandar",
    title: "Venta Estandar",
    subtitle: "Registro comercial completo con control de inventario y cobro.",
    audience: "Admin y distribuidor",
    readingTime: "12 min",
    tags: ["ventas", "carrito", "credito"],
    icon: ShoppingCart,
    checkpoints: [
      "Elegir la fuente real de mercancia antes de vender.",
      "No confirmar si alguna linea queda bajo costo.",
      "Adjuntar comprobante cuando aplica transferencia.",
    ],
    markdown: `## Flujo operativo

1. Elegir desde donde sale la mercancia.
2. Agregar productos disponibles segun esa ubicacion.
3. Registrar cliente, forma de pago, costos adicionales y observaciones.
4. Confirmar la venta para emitir el comprobante.

## Controles clave

- Bloquea ventas que dejan margen negativo en algun producto.
- Permite definir fecha limite y abono inicial en ventas a plazo.
- Permite adjuntar comprobante de pago cuando corresponda.
- Permite registrar garantias para respaldo de postventa.

## Datos complementarios

- Muestra avance comercial del distribuidor con metas y reconocimientos.
- Presenta resumen de total a cobrar, descuentos y costos extra.
- Entrega una confirmacion final para cerrar la atencion con el cliente.
`,
  },
  {
    id: "10-ventas-promocion-especial",
    title: "Venta Promocional Y Especial",
    subtitle: "Promociones empaquetadas y ventas especiales por oportunidad.",
    audience: "Admin y distribuidor comercial",
    readingTime: "11 min",
    tags: ["ventas", "promociones", "eventos"],
    icon: Layers,
    checkpoints: [
      "Usar solo promociones vigentes y correctamente configuradas.",
      "Verificar stock de cada producto incluido en la promocion.",
      "Documentar observaciones en ventas especiales de alto valor.",
    ],
    markdown: `## Venta promocional

- Carga promociones activas con varios productos en un solo paquete.
- Distribuye el valor de la promocion de forma equilibrada.
- Asegura que la venta quede vinculada a la promocion seleccionada.
- Mantiene el mismo flujo de cobro, costos adicionales y garantias.

## Venta especial

- Permite manejar precios especiales para campañas o eventos.
- Registra observaciones para justificar condiciones comerciales.
- Permite editar o cancelar segun reglas de control.
- Incluye panel de seguimiento para medir resultado.

## Control operativo

Las ventas especiales y promocionales deben revisarse en cierre para validar margen real y evitar descuentos no autorizados.
`,
  },
  {
    id: "11-creditos-cobranza",
    title: "Creditos Y Cobranza",
    subtitle: "Registro de cartera, pagos y efecto en metricas.",
    audience: "Admin, distribuidor autorizado",
    readingTime: "8 min",
    tags: ["creditos", "ventas", "cobranza"],
    icon: CreditCard,
    checkpoints: [
      "Asociar credito a cliente valido.",
      "Registrar pago inicial cuando exista abono.",
      "Monitorear la cartera pendiente en el panel de ventas.",
    ],
    markdown: `## Ventas con pago a plazos

- Cuando se registra una venta con pago a plazos o credito, el sistema crea la cuenta por cobrar automaticamente.
- Puedes definir fecha de vencimiento y registrar abono inicial.
- Cada pago posterior actualiza el saldo y el estado de la deuda.

## Pantallas clave

- Admin: /admin/credits y /admin/credits/:id.
- Distribuidor: /distributor/credits.

## Impacto en reportes

- Las ventas pendientes y confirmadas impactan conversion y caja del negocio.
- La cartera pendiente muestra el dinero por cobrar para priorizar gestion.
`,
  },
  {
    id: "12-garantias-defectuosos",
    title: "Garantias Y Defectuosos",
    subtitle: "Control de perdida, reposicion y ajuste de utilidad.",
    audience: "Admin, calidad, soporte",
    readingTime: "9 min",
    tags: ["garantias", "calidad", "postventa"],
    icon: ShieldCheck,
    checkpoints: [
      "Reportar defectuoso con razon y cantidad real.",
      "Diferenciar si hay reposicion del proveedor o perdida total.",
      "Auditar perdidas por defectuoso al cierre mensual.",
    ],
    markdown: `## Registro de defectuosos

- Puede originarse desde una venta con garantia o desde un reporte manual.
- Tipos de resolucion:
  - Reposicion del proveedor: se espera reemplazo, sin reconocer perdida inmediata.
  - Perdida total: se reconoce la perdida economica del producto.

## Impacto financiero

- Cuando hay perdida total, la rentabilidad del periodo se ajusta a la baja.
- Los indicadores de calidad y perdida se integran al historial de resultados.

## Rutas y modulos

- /admin/defective-products
- /admin/warranties
- /distributor/defective-reports
- /distributor/warranties
`,
  },
  {
    id: "13-gastos-rentabilidad",
    title: "Gastos, Retiros Y Rentabilidad",
    subtitle: "Gastos operativos, retiro de inventario y utilidad neta.",
    audience: "Admin financiero",
    readingTime: "10 min",
    tags: ["gastos", "rentabilidad", "finanzas"],
    icon: ClipboardList,
    checkpoints: [
      "Registrar gasto con categoria y fecha precisa.",
      "Documentar motivo en retiro de inventario.",
      "Comparar utilidad neta contra gastos y defectuosos.",
    ],
    markdown: `## Gastos

- Permite registrar, actualizar y corregir gastos del negocio.
- Ofrece filtros por periodo para analizar evolucion mensual.
- Muestra categorias con mayor salida de caja para tomar decisiones.

## Retiro de inventario como gasto

- Permite retirar mercancia desde bodega, sede o distribuidor.
- Exige motivo y cantidad validada para mantener control.
- Convierte ese retiro en gasto rastreable para auditoria.

## Historial de rentabilidad

- Presenta una vista consolidada de ganancia, comisiones y deducciones.
- Integra gastos operativos y perdidas por defectuosos.
- Permite comparar utilidad por origen de la mercancia.
`,
  },
  {
    id: "14-analitica-auditoria",
    title: "Analitica Avanzada Y Auditoria",
    subtitle: "KPIs, exportables y trazabilidad de acciones del sistema.",
    audience: "Direccion y operaciones",
    readingTime: "11 min",
    tags: ["analitica", "reportes", "auditoria"],
    icon: BarChart3,
    checkpoints: [
      "Definir rango de fechas antes de exportar.",
      "Usar reporte maestro para cierre operativo.",
      "Revisar la bitacora de auditoria ante incidencias de seguridad.",
    ],
    markdown: `## Tablero avanzado

- Resume ingresos, utilidad, productos destacados y rendimiento por categoria.
- Compara ventas en proceso contra ventas cerradas.
- Permite revisar rotacion de productos por periodos.
- Integra cartera pendiente, gastos y alertas de inventario.

## Exportacion

- Permite descargar informes ejecutivos en PDF.
- Permite exportar rankings en PDF o Excel.
- Entrega reporte maestro con ventas, inventario, gastos y distribuidores.
- La descarga completa de datos respeta las politicas de privacidad financiera.

## Bitacora de auditoria

- Permite filtrar por modulo, accion, gravedad y periodo.
- Muestra estadisticas para detectar riesgos operativos.
- Cada evento conserva detalle de usuario y contexto de la accion.
`,
  },
  {
    id: "15-gamificacion-rankings",
    title: "Gamificacion, Niveles Y Rankings",
    subtitle: "Competencia comercial y bonos de comision variable.",
    audience: "Direccion comercial y distribuidores",
    readingTime: "7 min",
    tags: ["gamificacion", "rankings", "comisiones"],
    icon: Trophy,
    checkpoints: [
      "Configurar periodos y reglas de puntos de forma explicita.",
      "Revisar podio y ganadores por ciclo.",
      "Validar que bonus no rompa politica de comision fija.",
    ],
    markdown: `## Que cubre el modulo

- Ranking actual por periodo (actual o personalizado).
- Historial de ganadores y bonos otorgados.
- Podio visual y tabla completa por distribuidor.

## Indicadores comerciales clave

- Facturacion acumulada del periodo.
- Utilidad acumulada del periodo.
- Puntos obtenidos por cumplimiento.
- Victorias comerciales por ciclo.

## Regla de convivencia con comision fija

Si un distribuidor tiene comision fija activa, la jerarquia de comision fija domina sobre bonus de gamificacion.
`,
  },
  {
    id: "16-god-saas",
    title: "Panel Del dueño Y Gestion SaaS",
    subtitle: "Control central de usuarios, incidencias y planes globales.",
    audience: "dueño",
    readingTime: "10 min",
    tags: ["dueño", "plataforma", "suscripciones"],
    icon: Crown,
    checkpoints: [
      "Aplicar acciones de usuario con duracion definida.",
      "Actualizar estados de incidencias con trazabilidad.",
      "Guardar planes globales solo tras revisar impacto.",
    ],
    markdown: `## Tab Usuarios

- Lista de responsables administrativos de alto nivel.
- Acciones: activar, extender, pausar, reanudar, suspender, eliminar.
- Filtro por estado y buscador por texto.

## Tab Incidencias

- Reportes de fallos por estado operativo.
- Cambio de estado desde panel.

## Tab Suscripciones

- Gestion de plan por negocio (starter/pro/enterprise).
- Limites personalizados de sedes y distribuidores.
- Modo mantenimiento global.
- Edicion de precios y funciones por plan.

## Seguridad de operacion del dueño

El panel incluye control estricto por perfil. Si el usuario no es dueño, se bloquea el acceso automaticamente.
`,
  },
  {
    id: "17-seguridad-privacidad",
    title: "Seguridad De Datos Y Reglas Inviolables",
    subtitle:
      "Blindaje financiero, comision fija y consistencia de inventario.",
    audience: "Tecnologia, auditoria, direccion",
    readingTime: "12 min",
    tags: ["seguridad", "privacidad", "comisiones", "operacion"],
    icon: Lock,
    checkpoints: [
      "Nunca exponer costo de compra, costo promedio, proveedor ni utilidad sin autorizacion.",
      "Respetar la comision fija cuando este definida para un distribuidor.",
      "Registrar toda salida y recepcion de mercancia en el historial de movimientos.",
    ],
    markdown: `## Blindaje financiero

- El sistema protege automaticamente los datos financieros sensibles.
- Si un perfil no tiene permiso para ver costos, esos datos no se muestran.
- Esto evita fugas de informacion y protege la estrategia comercial.

## Contexto de privacidad

La decision de ocultar informacion se basa en:

- Perfil de usuario.
- Permisos financieros asignados.
- Politica de privacidad definida por la empresa.

## Jerarquia de comisiones

La regla es directa:

1. Si un distribuidor tiene comision fija, ese porcentaje manda.
2. Si no tiene comision fija, se aplica el esquema variable del negocio.

Esto evita conflictos y mantiene consistencia en liquidaciones.

## Integridad de inventario

- Cada despacho y cada recepcion quedan trazados.
- Las ventas promocionales tambien descuentan inventario de forma controlada.
- Las transferencias entre actores mantienen historial para auditoria.

## Exportacion sensible

Cuando una cuenta opera con privacidad financiera reforzada, la exportacion masiva oculta informacion sensible.
`,
  },
  {
    id: "18-checklists-operacion",
    title: "Checklists Operativos Y Soporte",
    subtitle: "Rutina diaria para operar rapido y sin romper reglas.",
    audience: "Operacion diaria",
    readingTime: "8 min",
    tags: ["operacion", "control", "soporte"],
    icon: AlertTriangle,
    checkpoints: [
      "Apertura: negocio, stock y metodos de pago listos.",
      "Durante turno: validar origen de stock en cada venta.",
      "Cierre: transferencias, despachos y conciliacion revisados.",
    ],
    markdown: `## Apertura de turno

1. Verificar sesion y cuenta activa de tu Empresa.
2. Revisar alertas de stock.
3. Confirmar metodos de pago y delivery.
4. Validar responsabilidades del equipo del dia.

## Durante operación

1. Registrar ventas en el modulo correcto (estandar, promocional o especial).
2. Confirmar estado de pago y credito.
3. Documentar garantias y defectuosos sin retraso.
4. Mantener evidencia de despachos y recepciones.

## Cierre de turno

1. Revisar transferencias pendientes.
2. Confirmar despachos en transito.
3. Validar gastos del dia.
4. Descargar reporte si el proceso lo exige.

## Escalamiento de incidencias

- Error funcional repetible: reportar en la bandeja de incidencias con pasos claros.
- Diferencia de stock: congelar movimiento y auditar ultima transferencia/despacho.
- Duda de comision: revisar si el usuario tiene comision fija activa.
`,
  },
];

const allTags = [
  "all",
  ...Array.from(new Set(manualSections.flatMap(section => section.tags))).sort(
    (left, right) => left.localeCompare(right)
  ),
];

export default function ManualPage() {
  const rootRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [activeId, setActiveId] = useState(manualSections[0].id);
  const [query, setQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState("all");
  const [copiedSectionId, setCopiedSectionId] = useState<string | null>(null);

  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const visibleSections = useMemo(() => {
    const search = query.trim().toLowerCase();

    return manualSections.filter(section => {
      const matchesTag =
        selectedTag === "all" || section.tags.includes(selectedTag);

      if (!matchesTag) return false;
      if (!search) return true;

      const haystack = [
        section.title,
        section.subtitle,
        section.audience,
        section.markdown,
        section.tags.join(" "),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [query, selectedTag]);

  useEffect(() => {
    if (visibleSections.length === 0) return;

    const stillVisible = visibleSections.some(
      section => section.id === activeId
    );
    if (!stillVisible) {
      setActiveId(visibleSections[0].id);
    }
  }, [activeId, visibleSections]);

  const activeSection = useMemo(() => {
    if (visibleSections.length === 0) return null;
    return (
      visibleSections.find(section => section.id === activeId) ||
      visibleSections[0]
    );
  }, [activeId, visibleSections]);

  const activeIndex = activeSection
    ? visibleSections.findIndex(section => section.id === activeSection.id)
    : -1;
  const progressPercentage =
    activeSection && visibleSections.length > 0
      ? Math.round(((activeIndex + 1) / visibleSections.length) * 100)
      : 0;
  const isFirstSection = activeIndex <= 0;
  const isLastSection =
    activeIndex === -1 || activeIndex >= visibleSections.length - 1;

  const totalRoutes = routeCoverage.reduce(
    (sum, entry) => sum + entry.count,
    0
  );
  const ActiveSectionIcon = activeSection?.icon ?? BookOpen;

  useLayoutEffect(() => {
    if (prefersReducedMotion || !rootRef.current) return;

    const context = gsap.context(() => {
      gsap.from(".manual-hero", {
        autoAlpha: 0,
        y: 24,
        duration: 0.6,
        ease: "power2.out",
      });

      gsap.from(".manual-kpi", {
        autoAlpha: 0,
        y: 16,
        duration: 0.45,
        ease: "power2.out",
        stagger: 0.08,
        delay: 0.15,
      });

      gsap.from(".manual-nav-item", {
        autoAlpha: 0,
        x: -16,
        duration: 0.32,
        ease: "power2.out",
        stagger: 0.03,
        delay: 0.2,
      });
    }, rootRef);

    return () => context.revert();
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!activeSection || !contentRef.current || prefersReducedMotion) return;

    gsap.fromTo(
      contentRef.current,
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.32, ease: "power2.out" }
    );
  }, [activeSection, prefersReducedMotion]);

  useEffect(() => {
    if (!progressRef.current) return;
    const width = `${progressPercentage}%`;

    if (prefersReducedMotion) {
      progressRef.current.style.width = width;
      return;
    }

    gsap.to(progressRef.current, {
      width,
      duration: 0.4,
      ease: "power3.out",
    });
  }, [prefersReducedMotion, progressPercentage]);

  const goToRelativeSection = (direction: -1 | 1) => {
    const targetIndex = activeIndex + direction;
    if (targetIndex < 0 || targetIndex >= visibleSections.length) return;
    setActiveId(visibleSections[targetIndex].id);
  };

  const handleCopyChecklist = async () => {
    if (!activeSection) return;

    const checklistText = [
      `Checklist: ${activeSection.title}`,
      ...activeSection.checkpoints.map(
        (item, index) => `${index + 1}. ${item}`
      ),
    ].join("\n");

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(checklistText);
      } else {
        const helper = document.createElement("textarea");
        helper.value = checklistText;
        helper.setAttribute("readonly", "");
        helper.style.position = "fixed";
        helper.style.top = "-9999px";
        document.body.appendChild(helper);
        helper.select();
        document.execCommand("copy");
        document.body.removeChild(helper);
      }

      setCopiedSectionId(activeSection.id);
      window.setTimeout(() => setCopiedSectionId(null), 1800);
    } catch {
      window.alert("No se pudo copiar el checklist.");
    }
  };

  return (
    <div
      ref={rootRef}
      className="bg-app-base relative min-h-screen overflow-x-hidden px-3 py-6 text-slate-100 sm:px-5 md:px-8 lg:px-10"
      style={{
        fontFamily: "'Space Grotesk', 'Sora', 'Montserrat', sans-serif",
      }}
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-[-90px] h-[420px] w-[420px] rounded-full bg-cyan-400/15 blur-[120px]" />
        <div className="absolute right-[-140px] top-14 h-[460px] w-[460px] rounded-full bg-amber-400/15 blur-[130px]" />
        <div className="bg-emerald-500/12 absolute bottom-[-180px] left-1/4 h-[440px] w-[440px] rounded-full blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(7,11,20,0.92),rgba(10,16,28,0.87),rgba(6,10,16,0.96))]" />
        <div className="bg-size-[30px_30px] absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] opacity-40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,rgba(34,211,238,0.15),transparent_35%),radial-gradient(circle_at_85%_0%,rgba(251,191,36,0.14),transparent_40%)]" />
      </div>

      <div className="relative mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="manual-hero rounded-4xl relative overflow-hidden border border-white/15 bg-[linear-gradient(130deg,rgba(15,23,42,0.94),rgba(30,41,59,0.86),rgba(15,23,42,0.95))] px-5 py-6 shadow-[0_34px_90px_-50px_rgba(34,211,238,0.65)] sm:px-8 sm:py-8">
          <div className="pointer-events-none absolute -right-20 -top-16 h-56 w-56 rounded-full border border-cyan-300/20" />
          <div className="pointer-events-none absolute -bottom-24 left-20 h-60 w-60 rounded-full border border-amber-300/15" />

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <span className="inline-flex min-h-9 items-center rounded-full border border-cyan-300/35 bg-cyan-400/10 px-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-100">
                Manual Supremo Essence ERP
              </span>
              <h1 className="mt-4 text-3xl font-bold leading-tight text-white sm:text-4xl lg:text-[2.85rem]">
                Centro Maestro De Operacion
              </h1>
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-200/95 sm:text-base">
                Guia ejecutiva para dirigir ventas, inventario, logistica y
                rentabilidad con reglas claras de comision y privacidad. Todo lo
                que lees aqui refleja el comportamiento real del sistema en
                operacion.
              </p>

              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex min-h-10 items-center rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-slate-100">
                  {manualSections.length} secciones
                </span>
                <span className="inline-flex min-h-10 items-center rounded-full border border-cyan-300/40 bg-cyan-500/15 px-3.5 py-1 text-cyan-100">
                  {totalRoutes} rutas cubiertas
                </span>
                <span className="inline-flex min-h-10 items-center rounded-full border border-amber-300/40 bg-amber-500/15 px-3.5 py-1 text-amber-100">
                  Paso {activeIndex + 1 > 0 ? activeIndex + 1 : 0} de{" "}
                  {visibleSections.length}
                </span>
              </div>

              <p className="mt-4 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-cyan-100/90">
                <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
                Modo guia activa para operacion de campo
              </p>
            </div>

            <div className="rounded-3xl border border-white/15 bg-black/30 p-4 backdrop-blur-sm sm:p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold uppercase tracking-[0.12em] text-white">
                  Progreso de lectura
                </p>
                <span className="rounded-full border border-cyan-300/35 bg-cyan-400/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-cyan-100">
                  {progressPercentage}%
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-300/90">
                {progressPercentage}% completado en el filtro actual
              </p>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10">
                <div
                  ref={progressRef}
                  className="h-full rounded-full bg-[linear-gradient(90deg,rgba(34,211,238,0.96),rgba(251,191,36,0.94))]"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                {routeCoverage.map(item => (
                  <div
                    key={item.label}
                    className="manual-kpi rounded-2xl border border-white/10 bg-[linear-gradient(165deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300">
                        {item.label}
                      </p>
                      <p className="text-base font-bold text-white">
                        {item.count}
                      </p>
                    </div>
                    <p className="mt-1 text-[11px] leading-snug text-slate-400">
                      {item.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[340px,minmax(0,1fr)]">
          <aside className="w-full min-w-0 max-w-full overflow-hidden rounded-[1.8rem] border border-white/15 bg-[linear-gradient(170deg,rgba(9,14,24,0.95),rgba(11,18,30,0.95))] p-4 shadow-[0_26px_80px_-55px_rgba(0,0,0,0.95)] lg:sticky lg:top-24 lg:h-fit">
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                Buscar contenido
              </label>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-300" />
                <input
                  type="text"
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Ej: despachos, comision fija, catalogo"
                  className="min-h-11 w-full rounded-xl border border-white/15 bg-black/35 pl-10 pr-3 text-sm text-white placeholder:text-slate-400 focus:border-cyan-300/70 focus:outline-none"
                />
              </div>
            </div>

            <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 p-2.5">
              <div className="max-h-40 overflow-y-auto overflow-x-hidden pr-1">
                <div className="flex flex-wrap gap-2">
                  {allTags.map(tag => {
                    const isActive = tag === selectedTag;
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => setSelectedTag(tag)}
                        className={`min-h-11 whitespace-nowrap rounded-full border px-3.5 text-[11px] font-semibold uppercase tracking-[0.12em] transition ${
                          isActive
                            ? "border-cyan-300/70 bg-cyan-400/15 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]"
                            : "border-white/15 bg-white/5 text-slate-200 hover:border-white/25 hover:bg-white/10"
                        }`}
                      >
                        {tag === "all" ? "Todo" : tag.replace(/-/g, " ")}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <nav className="space-y-2.5">
              {visibleSections.map(section => {
                const Icon = section.icon;
                const isActive = activeSection?.id === section.id;

                return (
                  <button
                    key={section.id}
                    data-manual-nav="item"
                    type="button"
                    onClick={() => setActiveId(section.id)}
                    className={`manual-nav-item group relative w-full overflow-hidden rounded-2xl border px-3 py-3 text-left transition ${
                      isActive
                        ? "border-cyan-300/60 bg-[linear-gradient(150deg,rgba(34,211,238,0.18),rgba(15,23,42,0.75))] text-white"
                        : "border-transparent bg-white/0 text-gray-100 hover:border-white/15 hover:bg-white/10"
                    }`}
                  >
                    <span
                      className={`absolute left-0 top-0 h-full w-1 transition ${
                        isActive
                          ? "bg-[linear-gradient(180deg,rgba(34,211,238,1),rgba(251,191,36,0.95))]"
                          : "bg-transparent group-hover:bg-white/30"
                      }`}
                    />

                    <div className="flex items-start gap-3">
                      <span
                        className={`mt-0.5 rounded-xl p-2.5 transition ${
                          isActive
                            ? "bg-cyan-400/18 text-cyan-100"
                            : "bg-white/5 text-slate-200 group-hover:bg-white/10"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>

                      <div className="min-w-0">
                        <p className="font-semibold leading-tight text-white">
                          {section.title}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-slate-300">
                          {section.subtitle}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-white/15 bg-black/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-slate-200">
                            {section.readingTime}
                          </span>
                          <span className="wrap-break-word max-w-full whitespace-normal rounded-full border border-amber-300/35 bg-amber-500/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-amber-100">
                            {section.audience}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {visibleSections.length === 0 && (
                <div className="rounded-xl border border-amber-400/35 bg-amber-500/10 p-3 text-xs text-amber-100">
                  No hay coincidencias con los filtros actuales.
                </div>
              )}
            </nav>
          </aside>

          <div className="rounded-[1.95rem] border border-white/15 bg-[linear-gradient(165deg,rgba(12,18,30,0.95),rgba(8,13,22,0.97))] p-5 shadow-[0_35px_100px_-55px_rgba(0,0,0,0.98)] sm:p-7 lg:p-9">
            {activeSection ? (
              <>
                <div className="mb-6 border-b border-white/10 pb-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-cyan-300/30 bg-cyan-400/10 text-cyan-100">
                        <ActiveSectionIcon className="h-5 w-5" />
                      </span>

                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                          Seccion activa
                        </p>
                        <h2 className="mt-1 text-2xl font-semibold text-white sm:text-[1.85rem]">
                          {activeSection.title}
                        </h2>
                        <p className="mt-1 text-sm leading-relaxed text-slate-300">
                          {activeSection.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-cyan-300/35 bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-cyan-100">
                        {activeSection.readingTime}
                      </span>
                      <span className="rounded-full border border-amber-300/35 bg-amber-500/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-amber-100">
                        {activeSection.audience}
                      </span>
                    </div>
                  </div>
                </div>

                <article
                  ref={contentRef}
                  key={activeSection.id}
                  className="prose prose-invert prose-headings:font-semibold prose-headings:text-white prose-h2:mt-0 prose-h2:border-b prose-h2:border-white/10 prose-h2:pb-2 prose-h2:text-[1.6rem] prose-h3:text-xl prose-p:leading-relaxed prose-p:text-slate-100 prose-strong:text-white prose-ul:text-slate-100 prose-ol:text-slate-100 prose-li:text-slate-100 prose-li:marker:text-cyan-300 prose-a:text-cyan-200 hover:prose-a:text-cyan-100 prose-code:text-cyan-100 max-w-none [&_table]:w-full [&_table]:overflow-hidden [&_table]:rounded-xl [&_table]:border [&_table]:border-white/15 [&_tbody_tr]:border-b [&_tbody_tr]:border-white/10 [&_td]:px-3 [&_td]:py-2 [&_th]:px-3 [&_th]:py-2 [&_thead]:bg-white/5"
                >
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {activeSection.markdown}
                  </ReactMarkdown>
                </article>

                <div className="mt-8 rounded-3xl border border-emerald-300/20 bg-[linear-gradient(160deg,rgba(16,185,129,0.10),rgba(15,23,42,0.72))] p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-emerald-100">
                      <ClipboardList className="h-4 w-4" />
                      Checklist de ejecucion
                    </h3>
                    <button
                      type="button"
                      onClick={handleCopyChecklist}
                      className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-black/30 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-100 transition hover:border-cyan-300/60 hover:bg-cyan-500/15"
                    >
                      {copiedSectionId === activeSection.id ? (
                        <>
                          <Check className="h-4 w-4 text-emerald-300" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4" />
                          Copiar
                        </>
                      )}
                    </button>
                  </div>

                  <ul className="mt-3 space-y-2.5 text-sm text-slate-200">
                    {activeSection.checkpoints.map(item => (
                      <li
                        key={item}
                        className="flex min-h-11 items-start gap-2 rounded-xl border border-white/15 bg-black/25 px-3 py-2"
                      >
                        <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-200">
                          <Check className="h-3 w-3" />
                        </span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-5">
                  <button
                    type="button"
                    onClick={() => goToRelativeSection(-1)}
                    disabled={isFirstSection}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-4 text-sm font-medium text-gray-100 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Anterior
                  </button>

                  <p className="text-xs text-slate-300">
                    Usa filtros y busqueda para saltar rapido entre temas.
                  </p>

                  <button
                    type="button"
                    onClick={() => goToRelativeSection(1)}
                    disabled={isLastSection}
                    className="bg-cyan-500/18 hover:bg-cyan-500/28 inline-flex min-h-11 items-center gap-2 rounded-xl border border-cyan-300/45 px-4 text-sm font-medium text-cyan-100 transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-amber-400/35 bg-amber-500/10 p-5 text-sm text-amber-100">
                No hay secciones disponibles para los filtros actuales.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
