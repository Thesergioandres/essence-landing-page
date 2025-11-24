# Essence Backend API

Backend Node.js + Express + MongoDB para la aplicación Essence.

## 🚀 Características

- Autenticación con JWT
- CRUD de productos
- Roles de usuario (user/admin)
- Almacenamiento de imágenes en Base64 (MongoDB)
- Validación de datos
- Manejo de errores

## 📦 Instalación

```bash
# Instalar dependencias
npm install

# Copiar variables de entorno
cp .env.example .env

# Editar .env con tus credenciales
```

## 🔧 Configuración

Edita el archivo `.env` con tus credenciales:

```env
MONGO_URI=tu_conexion_mongodb
PORT=5000
JWT_SECRET=tu_secreto_jwt
NODE_ENV=development
```

## 🏃‍♂️ Ejecución

```bash
# Desarrollo (con nodemon)
npm run dev

# Producción
npm start
```

## 📚 API Endpoints

### Autenticación

- `POST /api/auth/register` - Registrar usuario
- `POST /api/auth/login` - Login
- `POST /api/auth/create-admin` - Crear el administrador inicial (una sola vez)
- `GET /api/auth/profile` - Obtener perfil (protegido)

### Productos

- `GET /api/products` - Listar productos
- `GET /api/products/:id` - Obtener producto
- `POST /api/products` - Crear producto (admin)
- `PUT /api/products/:id` - Actualizar producto (admin)
- `DELETE /api/products/:id` - Eliminar producto (admin)

### Imágenes

- `POST /api/upload` - Subir imagen de producto en Base64 (admin)
- `DELETE /api/upload/:publicId` - Eliminar referencia de imagen (admin)

## 🔧 Utilidades

- `node scripts/listUsers.js` - Lista los usuarios existentes en la base de datos (requiere MongoDB activo).

## 🗄️ Modelos

### User

```javascript
{
  name: String,
  email: String (unique),
  password: String (hashed),
  role: 'user' | 'admin'
}
```

### Product

```javascript
{
  name: String,
  description: String,
  price: Number,
  category: String,
  image: { url, publicId },
  stock: Number,
  featured: Boolean,
  ingredients: [String],
  benefits: [String]
}
```
