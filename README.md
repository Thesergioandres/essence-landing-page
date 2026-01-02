# Essence – Documentación del proyecto

## Descripción

Aplicación full‑stack para gestión de catálogo, ventas y distribución. Frontend en React + Vite + Tailwind CSS, backend en Node.js/Express con MongoDB. Incluye PWA y vistas públicas de catálogo compartible.

## Estructura del repositorio

- `client/`: frontend React/Vite (TS, Tailwind, PWA).
- `server/`: API Express (Node 18+, MongoDB).
- `deploy/`: assets de despliegue (nginx.conf, scripts cloud, systemd example).
- `docker-compose.yml`: stack local con MongoDB, mongo-express, backend y nginx sirviendo `client/dist`.

## Requisitos

- Node.js >= 18 y npm >= 9
- MongoDB (local o remoto) si no usas Docker
- Opcional: Docker + Docker Compose para stack completo

## Instalación

Desde la raíz:

1. `npm run install-all` (instala raíz, client y server)
2. Copia y ajusta variables de entorno (ver más abajo)

## Scripts principales

Raíz (`package.json`):

- `npm run dev`: levanta backend y frontend en paralelo.
- `npm run server`: solo backend (dev).
- `npm run client`: solo frontend (dev).
- `npm run build`: build de frontend (`client/dist`).

Frontend (`client/package.json`):

- `npm run dev`: Vite dev server.
- `npm run build`: type-check + build producción.
- `npm run preview`: sirve el build localmente.
- `npm run lint` / `lint:fix`: ESLint.

Backend (`server/package.json`):

- `npm run dev`: nodemon server.js.
- `npm start`: server en modo producción.
- `npm test` / `test:watch` / `test:coverage`: Jest.

## Variables de entorno

### Frontend (`client/.env`)

- `VITE_API_URL` (requerido): base de la API, p.ej. `http://localhost:5000/api`.
- `VITE_PUBLIC_BUSINESS_ID` (opcional): businessId por defecto para el catálogo público; si no se pasa en la URL, se usa este.

### Backend (`server/.env`)

- `PORT` (por defecto 5000)
- `MONGODB_URI`
- `JWT_SECRET`
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (si usas subida de imágenes)
- `FRONTEND_URL` (para CORS)

## Desarrollo

1. `npm run dev` en la raíz (requiere `MONGODB_URI` configurada si no usas Docker).
2. Frontend dev server: http://localhost:5173
3. Backend dev server: http://localhost:5000 (API en `/api`)

## Usar Docker Compose

1. `npm run build` en `client/` para generar `client/dist`.
2. `docker-compose up -d`
   - Nginx sirve el frontend en `http://localhost` (puerto 80).
   - Backend en `http://localhost:5000`.
   - MongoDB en `mongodb://localhost:27017` y mongo-express en `http://localhost:8081`.
3. Ajusta secretos en `docker-compose.yml` o via `.env` antes de producción.

## Catálogo público y compartible

- Ruta pública: `/catalog` (ya no requiere autenticación).
- La página genera un enlace para compartir (sección “Compartir catálogo”). El link incluye `businessId` de la URL o el `VITE_PUBLIC_BUSINESS_ID` definido en `.env`.
- Para compartir en tu servidor: `http://<tu-dominio-o-ip>/catalog?businessId=<ID>`.
- El header/footer se ocultan automáticamente en producción; puedes añadir `&bare=1` en desarrollo para simularlo.

## Build y despliegue

- Frontend: `npm run build` en `client/`; despliega el contenido de `client/dist` detrás de nginx (ver `deploy/nginx.conf`).
- Backend: `npm start` en `server/` con variables de entorno definidas.
- PWA: el build genera `sw.js` y precache (vite-plugin-pwa).

## Lint y calidad

- Frontend: `npm run lint`, `npm run type-check`.
- Backend: `npm test` (Jest + supertest, con soporte a Mongo en memoria).

## Features destacadas

- Catálogo con filtros, vista grid/lista, filtros de stock/destacados y rango de precio.
- Compartir catálogo público con enlace copiables desde la UI.
- Dashboard de administración con ventas, analytics, gamificación, asistente, etc.
- Integración con Cloudinary para imágenes.
- PWA habilitada en el frontend.

## Notas de seguridad

- Reemplaza todas las credenciales de ejemplo (Mongo, JWT, Cloudinary) antes de publicar.
- No comitas `.env` ni secretos.

## Estructura rápida

```
client/   # Frontend React/Vite/Tailwind
server/   # API Express/Mongo
deploy/   # Nginx config + scripts de despliegue
```
