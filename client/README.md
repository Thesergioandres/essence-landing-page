# React + Tailwind CSS - Proyecto Base Optimizado

Un proyecto base moderno y optimizado con React 19, Tailwind CSS 4 y Vite, configurado con las mejores prácticas para desarrollo escalable.

## 🚀 Características

- ⚡ **Vite** - Build tool ultrarrápido con HMR
- ⚛️ **React 19** - La última versión de React con nuevas características
- 🎨 **Tailwind CSS 4** - Framework CSS utility-first de última generación
- 📦 **TypeScript** - Tipado estático para mayor robustez
- 🧹 **ESLint + Prettier** - Linting y formateo de código
- 🔧 **Configuración VS Code** - Settings y extensiones recomendadas
- 📱 **Responsive Design** - Diseño adaptativo desde el inicio
- 🎯 **Componentes Base** - Button, Card y más componentes reutilizables
- 🪝 **Custom Hooks** - Hooks útiles para funcionalidades comunes
- 🛠️ **Utilidades** - Funciones helper optimizadas

## 📁 Estructura del Proyecto

```
src/
├── components/          # Componentes reutilizables
│   ├── Button.tsx      # Componente botón con variantes
│   ├── Card.tsx        # Componente card flexible
│   └── index.ts        # Barrel exports
├── hooks/              # Custom hooks
│   └── index.ts        # useWindowSize, useLocalStorage, etc.
├── utils/              # Funciones utilitarias
│   └── index.ts        # formatCurrency, debounce, etc.
├── assets/             # Imágenes, iconos, etc.
├── App.tsx             # Componente principal
├── main.tsx            # Punto de entrada
└── index.css           # Estilos globales y Tailwind
```

## 🛠️ Scripts Disponibles

```bash
# Desarrollo
npm run dev              # Inicia servidor de desarrollo

# Build
npm run build           # Construye para producción
npm run build:analyze   # Analiza el bundle de producción

# Calidad de código
npm run lint            # Ejecuta ESLint
npm run lint:fix        # Corrige automáticamente errores de ESLint
npm run type-check      # Verifica tipos TypeScript

# Otros
npm run preview         # Preview del build de producción
npm run clean           # Limpia archivos de build
```

## 🎨 Componentes Incluidos

### Button

```tsx
import { Button } from "./components";

<Button variant="primary" size="md" loading={false}>
  Click me
</Button>;
```

### Card

```tsx
import { Card, CardHeader, CardContent, CardFooter } from "./components";

<Card hover>
  <CardHeader>
    <h3>Título</h3>
  </CardHeader>
  <CardContent>
    <p>Contenido</p>
  </CardContent>
  <CardFooter>
    <Button>Acción</Button>
  </CardFooter>
</Card>;
```

## 🪝 Hooks Personalizados

- `useWindowSize()` - Detecta el tamaño de ventana
- `useIsMobile()` - Detecta dispositivos móviles
- `useLocalStorage()` - Estado sincronizado con localStorage
- `useLoading()` - Maneja estados de carga
- `useClickOutside()` - Detecta clicks fuera de elementos

## 🔧 Funciones Utilitarias

- `cn()` - Combina clases CSS
- `formatCurrency()` - Formatea números como moneda
- `formatDate()` - Formatea fechas
- `debounce()` - Optimiza llamadas a funciones
- `generateId()` - Genera IDs únicos
- `truncate()` - Trunca texto con elipsis

## ⚙️ Configuración

### Tailwind CSS

El proyecto incluye:

- Animaciones personalizadas (fade-in, slide-up, bounce-gentle)
- Colores extendidos para la marca
- Configuración optimizada para purging
- Soporte para modo oscuro (fácil de activar)

### ESLint

- Configuración estricta para React y TypeScript
- Reglas para hooks de React
- Soporte para React Fast Refresh

### Prettier

- Formateo automático al guardar
- Ordenamiento automático de clases Tailwind
- Configuración consistente

## 📱 Responsive Design

El proyecto está configurado con breakpoints móviles desde el inicio:

- `sm:` 640px
- `md:` 768px
- `lg:` 1024px
- `xl:` 1280px
- `2xl:` 1536px

## 🚀 Optimizaciones Incluidas

- **Bundle Splitting** - Separación automática de vendors
- **Tree Shaking** - Eliminación de código no utilizado
- **CSS Purging** - Solo las clases CSS utilizadas
- **Lazy Loading** - Preparado para carga diferida
- **Memoización** - Componentes optimizados con memo
- **Accesibilidad** - Estilos para `prefers-reduced-motion`

## 💻 Extensiones VS Code Recomendadas

- Tailwind CSS IntelliSense
- Prettier - Code formatter
- ESLint
- Auto Rename Tag
- Path Intellisense
- TypeScript Hero
- Error Lens

## 🚀 Empezar

1. Instala las dependencias:

```bash
npm install
```

2. Inicia el servidor de desarrollo:

```bash
npm run dev
```

3. Abre [http://localhost:3000](http://localhost:3000) en tu navegador

## 📄 Licencia

MIT - Siéntete libre de usar este proyecto como base para tus desarrollos.

---

¡Feliz coding! 🎉
