/**
 * 🔄 Script de Sincronización: Producción → Local (Solo Nuevos)
 *
 * Este script:
 * - Conecta a producción en modo SOLO LECTURA
 * - Conecta a la BD local en modo lectura/escritura
 * - Compara documentos por _id
 * - Inserta SOLO los documentos que NO existen en local
 * - NUNCA sobrescribe, actualiza o elimina datos locales
 * - NUNCA escribe en producción
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

// URIs de conexión
const PROD_URI = process.env.MONGO_URI_PROD_READ;
const LOCAL_URI = process.env.MONGO_URI_DEV_LOCAL || process.env.MONGODB_URI;

// Colecciones a sincronizar (en orden de dependencia)
const COLLECTIONS_TO_SYNC = [
  "users",
  "businesses",
  "memberships",
  "categories",
  "products",
  "branches",
  "branchstocks",
  "employeesstats",
  "employeestocks",
  "customers",
  "sales",
  "credits",
  "creditpayments",
  "expenses",
  "inventoryentries",
  "notifications",
  "promotions",
  "providers",
  "segments",
  "specialsales",
  "stocks",
  "stocktransfers",
  "branchtransfers",
  "defectiveproducts",
  "gamificationconfigs",
  "profithistories",
  "auditlogs",
  "periodwinners",
  "paymentmethods",
  "deliverymethods",
  "pushsubscriptions",
];

// Estadísticas de sincronización
const stats = {
  collections: {},
  totalNew: 0,
  totalSkipped: 0,
  totalErrors: 0,
  startTime: null,
  endTime: null,
};

/**
 * Conectar a ambas bases de datos
 */
async function connectDatabases() {
  console.log("\n🔌 Conectando a bases de datos...\n");

  if (!PROD_URI) {
    console.log("⚠️  MONGO_URI_PROD_READ no configurada.");
    console.log("   Sincronización deshabilitada. Usando solo BD local.\n");
    return { skipSync: true };
  }

  if (!LOCAL_URI) {
    throw new Error("❌ MONGO_URI_DEV_LOCAL no está configurada.");
  }

  // Verificar que no son la misma URI
  if (PROD_URI === LOCAL_URI) {
    throw new Error(
      "❌ PELIGRO: Las URIs de producción y local son iguales.\n" +
        "   Configura bases de datos separadas.",
    );
  }

  // Conexión a producción (SOLO LECTURA)
  const prodConnection = mongoose.createConnection(PROD_URI, {
    serverSelectionTimeoutMS: 15000,
    socketTimeoutMS: 45000,
    maxPoolSize: 5,
    readPreference: "secondaryPreferred",
  });

  await prodConnection.asPromise();
  console.log("✅ [PROD] Conectado (SOLO LECTURA)");
  console.log(`   Host: ${prodConnection.host}`);
  console.log(`   DB: ${prodConnection.name}\n`);

  // Conexión a local (LECTURA + ESCRITURA)
  const localConnection = mongoose.createConnection(LOCAL_URI, {
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    maxPoolSize: 10,
  });

  await localConnection.asPromise();
  console.log("✅ [LOCAL] Conectado (LECTURA + ESCRITURA)");
  console.log(`   Host: ${localConnection.host}`);
  console.log(`   DB: ${localConnection.name}\n`);

  return { prodConnection, localConnection, skipSync: false };
}

/**
 * Sincronizar una colección: insertar solo documentos nuevos
 */
async function syncCollection(prodConnection, localConnection, collectionName) {
  const collStats = {
    totalProd: 0,
    totalLocal: 0,
    newInserted: 0,
    skipped: 0,
    errors: 0,
  };

  try {
    // Obtener colecciones
    const prodCollection = prodConnection.collection(collectionName);
    const localCollection = localConnection.collection(collectionName);

    // Verificar si la colección existe en producción
    const prodCollections = await prodConnection.db
      .listCollections({ name: collectionName })
      .toArray();

    if (prodCollections.length === 0) {
      console.log(`   ⏭️  ${collectionName}: No existe en producción`);
      stats.collections[collectionName] = collStats;
      return collStats;
    }

    // Contar documentos
    collStats.totalProd = await prodCollection.countDocuments();
    collStats.totalLocal = await localCollection.countDocuments();

    if (collStats.totalProd === 0) {
      console.log(`   ⏭️  ${collectionName}: Vacía en producción`);
      stats.collections[collectionName] = collStats;
      return collStats;
    }

    // Obtener todos los _ids locales para comparación rápida
    const localIds = new Set();
    const localCursor = localCollection.find({}, { projection: { _id: 1 } });
    for await (const doc of localCursor) {
      localIds.add(doc._id.toString());
    }

    // Iterar documentos de producción e insertar solo los nuevos
    const prodCursor = prodCollection.find({});
    const batchSize = 100;
    let batch = [];

    for await (const prodDoc of prodCursor) {
      const prodId = prodDoc._id.toString();

      if (localIds.has(prodId)) {
        // Documento ya existe en local - NO sobrescribir
        collStats.skipped++;
      } else {
        // Documento nuevo - agregar al batch para insertar
        batch.push(prodDoc);

        if (batch.length >= batchSize) {
          try {
            await localCollection.insertMany(batch, { ordered: false });
            collStats.newInserted += batch.length;
          } catch (err) {
            // Ignorar errores de duplicados (por si acaso)
            if (err.code !== 11000) {
              collStats.errors++;
              console.error(
                `   ❌ Error insertando batch en ${collectionName}:`,
                err.message,
              );
            }
          }
          batch = [];
        }
      }
    }

    // Insertar batch restante
    if (batch.length > 0) {
      try {
        await localCollection.insertMany(batch, { ordered: false });
        collStats.newInserted += batch.length;
      } catch (err) {
        if (err.code !== 11000) {
          collStats.errors++;
          console.error(
            `   ❌ Error insertando batch final en ${collectionName}:`,
            err.message,
          );
        }
      }
    }

    // Log resultado
    const icon = collStats.newInserted > 0 ? "📥" : "✅";
    console.log(
      `   ${icon} ${collectionName}: ` +
        `${collStats.newInserted} nuevos, ` +
        `${collStats.skipped} omitidos, ` +
        `${collStats.totalProd} en prod, ` +
        `${collStats.totalLocal + collStats.newInserted} en local`,
    );

    stats.collections[collectionName] = collStats;
    stats.totalNew += collStats.newInserted;
    stats.totalSkipped += collStats.skipped;
    stats.totalErrors += collStats.errors;

    return collStats;
  } catch (error) {
    console.error(
      `   ❌ Error sincronizando ${collectionName}:`,
      error.message,
    );
    collStats.errors++;
    stats.collections[collectionName] = collStats;
    stats.totalErrors++;
    return collStats;
  }
}

/**
 * Ejecutar sincronización completa
 */
async function runSync() {
  console.log("\n" + "=".repeat(60));
  console.log("🔄 SINCRONIZACIÓN: PRODUCCIÓN → LOCAL (Solo Nuevos)");
  console.log("=".repeat(60));

  stats.startTime = new Date();

  try {
    const { prodConnection, localConnection, skipSync } =
      await connectDatabases();

    if (skipSync) {
      console.log(
        "✅ Sincronización omitida. Iniciando servidor con BD local.\n",
      );
      return;
    }

    console.log("📊 Sincronizando colecciones...\n");

    for (const collectionName of COLLECTIONS_TO_SYNC) {
      await syncCollection(prodConnection, localConnection, collectionName);
    }

    stats.endTime = new Date();
    const duration = (stats.endTime - stats.startTime) / 1000;

    // Resumen final
    console.log("\n" + "-".repeat(60));
    console.log("📋 RESUMEN DE SINCRONIZACIÓN");
    console.log("-".repeat(60));
    console.log(`   ✅ Documentos nuevos insertados: ${stats.totalNew}`);
    console.log(
      `   ⏭️  Documentos omitidos (ya existían): ${stats.totalSkipped}`,
    );
    console.log(`   ❌ Errores: ${stats.totalErrors}`);
    console.log(`   ⏱️  Tiempo total: ${duration.toFixed(2)}s`);
    console.log("-".repeat(60) + "\n");

    // Cerrar conexión de producción (ya no la necesitamos)
    await prodConnection.close();
    console.log("🔌 Conexión a producción cerrada.\n");

    // Cerrar conexión local (el servidor la reabrirá)
    await localConnection.close();
    console.log("🔌 Conexión local cerrada. El servidor la reabrirá.\n");
  } catch (error) {
    console.error("\n❌ Error durante sincronización:", error.message);
    console.error("   Continuando con BD local existente...\n");
  }
}

// Ejecutar si es llamado directamente
if (process.argv[1] && process.argv[1].includes("syncProdToLocal.js")) {
  runSync()
    .then(() => {
      console.log("✅ Sincronización completada.\n");
      process.exit(0);
    })
    .catch((err) => {
      console.error("❌ Error fatal:", err.message);
      process.exit(1);
    });
}

export { runSync, stats };
export default runSync;
