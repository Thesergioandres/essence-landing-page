# 🎨 Componentes de Loading - Guía de Uso

## ✨ Componentes Disponibles

### 1. **LoadingProgress** - Pantalla completa con barra de progreso

Perfecto para pantallas de carga iniciales o transiciones entre páginas.

#### Características:
- ✅ Barra de progreso animada con gradiente
- ✅ Porcentaje en tiempo real (0-100%)
- ✅ Logo animado con efecto ping
- ✅ Puntos animados (bounce)
- ✅ Efecto shimmer en la barra
- ✅ Mensaje personalizable
- ✅ Duración configurable

#### Uso:

```tsx
import LoadingProgress from './components/LoadingProgress';

// Básico
<LoadingProgress />

// Con mensaje personalizado
<LoadingProgress message="Cargando productos..." />

// Con duración específica (en ms)
<LoadingProgress message="Iniciando sesión..." duration={2500} />

// Ejemplo completo
function MyPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData().then(() => setLoading(false));
  }, []);

  if (loading) {
    return <LoadingProgress message="Cargando datos..." duration={3000} />;
  }

  return <div>Contenido...</div>;
}
```

---

### 2. **LoadingSpinner** - Spinner reutilizable

Perfecto para secciones de la página o estados de carga parciales.

#### Variantes:

**Spinner** (default)
```tsx
<LoadingSpinner />
<LoadingSpinner size="lg" message="Cargando..." />
```

**Dots** (puntos saltarines)
```tsx
<LoadingSpinner variant="dots" />
<LoadingSpinner variant="dots" size="md" message="Procesando..." />
```

**Pulse** (pulso circular)
```tsx
<LoadingSpinner variant="pulse" />
<LoadingSpinner variant="pulse" size="xl" />
```

#### Tamaños:
- `sm`: Pequeño (24px)
- `md`: Mediano (48px) - default
- `lg`: Grande (64px)
- `xl`: Extra grande (96px)

#### Uso en diferentes contextos:

**En una tabla:**
```tsx
{loading ? (
  <div className="flex justify-center py-12">
    <LoadingSpinner size="md" message="Cargando datos..." />
  </div>
) : (
  <table>...</table>
)}
```

**En un modal:**
```tsx
<Modal>
  {submitting ? (
    <div className="flex justify-center p-8">
      <LoadingSpinner variant="dots" size="lg" message="Guardando..." />
    </div>
  ) : (
    <form>...</form>
  )}
</Modal>
```

**En un botón:**
```tsx
<button disabled={loading}>
  {loading ? (
    <LoadingSpinner variant="dots" size="sm" />
  ) : (
    "Guardar"
  )}
</button>
```

---

## 🎯 Ejemplos de Implementación

### Ejemplo 1: Página con carga inicial

```tsx
import { useState, useEffect } from 'react';
import LoadingProgress from './components/LoadingProgress';

export default function ProductsPage() {
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);

  useEffect(() => {
    async function loadProducts() {
      const data = await productService.getAll();
      setProducts(data);
      setLoading(false);
    }
    loadProducts();
  }, []);

  if (loading) {
    return <LoadingProgress message="Cargando productos..." duration={2000} />;
  }

  return (
    <div>
      {products.map(p => <ProductCard key={p.id} product={p} />)}
    </div>
  );
}
```

### Ejemplo 2: Sección con loading parcial

```tsx
import LoadingSpinner from './components/LoadingSpinner';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats().then(data => {
      setStats(data);
      setLoading(false);
    });
  }, []);

  return (
    <div className="dashboard">
      <h1>Dashboard</h1>
      
      {loading ? (
        <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-12">
          <LoadingSpinner 
            size="lg" 
            variant="pulse" 
            message="Cargando estadísticas..." 
          />
        </div>
      ) : (
        <StatsCards data={stats} />
      )}
    </div>
  );
}
```

### Ejemplo 3: Formulario con submit loading

```tsx
import { useState } from 'react';
import LoadingSpinner from './components/LoadingSpinner';

export default function LoginForm() {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await authService.login(credentials);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input type="email" />
      <input type="password" />
      
      <button 
        type="submit" 
        disabled={loading}
        className="flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <LoadingSpinner variant="dots" size="sm" />
            <span>Iniciando sesión...</span>
          </>
        ) : (
          "Iniciar Sesión"
        )}
      </button>
    </form>
  );
}
```

---

## 🎨 Personalización

### Modificar colores del gradiente

En `LoadingProgress.tsx`:
```tsx
// Cambiar de purple-pink a blue-cyan
className="bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600"
```

### Ajustar velocidad de animaciones

En `tailwind.config.ts`:
```ts
animation: {
  "shimmer": "shimmer 1.5s infinite", // Más rápido (era 2s)
  "gradient": "gradient 2s ease infinite", // Más lento (era 3s)
}
```

### Cambiar duración del progreso

```tsx
// Progreso más rápido
<LoadingProgress duration={1000} />

// Progreso más lento
<LoadingProgress duration={5000} />
```

---

## 💡 Tips y Mejores Prácticas

### 1. **Usar LoadingProgress para:**
- ✅ Carga inicial de la aplicación
- ✅ Transiciones entre páginas principales
- ✅ Procesos largos (> 3 segundos)
- ✅ Pantallas de splash

### 2. **Usar LoadingSpinner para:**
- ✅ Cargas parciales de componentes
- ✅ Estados de submit en formularios
- ✅ Actualizaciones de datos en tablas
- ✅ Modales y popovers

### 3. **Tamaños recomendados:**
- `sm`: Botones, badges
- `md`: Tarjetas, secciones
- `lg`: Páginas completas, modales grandes
- `xl`: Pantallas de splash

### 4. **Variantes según contexto:**
- **spinner**: General, profesional
- **dots**: Casual, minimalista
- **pulse**: Elegante, sutil

---

## 🚀 Animaciones Disponibles

Gracias a las actualizaciones en `tailwind.config.ts`:

- `animate-shimmer`: Efecto de brillo deslizante
- `animate-gradient`: Gradiente animado
- `animate-bounce`: Rebote suave
- `animate-pulse`: Pulso suave
- `animate-spin`: Rotación continua
- `animate-ping`: Onda expansiva

---

## 📊 Rendimiento

- ✅ Componentes ligeros (< 2KB cada uno)
- ✅ Sin dependencias externas
- ✅ Animaciones con CSS (GPU accelerated)
- ✅ Tree-shaking friendly
- ✅ TypeScript incluido

---

## 🎯 Próximas Mejoras

Ideas para futuras versiones:

- [ ] LoadingProgress con porcentaje real desde API
- [ ] Skeleton loaders personalizados
- [ ] Lazy loading de imágenes con placeholder
- [ ] Loading con progreso por pasos
- [ ] Animaciones de transición entre estados

---

## 📝 Notas

- Los componentes usan Tailwind CSS
- Requiere configuración de animaciones en `tailwind.config.ts`
- Compatible con React 18+
- TypeScript friendly
