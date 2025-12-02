import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "./models/Product.js";

dotenv.config();

const checkImages = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    const products = await Product.find({}).limit(5).lean();
    
    console.log("\n📷 Formato de imágenes en DB:\n");
    products.forEach(p => {
      console.log(`Producto: ${p.name}`);
      console.log(`  Tipo: ${typeof p.image}`);
      if (p.image) {
        console.log(`  Estructura:`, JSON.stringify(p.image, null, 2));
      } else {
        console.log(`  Sin imagen`);
      }
      console.log('');
    });

    const total = await Product.countDocuments({});
    const withImages = await Product.countDocuments({ 'image.url': { $exists: true } });
    const withPublicId = await Product.countDocuments({ 'image.publicId': { $exists: true } });
    
    console.log(`\n📊 Resumen:`);
    console.log(`  Total productos: ${total}`);
    console.log(`  Con imagen (url): ${withImages}`);
    console.log(`  Con publicId (Cloudinary): ${withPublicId}`);
    console.log(`  Sin migrar: ${withImages - withPublicId}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
};

checkImages();
