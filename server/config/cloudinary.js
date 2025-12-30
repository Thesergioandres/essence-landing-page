import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

export const isCloudinaryConfigured = Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
);

if (isCloudinaryConfigured) {
  // Configurar Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} else {
  console.warn(
    "⚠️  Cloudinary no configurado (faltan CLOUDINARY_*). Se deshabilita la subida de imágenes a Cloudinary."
  );
}

// Configurar storage de Multer con Cloudinary cuando está disponible.
// Si no, usamos memoryStorage para que el POST no falle por el middleware.
const storage = isCloudinaryConfigured
  ? new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: "essence-products",
        allowed_formats: ["jpg", "jpeg", "png", "webp", "gif"],
        transformation: [{ width: 800, height: 800, crop: "limit" }],
      },
    })
  : multer.memoryStorage();

// Crear middleware de upload
export const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos de imagen"), false);
    }
  },
});

// Función para eliminar imagen de Cloudinary
export const deleteImage = async (publicId) => {
  try {
    if (!isCloudinaryConfigured) {
      console.warn(
        "⚠️  deleteImage llamado sin Cloudinary configurado; se omite la eliminación.",
        publicId
      );
      return;
    }
    await cloudinary.uploader.destroy(publicId);
    console.log(`✅ Imagen eliminada de Cloudinary: ${publicId}`);
  } catch (error) {
    console.error("❌ Error eliminando imagen de Cloudinary:", error);
  }
};

export default cloudinary;
