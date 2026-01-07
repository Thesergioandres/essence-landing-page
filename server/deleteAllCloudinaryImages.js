import { v2 as cloudinary } from "cloudinary";
import dotenv from "dotenv";

dotenv.config();

// Configurar Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Eliminar todas las imágenes de Cloudinary
 * ADVERTENCIA: Esta acción es IRREVERSIBLE
 */
async function deleteAllCloudinaryImages() {
  try {
    console.log("\n🗑️  ELIMINANDO TODAS LAS IMÁGENES DE CLOUDINARY");
    console.log("⚠️  ADVERTENCIA: Esta acción es IRREVERSIBLE\n");

    // Verificar credenciales
    if (
      !process.env.CLOUDINARY_CLOUD_NAME ||
      !process.env.CLOUDINARY_API_KEY ||
      !process.env.CLOUDINARY_API_SECRET
    ) {
      throw new Error("Faltan credenciales de Cloudinary en .env");
    }

    console.log(`☁️  Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME}\n`);

    // Obtener todas las carpetas (folders)
    const folders = [];
    try {
      const foldersResult = await cloudinary.api.root_folders();
      folders.push(...foldersResult.folders.map((f) => f.path));
      console.log(
        `📁 Carpetas encontradas: ${folders.join(", ") || "ninguna"}`
      );
    } catch (error) {
      console.log("📁 No se encontraron carpetas o error:", error.message);
    }

    let totalDeleted = 0;

    // Eliminar recursos de cada carpeta
    for (const folder of folders) {
      console.log(`\n📂 Procesando carpeta: ${folder}`);

      let hasMore = true;
      let nextCursor = null;

      while (hasMore) {
        try {
          const result = await cloudinary.api.resources({
            type: "upload",
            prefix: folder,
            max_results: 500,
            next_cursor: nextCursor,
          });

          if (result.resources && result.resources.length > 0) {
            const publicIds = result.resources.map((r) => r.public_id);

            console.log(`   🔍 Encontrados ${publicIds.length} recursos`);

            // Eliminar en lotes de 100 (límite de Cloudinary)
            for (let i = 0; i < publicIds.length; i += 100) {
              const batch = publicIds.slice(i, i + 100);
              const deleteResult = await cloudinary.api.delete_resources(batch);

              const deleted = Object.keys(deleteResult.deleted).filter(
                (key) => deleteResult.deleted[key] === "deleted"
              ).length;

              totalDeleted += deleted;
              console.log(`   ✅ Eliminados ${deleted} recursos`);
            }
          }

          hasMore = result.next_cursor !== undefined;
          nextCursor = result.next_cursor;
        } catch (error) {
          console.log(`   ❌ Error: ${error.message}`);
          hasMore = false;
        }
      }
    }

    // Eliminar recursos en la raíz (sin carpeta)
    console.log(`\n📂 Procesando recursos en la raíz (sin carpeta)`);

    let hasMore = true;
    let nextCursor = null;

    while (hasMore) {
      try {
        const result = await cloudinary.api.resources({
          type: "upload",
          max_results: 500,
          next_cursor: nextCursor,
        });

        if (result.resources && result.resources.length > 0) {
          // Filtrar solo recursos sin carpeta (sin '/' en public_id)
          const rootResources = result.resources.filter(
            (r) => !r.public_id.includes("/")
          );

          if (rootResources.length > 0) {
            const publicIds = rootResources.map((r) => r.public_id);
            console.log(
              `   🔍 Encontrados ${publicIds.length} recursos en raíz`
            );

            // Eliminar en lotes de 100
            for (let i = 0; i < publicIds.length; i += 100) {
              const batch = publicIds.slice(i, i + 100);
              const deleteResult = await cloudinary.api.delete_resources(batch);

              const deleted = Object.keys(deleteResult.deleted).filter(
                (key) => deleteResult.deleted[key] === "deleted"
              ).length;

              totalDeleted += deleted;
              console.log(`   ✅ Eliminados ${deleted} recursos`);
            }
          }
        }

        hasMore = result.next_cursor !== undefined;
        nextCursor = result.next_cursor;
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
        hasMore = false;
      }
    }

    // Eliminar carpetas vacías
    console.log(`\n🗑️  Eliminando carpetas vacías...`);
    for (const folder of folders) {
      try {
        await cloudinary.api.delete_folder(folder);
        console.log(`   ✅ Carpeta eliminada: ${folder}`);
      } catch (error) {
        console.log(`   ⚠️  No se pudo eliminar ${folder}: ${error.message}`);
      }
    }

    console.log(`\n✅ PROCESO COMPLETADO`);
    console.log(`📊 Total de imágenes eliminadas: ${totalDeleted}\n`);

    // Verificar si quedan recursos
    try {
      const remaining = await cloudinary.api.resources({
        type: "upload",
        max_results: 1,
      });

      if (remaining.resources && remaining.resources.length > 0) {
        console.log(
          `⚠️  Aún quedan ${remaining.total_count || "algunos"} recursos`
        );
        console.log(`   Ejecuta el script nuevamente si es necesario\n`);
      } else {
        console.log(`✨ Cloudinary está completamente limpio\n`);
      }
    } catch (error) {
      console.log(`✨ Cloudinary está vacío\n`);
    }
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// Ejecutar con confirmación
console.log("\n⚠️  ¡ADVERTENCIA!");
console.log("⚠️  Vas a eliminar TODAS las imágenes de Cloudinary");
console.log("⚠️  Esta acción NO se puede deshacer\n");

// Esperar 3 segundos antes de continuar
setTimeout(() => {
  deleteAllCloudinaryImages()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}, 3000);

console.log("⏳ Iniciando en 3 segundos... (Ctrl+C para cancelar)\n");
