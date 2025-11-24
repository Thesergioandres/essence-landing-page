import http from "http";
import https from "https";
import mongoose from "mongoose";
import Product from "./models/Product.js";

// Mapeo de productos con URLs de imágenes de placeholder estables
const productImages = {
  "Cargador Note 9 TC": "https://picsum.photos/seed/charger1/800/800",
  "Cargador Samsung 3.0A V8": "https://picsum.photos/seed/charger2/800/800",
  "Cargador Samsung 3.0A TC": "https://picsum.photos/seed/charger3/800/800",
  "Cargador Moto Turbo V8": "https://picsum.photos/seed/charger4/800/800",
  "Cargador Moto Turbo TC": "https://picsum.photos/seed/charger5/800/800",
  "Cargador Samsung S20-5G V8": "https://picsum.photos/seed/charger6/800/800",
  "Cargador Samsung S20-5G TC": "https://picsum.photos/seed/charger7/800/800",
  "Cargador Samsung S22 50W TC-TC":
    "https://picsum.photos/seed/charger8/800/800",
  "Cargador Xiaomi 67W V8": "https://picsum.photos/seed/charger9/800/800",
  "Cargador Xiaomi 67W TC": "https://picsum.photos/seed/charger10/800/800",
  "Cargador Xiaomi 67W TC-TC": "https://picsum.photos/seed/charger11/800/800",
  "Cargador Samsung 67W V8": "https://picsum.photos/seed/charger12/800/800",
  "Cargador Samsung 67W TC": "https://picsum.photos/seed/charger13/800/800",
  "Cargador Samsung 67W TC-TC": "https://picsum.photos/seed/charger14/800/800",
  "Cargador iPhone 5W": "https://picsum.photos/seed/charger15/800/800",
  "Cargador iPhone 25W": "https://picsum.photos/seed/charger16/800/800",
  "Manos Libres Lenteja HS330": "https://picsum.photos/seed/earbuds1/800/800",
  "Manos Libres S8 AKG": "https://picsum.photos/seed/earbuds2/800/800",
  "Diadema AirPods Max": "https://picsum.photos/seed/headphones1/800/800",
  "Reloj Inteligente HK9 Mini": "https://picsum.photos/seed/watch1/800/800",
  "Reloj Inteligente HK10 Mini": "https://picsum.photos/seed/watch2/800/800",
  "Reloj Inteligente JS WATCH10 Pro+":
    "https://picsum.photos/seed/watch3/800/800",
  "Reloj Inteligente JS WATCH 10 Mini":
    "https://picsum.photos/seed/watch4/800/800",
  "Reloj Inteligente HK10 Ultra3": "https://picsum.photos/seed/watch5/800/800",
  "Reloj Inteligente HK11 ULTRA3": "https://picsum.photos/seed/watch6/800/800",
  "Reloj Inteligente HK11 PRO MAX": "https://picsum.photos/seed/watch7/800/800",
  "Reloj Inteligente Hello Plum": "https://picsum.photos/seed/watch8/800/800",
  "Parlante JBL XTREM4 Mini": "https://picsum.photos/seed/speaker1/800/800",
  "Parlante JBL FLIP7": "https://picsum.photos/seed/speaker2/800/800",
  "Cable PELKING CB-P01 V8": "https://picsum.photos/seed/cable1/800/800",
  "Cable PELKING PCB-100 V8": "https://picsum.photos/seed/cable2/800/800",
  "Cable PELKING PCB-100 TC": "https://picsum.photos/seed/cable3/800/800",
  "Pulso Nike 38mm-40mm": "https://picsum.photos/seed/band1/800/800",
  "Pulso Nike 42mm-45mm": "https://picsum.photos/seed/band2/800/800",
  "Pulso Liso para Smartwatch": "https://picsum.photos/seed/band3/800/800",
  "Pulso Oceans para Smartwatch": "https://picsum.photos/seed/band4/800/800",
  "Pulso Velcro para Smartwatch": "https://picsum.photos/seed/band5/800/800",
  "Pulso Metálico para Smartwatch": "https://picsum.photos/seed/band6/800/800",
  "Protector Cargador 20W iPhone": "https://picsum.photos/seed/case1/800/800",
  "Vidrio Templado 21D": "https://picsum.photos/seed/glass1/800/800",
  "Vidrio Cerámica Matte": "https://picsum.photos/seed/glass2/800/800",
  "Vidrio Premium": "https://picsum.photos/seed/glass3/800/800",
  "Vidrio Premium Antiespia": "https://picsum.photos/seed/glass4/800/800",
  "AirPods Max Réplica": "https://picsum.photos/seed/headphones2/800/800",
  "AirPods 1/2 Réplica": "https://picsum.photos/seed/airpods1/800/800",
  "AirPods Serie 3 Réplica": "https://picsum.photos/seed/airpods2/800/800",
  "AirPods Pro 2 ANC Réplica": "https://picsum.photos/seed/airpods3/800/800",
  "AirPods 4 ANC Réplica": "https://picsum.photos/seed/airpods4/800/800",
  "Buds Pro 2 Réplica": "https://picsum.photos/seed/buds1/800/800",
  "Cargador 25W iPhone": "https://picsum.photos/seed/charger17/800/800",
  "Cable iPhone TC-TC": "https://picsum.photos/seed/cable4/800/800",
  "Cable TC-iPhone": "https://picsum.photos/seed/cable5/800/800",
  "Cabeza Cargador 20W iPhone": "https://picsum.photos/seed/charger18/800/800",
  "Manos Libres Original iPhone": "https://picsum.photos/seed/earbuds3/800/800",
};

function downloadImage(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    protocol
      .get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Seguir redirección
          return downloadImage(response.headers.location)
            .then(resolve)
            .catch(reject);
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }

        const chunks = [];
        response.on("data", (chunk) => chunks.push(chunk));
        response.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const base64 = buffer.toString("base64");
          const mimeType = response.headers["content-type"] || "image/jpeg";
          resolve(`data:${mimeType};base64,${base64}`);
        });
        response.on("error", reject);
      })
      .on("error", reject);
  });
}

async function addImagesToProducts() {
  try {
    await mongoose.connect("mongodb://localhost:27017/essence");
    console.log("✅ Conectado a MongoDB\n");

    let successCount = 0;
    let errorCount = 0;

    for (const [productName, imageUrl] of Object.entries(productImages)) {
      try {
        const product = await Product.findOne({ name: productName });

        if (!product) {
          console.log(`⚠️  Producto no encontrado: ${productName}`);
          errorCount++;
          continue;
        }

        if (product.image && product.image.url) {
          console.log(`⏭️  ${productName} ya tiene imagen`);
          continue;
        }

        console.log(`📥 Descargando imagen para: ${productName}`);
        const base64Image = await downloadImage(imageUrl);

        product.image = {
          url: base64Image,
          publicId: `tech_${Date.now()}_${Math.random()
            .toString(36)
            .substr(2, 9)}`,
        };

        await product.save();
        console.log(`✅ Imagen agregada: ${productName}\n`);
        successCount++;

        // Pequeña pausa para no saturar
        await new Promise((resolve) => setTimeout(resolve, 500));
      } catch (error) {
        console.error(`❌ Error con ${productName}:`, error.message);
        errorCount++;
      }
    }

    console.log("\n📊 Resumen:");
    console.log(`✅ Imágenes agregadas: ${successCount}`);
    console.log(`❌ Errores: ${errorCount}`);
    console.log(`📦 Total procesado: ${successCount + errorCount}`);

    await mongoose.disconnect();
    console.log("\n✅ Desconectado de MongoDB");
  } catch (error) {
    console.error("❌ Error general:", error);
    process.exit(1);
  }
}

addImagesToProducts();
