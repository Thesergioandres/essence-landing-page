import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import InventoryEntry from "./models/InventoryEntry.js";
import Sale from "./src/infrastructure/database/models/Sale.js";

// Script de migración para agrupar ventas y recepciones antiguas

const MONGO_URI =
  process.env.MONGODB_URI ||
  "mongodb+srv://sergio:sergio@cluster0.ztdix.mongodb.net/essence?retryWrites=true&w=majority&appName=Cluster0";

async function migrateSales() {
  try {
    console.log("🔄 Conectando a MongoDB...");
    await mongoose.connect(MONGO_URI);
    console.log("✅ Conectado a MongoDB\n");

    // ============ MIGRACIÓN DE VENTAS ============
    console.log("📦 Migrando ventas sin saleGroupId...");

    // Obtener todas las ventas que NO tienen saleGroupId
    const salesWithoutGroup = await Sale.find({
      saleGroupId: { $exists: false },
    }).sort({ saleDate: 1, createdAt: 1 });

    console.log(
      `   Encontradas ${salesWithoutGroup.length} ventas sin agrupar`,
    );

    if (salesWithoutGroup.length === 0) {
      console.log("   ✅ Todas las ventas ya están agrupadas\n");
    } else {
      // Agrupar ventas por:
      // - Mismo negocio
      // - Mismo distribuidor (o ambos null para admin)
      // - Mismo cliente (o ambos null)
      // - Misma fecha (mismo día)
      // - Misma sede
      // - Mismo requestId (si existe)
      // - Creadas con diferencia menor a 2 minutos

      const groups = new Map();

      for (const sale of salesWithoutGroup) {
        // Generar clave de agrupación
        const saleDate = new Date(sale.saleDate).toISOString().split("T")[0];
        const createdTime = new Date(sale.createdAt).getTime();

        const groupKey = `${sale.business}_${sale.distributor || "admin"}_${
          sale.customer || "nocustomer"
        }_${saleDate}_${sale.branch || "nobranch"}`;

        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }

        const group = groups.get(groupKey);

        // Buscar si hay ventas recientes (< 2 minutos) en este grupo
        const recentSale = group.find((s) => {
          const timeDiff = Math.abs(
            createdTime - new Date(s.createdAt).getTime(),
          );
          return timeDiff < 120000; // 2 minutos
        });

        if (recentSale) {
          // Agregar a un subgrupo existente
          if (!recentSale.subgroup) {
            recentSale.subgroup = [recentSale];
          }
          recentSale.subgroup.push(sale);
        } else {
          // Crear nueva entrada
          group.push(sale);
        }
      }

      // Asignar saleGroupId a cada grupo
      let totalGroups = 0;
      let totalUpdated = 0;

      for (const [, groupSales] of groups) {
        for (const item of groupSales) {
          if (item.subgroup && item.subgroup.length > 1) {
            // Es un grupo de ventas simultáneas
            const groupId = uuidv4();
            totalGroups++;

            for (const sale of item.subgroup) {
              await Sale.updateOne(
                { _id: sale._id },
                { $set: { saleGroupId: groupId } },
              );
              totalUpdated++;
            }

            console.log(
              `   📦 Grupo creado: ${item.subgroup.length} ventas (${new Date(
                item.subgroup[0].saleDate,
              ).toLocaleDateString()})`,
            );
          } else {
            // Venta individual, no necesita grupo
            // (dejamos saleGroupId como null/undefined)
          }
        }
      }

      console.log(
        `   ✅ Migración completada: ${totalGroups} grupos creados, ${totalUpdated} ventas actualizadas\n`,
      );
    }

    // ============ MIGRACIÓN DE RECEPCIONES DE INVENTARIO ============
    console.log("📦 Migrando recepciones de inventario sin purchaseGroupId...");

    const entriesWithoutGroup = await InventoryEntry.find({
      purchaseGroupId: { $exists: false },
    }).sort({ createdAt: 1 });

    console.log(
      `   Encontradas ${entriesWithoutGroup.length} entradas sin agrupar`,
    );

    if (entriesWithoutGroup.length === 0) {
      console.log("   ✅ Todas las recepciones ya están agrupadas\n");
    } else {
      const entryGroups = new Map();

      for (const entry of entriesWithoutGroup) {
        const createdTime = new Date(entry.createdAt).getTime();

        // Agrupar por requestId si existe, o por criterios similares
        let groupKey;
        if (entry.requestId) {
          groupKey = `${entry.business}_${entry.requestId}`;
        } else {
          const createdDate = new Date(entry.createdAt)
            .toISOString()
            .split("T")[0];
          groupKey = `${entry.business}_${
            entry.provider || "noprovider"
          }_${createdDate}_${entry.branch || "nobranch"}`;
        }

        if (!entryGroups.has(groupKey)) {
          entryGroups.set(groupKey, []);
        }

        const group = entryGroups.get(groupKey);

        // Buscar entradas recientes (< 5 minutos)
        const recentEntry = group.find((e) => {
          const timeDiff = Math.abs(
            createdTime - new Date(e.createdAt).getTime(),
          );
          return timeDiff < 300000; // 5 minutos
        });

        if (recentEntry) {
          if (!recentEntry.subgroup) {
            recentEntry.subgroup = [recentEntry];
          }
          recentEntry.subgroup.push(entry);
        } else {
          group.push(entry);
        }
      }

      let totalEntryGroups = 0;
      let totalEntriesUpdated = 0;

      for (const [, groupEntries] of entryGroups) {
        for (const item of groupEntries) {
          if (item.subgroup && item.subgroup.length > 1) {
            const groupId = uuidv4();
            totalEntryGroups++;

            for (const entry of item.subgroup) {
              await InventoryEntry.updateOne(
                { _id: entry._id },
                { $set: { purchaseGroupId: groupId } },
              );
              totalEntriesUpdated++;
            }

            console.log(
              `   📦 Grupo creado: ${item.subgroup.length} entradas (${new Date(
                item.subgroup[0].createdAt,
              ).toLocaleDateString()})`,
            );
          }
        }
      }

      console.log(
        `   ✅ Migración completada: ${totalEntryGroups} grupos creados, ${totalEntriesUpdated} entradas actualizadas\n`,
      );
    }

    console.log("✨ Migración completa");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error en migración:", error);
    process.exit(1);
  }
}

migrateSales();
