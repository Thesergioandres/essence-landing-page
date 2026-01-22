# 📱 Guía Completa de UX/UI Móvil - Essence ERP

## 🎯 Solución al Problema Crítico

### Problema Identificado

Los elementos superiores quedaban ocultos por la barra del sistema móvil (hora, batería, WiFi, notch, cámara).

### Solución Implementada ✅

#### 1. **Variables CSS para Safe Areas**

```css
:root {
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
  --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-inset-left: env(safe-area-inset-left, 0px);
  --safe-area-inset-right: env(safe-area-inset-right, 0px);

  --mobile-header-height: calc(3.5rem + var(--safe-area-inset-top));
  --desktop-header-height: 4rem;
}
```

**Justificación**: Las variables CSS permiten una gestión centralizada y reutilizable de las safe areas, adaptándose automáticamente a diferentes dispositivos.

#### 2. **Clases Utility para Safe Areas**

```css
.safe-top { padding-top: var(--safe-area-inset-top); }
.safe-bottom { padding-bottom: var(--safe-area-inset-bottom); }
.safe-left { padding-left: var(--safe-area-inset-left); }
.safe-right { padding-right: var(--safe-area-inset-right); }
.safe-x { padding-left & right }
.safe-y { padding-top & bottom }
```

**Justificación**: Facilita la aplicación consistente de safe areas en cualquier componente sin repetir código.

#### 3. **Headers con Safe Area**

```css
.mobile-header-safe {
  top: 0;
  padding-top: var(--safe-area-inset-top);
  height: var(--mobile-header-height);
}

.content-with-safe-header {
  padding-top: var(--mobile-header-height);
}
```

**Justificación**: Garantiza que el header nunca sea tapado por notches, cámaras o barras del sistema.

---

## 📐 Arquitectura de Layout Móvil

### Estructura de Capas Z-Index

```
┌─────────────────────────────────────┐
│ Z-50: Navbar público               │ ← Safe area top aplicada
├─────────────────────────────────────┤
│ Z-40: Sidebar overlay              │
├─────────────────────────────────────┤
│ Z-30: DashboardLayout Header       │ ← Safe area top aplicada
├─────────────────────────────────────┤
│ Z-20: DistributorLayout Header     │ ← Safe area top aplicada
├─────────────────────────────────────┤
│ Z-10: Modals y dropdowns           │
├─────────────────────────────────────┤
│ Z-0: Contenido principal           │ ← Padding top con safe area
└─────────────────────────────────────┘
```

**Justificación**: Jerarquía clara previene overlapping y asegura que elementos críticos estén siempre accesibles.

---

## 📱 Diseño Orientación Vertical (Portrait)

### Safe Zones Diagram

```
┌───────────────────────────────────┐
│ ⚠️ SAFE AREA TOP (variable)      │ ← 20-44px según dispositivo
├───────────────────────────────────┤
│ 📌 HEADER (56px + safe-top)      │ ← Logo, menú, acciones
├───────────────────────────────────┤
│                                   │
│  👆 ZONA DE PULGAR               │ ← Elementos interactivos
│  (350-600px desde abajo)          │   principales aquí
│                                   │
│  📊 CONTENIDO PRINCIPAL          │ ← Grid, listas, cards
│  (scroll vertical)                │
│                                   │
│  🎯 ACCIONES FRECUENTES          │ ← FABs, botones fijos
│  (80-120px desde abajo)           │
│                                   │
├───────────────────────────────────┤
│ ⚠️ SAFE AREA BOTTOM (variable)   │ ← 0-34px según dispositivo
└───────────────────────────────────┘
```

### Espaciado Recomendado

- **Top padding**: `calc(3.5rem + env(safe-area-inset-top))`
- **Bottom padding**: `max(1rem, env(safe-area-inset-bottom))`
- **Lateral padding**: `env(safe-area-inset-left/right)` + `0.75rem`
- **Entre secciones**: `1.5rem` (24px)
- **Entre cards**: `1rem` (16px)

**Justificación**:

- El pulgar alcanza cómodamente 350-600px desde la parte inferior
- FABs y botones principales deben estar en esta zona
- Contenido secundario puede estar más arriba (scrollable)

### Tamaños de Toque Mínimos

```css
button,
a,
input,
select,
textarea {
  min-height: 44px; /* iOS Human Interface Guidelines */
  min-width: 44px;
}
```

**Justificación**: Apple y Google recomiendan mínimo 44x44px para garantizar precisión táctil.

---

## 🔄 Diseño Orientación Horizontal (Landscape)

### Layout Adaptativo

```
┌────────────┬────────────────────────────────────────┐
│            │ ⚠️ SAFE TOP (reducido en landscape)   │
│  SIDEBAR   ├────────────────────────────────────────┤
│  (Desktop  │ 📌 HEADER (compacto, 48px)            │
│   style)   ├────────────────────────────────────────┤
│            │                                        │
│  Nav       │  📊 CONTENIDO EN GRID 2-3 COLUMNAS   │
│  Items     │  (aprovecha ancho disponible)          │
│            │                                        │
│            │  🎯 Acciones flotantes lado derecho   │
│            │                                        │
└────────────┴────────────────────────────────────────┘
⚠️ SAFE LEFT  ⚠️ SAFE RIGHT
```

### Reglas de Landscape

```css
@media (orientation: landscape) and (max-height: 500px) {
  /* Reducir altura de header */
  .mobile-header-safe {
    height: calc(3rem + var(--safe-area-inset-top));
  }

  /* Cambiar layout a horizontal */
  .mobile-grid {
    grid-template-columns: repeat(2, 1fr);
  }

  /* Reducir padding vertical */
  .content-section {
    padding-top: 1rem;
    padding-bottom: 1rem;
  }
}
```

**Justificación**: En landscape el espacio vertical es limitado, por lo que:

- Headers más compactos (48px vs 56px)
- Contenido en columnas múltiples
- Menos padding vertical
- Navegación lateral estilo desktop

---

## 🎨 Jerarquía Visual y Tipografía

### Escala Tipográfica Móvil

```css
/* Portrait */
h1: 1.75rem (28px) - max 2.25rem (36px)
h2: 1.5rem (24px)
h3: 1.25rem (20px)
body: 0.875rem (14px) base
small: 0.75rem (12px)
button: 0.875rem (14px) - 1rem (16px)

/* Landscape - reducir 10-15% */
h1: 1.5rem (24px)
h2: 1.25rem (20px)
body: 0.8125rem (13px)
```

**Justificación**:

- Escala legible sin necesidad de zoom
- Respeta limitaciones de espacio en landscape
- Fuente base 14px previene zoom automático en iOS

### Contraste y Legibilidad

```css
/* Mínimos WCAG AAA */
Texto normal: 7:1 contrast ratio
Texto grande (18px+): 4.5:1 contrast ratio
Elementos interactivos: área 44x44px mínimo
```

---

## 🖐️ Ergonomía: Zonas de Alcance del Pulgar

### Mapa de Calor de Accesibilidad (Uso con una mano)

```
┌─────────────────────────────────┐
│  🔴 DIFÍCIL                     │ ← Esquina superior
│    (requiere reajustar agarre)  │
├─────────────────────────────────┤
│  🟡 MEDIO                       │ ← Parte superior-media
│    (estirable)                  │
├─────────────────────────────────┤
│  🟢 FÁCIL                       │ ← Centro-inferior
│    (pulgar natural)             │   ZONA ÓPTIMA
│                                 │
│  🟢🟢 MUY FÁCIL                 │ ← Inferior derecha
│    (alcance inmediato)          │   para diestros
└─────────────────────────────────┘
```

### Recomendaciones de Posicionamiento

- **Acciones primarias**: Zona verde (350-550px desde abajo)
- **Acciones secundarias**: Zona amarilla (550-750px desde abajo)
- **Información pasiva**: Zona roja (arriba de 750px)
- **Navegación**: Bottom nav o FAB en zona verde

**Componentes implementados**:

```tsx
// FAB (Floating Action Button) - zona óptima
<button className="fixed bottom-20 right-4 z-40
  safe-bottom safe-right">
  Acción Principal
</button>

// Bottom Navigation - alcance inmediato
<nav className="fixed bottom-0 left-0 right-0
  safe-bottom safe-x pb-4">
  {/* Items de navegación */}
</nav>
```

---

## 🔧 Componentes Optimizados para Móvil

### 1. Navbar Responsivo

```tsx
<nav className="sticky top-0 z-50 safe-top">
  <div className="safe-x">
    <div className="flex min-h-[3.5rem] items-center">{/* Contenido */}</div>
  </div>
</nav>
```

**Características**:

- ✅ Respeta safe-area-inset-top
- ✅ Altura mínima 56px + safe area
- ✅ Padding lateral respeta notches laterales
- ✅ Sticky positioning para scroll

### 2. Dashboard Header

```tsx
<div className="fixed top-0 z-30 mobile-header-safe">
  <div className="flex h-full items-center safe-x">
    {/* Logo, menú hamburger, acciones */}
  </div>
</div>

<main className="content-with-safe-header">
  {/* Contenido con padding-top automático */}
</main>
```

**Características**:

- ✅ Header fijo que nunca se esconde
- ✅ Altura dinámica según safe area
- ✅ Contenido inicia después del header
- ✅ No overlapping garantizado

### 3. Cards Táctiles

```tsx
<div
  className="touch-card active:scale-[0.98] 
  transition-transform duration-150"
>
  <button className="min-h-[44px] min-w-[44px] p-3">Acción</button>
</div>
```

**Características**:

- ✅ Feedback visual en touch (scale)
- ✅ Área táctil mínima 44x44px
- ✅ Transiciones suaves
- ✅ Prevención de double-tap zoom

### 4. Inputs Optimizados

```tsx
<input
  type="text"
  className="min-h-[48px] text-base px-4"
  autoComplete="off"
  autoCorrect="off"
  spellCheck="false"
/>
```

**Características**:

- ✅ font-size: 16px previene zoom en iOS
- ✅ Altura 48px para toque cómodo
- ✅ Padding generoso (16px)
- ✅ Autocomplete desactivado cuando aplique

### 5. Modal Mobile-First

```tsx
<div
  className="fixed inset-0 z-50 
  pt-safe-top pb-safe-bottom px-safe-x"
>
  <div className="h-full overflow-y-auto">{/* Contenido modal */}</div>
</div>
```

**Características**:

- ✅ Fullscreen en móvil
- ✅ Respeta todas las safe areas
- ✅ Scroll interno cuando necesario
- ✅ Fácil dismissal (swipe down opcional)

---

## 📊 Breakpoints y Media Queries

### Sistema de Breakpoints

```css
/* Mobile First Approach */
/* xs: 0-640px (base, móvil portrait) */
.container {
  padding: 0.75rem;
}

/* sm: 640px+ (móvil landscape, tablet pequeño) */
@media (min-width: 640px) {
  .container {
    padding: 1rem;
  }
}

/* md: 768px+ (tablet portrait) */
@media (min-width: 768px) {
  .container {
    padding: 1.5rem;
  }
  .grid-mobile {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* lg: 1024px+ (tablet landscape, desktop) */
@media (min-width: 1024px) {
  .sidebar {
    display: block;
  }
  .mobile-header {
    display: none;
  }
}

/* xl: 1280px+ (desktop grande) */
@media (min-width: 1280px) {
  .container {
    max-width: 1200px;
  }
}
```

### Queries Especiales

```css
/* Solo portrait móvil */
@media (max-width: 768px) and (orientation: portrait) {
  .stack-vertical {
    flex-direction: column;
  }
}

/* Solo landscape móvil */
@media (max-width: 1024px) and (orientation: landscape) {
  .header {
    height: 48px;
  }
  .grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Dispositivos táctiles */
@media (hover: none) and (pointer: coarse) {
  .hover-effect:hover {
    /* desactivar */
  }
  .active-state:active {
    transform: scale(0.98);
  }
}

/* Preferencia reducir movimiento */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
  }
}
```

---

## 🚀 Optimizaciones de Rendimiento Móvil

### 1. Aceleración GPU

```css
.gpu-accelerated {
  transform: translateZ(0);
  backface-visibility: hidden;
  perspective: 1000px;
  will-change: transform;
}
```

**Cuándo usar**: Animaciones, transiciones, scroll suave.

### 2. Lazy Loading

```tsx
// Imágenes
<img loading="lazy" decoding="async" />;

// Componentes
const HeavyComponent = lazy(() => import("./Heavy"));
```

### 3. Prevención de Reflows

```css
/* Usar transform en lugar de top/left */
.animate {
  transform: translateY(10px); /* ✅ GPU */
  /* top: 10px; ❌ CPU, causa reflow */
}
```

### 4. Touch Optimization

```css
body {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  touch-action: manipulation;
  -webkit-overflow-scrolling: touch;
}
```

---

## 🎯 Checklist de Implementación

### ✅ Safe Areas

- [x] Variables CSS configuradas
- [x] Clases utility creadas
- [x] Navbar con safe-top
- [x] Headers de dashboard con safe areas
- [x] Contenido con padding ajustado
- [x] Modals respetando safe areas
- [ ] Verificar en todos los componentes

### ✅ Ergonomía

- [x] Áreas táctiles mínimo 44x44px
- [x] Botones principales en zona de pulgar
- [x] Feedback visual en interacciones
- [x] Navegación accesible con una mano
- [ ] FABs en posición óptima (por implementar)
- [ ] Bottom navigation (evaluar necesidad)

### ✅ Tipografía

- [x] Escala responsiva configurada
- [x] Font-size base 14px (16px en inputs)
- [x] Contraste WCAG AAA
- [x] Line-height apropiados
- [ ] Verificar legibilidad en todos los textos

### ✅ Layout Adaptativo

- [x] Mobile-first approach
- [x] Breakpoints consistentes
- [x] Grid fluido portrait/landscape
- [x] Headers compactos en landscape
- [ ] Sidebar colapsable en tablet

### ✅ Performance

- [x] GPU acceleration en animaciones
- [x] Lazy loading de imágenes
- [x] Touch optimizations
- [x] Prevención de zoom accidental
- [ ] Code splitting avanzado (evaluar)

---

## 🔍 Testing en Dispositivos Reales

### Dispositivos Prioritarios para Pruebas

#### 📱 iPhone

- iPhone 14 Pro Max (notch dinámico)
- iPhone SE 3rd gen (notch clásico)
- iPhone 11 (pantalla regular)

**Safe area top esperada**: 44-50px en portrait

#### 🤖 Android

- Samsung Galaxy S23+ (cámara punch-hole)
- Google Pixel 7 (cámara centrada)
- Xiaomi Redmi Note (pantalla estándar)

**Safe area top esperada**: 24-32px en portrait

### Herramientas de Testing

```bash
# Chrome DevTools
- Device toolbar → Responsive mode
- "Show device frame" activado
- "Show rulers" para medir

# Firefox
- Responsive Design Mode (Ctrl+Shift+M)
- Emular notches con "Device Pixel Ratio"

# Safari (iOS)
- Inspector Web en dispositivo físico
- View → Show Web Inspector
```

### Casos de Prueba

1. **Scroll vertical**: ¿El header se mantiene visible?
2. **Rotación**: ¿El layout se adapta correctamente?
3. **Teclado virtual**: ¿Los inputs quedan visibles?
4. **Zoom**: ¿Se previene zoom accidental?
5. **Touch targets**: ¿Se puede tocar con precisión?
6. **Safe areas**: ¿Nada queda oculto por notch/barra?

---

## 📖 Recursos y Referencias

### Guías Oficiales

- [Apple Human Interface Guidelines - Safe Areas](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Material Design - Mobile Layout](https://m3.material.io/foundations/layout/understanding-layout/overview)
- [MDN - env(safe-area-inset-\*)](https://developer.mozilla.org/en-US/docs/Web/CSS/env)

### Best Practices

- WCAG 2.1 Level AAA (accesibilidad)
- Google Core Web Vitals (performance)
- iOS 15+ y Android 12+ como base

### Herramientas Recomendadas

- Figma/Sketch con plugins de safe areas
- Chrome DevTools Device Mode
- BrowserStack para testing multi-dispositivo

---

## 🎓 Próximos Pasos Recomendados

### Fase 1: Verificación (Inmediata)

1. ✅ Probar en dispositivo físico iPhone/Android
2. ✅ Verificar todas las páginas tienen safe areas
3. ✅ Medir performance con Lighthouse
4. ✅ Test de accesibilidad con WAVE

### Fase 2: Mejoras Incrementales

1. Implementar bottom navigation si aplica
2. Añadir FABs en páginas críticas
3. Optimizar landscape en formularios largos
4. Mejorar feedback táctil con haptics (si soportado)

### Fase 3: Advanced Features

1. PWA con install prompt
2. Gestos swipe personalizados
3. Dark mode adaptativo
4. Persistencia offline con service workers

---

## 📝 Notas Finales

### Principios de Diseño Móvil

1. **Mobile First**: Diseñar primero para móvil, escalar a desktop
2. **Thumb Zone First**: Elementos críticos donde el pulgar alcanza
3. **Safe Areas Always**: Nunca asumir espacio fijo
4. **Touch Targets**: Mínimo 44x44px siempre
5. **Performance Matters**: Cada byte cuenta en móvil

### Errores Comunes a Evitar

❌ Fixed positioning sin considerar safe areas
❌ Elementos interactivos < 44px
❌ Font-size < 16px en inputs (causa zoom iOS)
❌ Hover states en touch devices
❌ Viewport sin `viewport-fit=cover`

### Mantra del Desarrollador Móvil

> "Si no funciona perfecto en un iPhone 13 mini sostenido con una mano mientras caminas, no está listo para producción."

---

**Documento creado**: Enero 2026  
**Última actualización**: Implementación de safe areas completa  
**Mantenedor**: Equipo Essence ERP  
**Versión**: 1.0.0
