import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { CloudinaryStorage } from "multer-storage-cloudinary";

const cloudinaryEnabled = process.env.ENABLE_CLOUDINARY === "true";

export const isCloudinaryConfigured = Boolean(
  cloudinaryEnabled &&
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET,
);

if (isCloudinaryConfigured) {
  // Configurar Cloudinary
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
} else if (cloudinaryEnabled) {
  console.warn(
    "âš ï¸  Cloudinary habilitado pero faltan CLOUDINARY_*; se deshabilita la subida de imÃ¡genes.",
  );
} else {
  console.warn("[Essence Debug]", 
    "â„¹ï¸  Cloudinary deshabilitado en este entorno (ENABLE_CLOUDINARY != true)",
  );
}

// Configurar storage de Multer con Cloudinary cuando estÃ¡ disponible.
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
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Solo se permiten archivos de imagen"), false);
    }
  },
});

// FunciÃ³n para eliminar imagen de Cloudinary
export const deleteImage = async (publicId) => {
  try {
    if (!isCloudinaryConfigured) {
      console.warn(
        "âš ï¸  deleteImage llamado sin Cloudinary configurado; se omite la eliminaciÃ³n.",
        publicId,
      );
      return;
    }
    await cloudinary.uploader.destroy(publicId);
    console.warn("[Essence Debug]", `âœ… Imagen eliminada de Cloudinary: ${publicId}`);
  } catch (error) {
    console.error("âŒ Error eliminando imagen de Cloudinary:", error);
  }
};

// Alias para compatibilidad
export const deleteFromCloudinary = deleteImage;

// FunciÃ³n para subir imagen desde base64
export const uploadToCloudinary = async (
  base64String,
  folder = "essence-products",
) => {
  if (!isCloudinaryConfigured) {
    throw new Error("Cloudinary no estÃ¡ configurado");
  }

  try {
    const result = await cloudinary.uploader.upload(base64String, {
      folder,
      transformation: [{ width: 800, height: 800, crop: "limit" }],
    });
    return result;
  } catch (error) {
    console.error("âŒ Error subiendo imagen a Cloudinary:", error);
    throw error;
  }
};

export default cloudinary;

