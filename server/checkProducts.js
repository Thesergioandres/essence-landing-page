import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const checkProducts = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const Product = mongoose.model('Product', new mongoose.Schema({}, { strict: false }));
    const products = await Product.find({}).limit(10);
    
    products.forEach(p => {
      console.log(`${p.name}:`);
      console.log(`  Precio Compra: $${p.purchasePrice?.toLocaleString('es-CO') || 'N/A'}`);
      console.log(`  Precio Sugerido: $${p.suggestedPrice?.toLocaleString('es-CO') || 'N/A'}`);
      console.log(`  Precio Distribuidor: $${p.distributorPrice?.toLocaleString('es-CO') || 'N/A'}`);
      console.log(`  Precio Cliente: $${p.clientPrice?.toLocaleString('es-CO') || 'N/A'}`);
      console.log(`  Precio Venta (salePrice): $${p.salePrice?.toLocaleString('es-CO') || 'N/A'}`);
      console.log(`  Comisión: ${p.distributorCommission || 0}%`);
      console.log();
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
};

checkProducts();
