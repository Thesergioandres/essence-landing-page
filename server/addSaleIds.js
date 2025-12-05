import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const addSaleIds = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB\n");

    const Sale = mongoose.model('Sale', new mongoose.Schema({}, { strict: false }));
    
    // Obtener todas las ventas sin saleId, ordenadas por fecha
    const sales = await Sale.find({ saleId: { $exists: false } }).sort({ createdAt: 1 });
    
    console.log(`📊 Total de ventas sin ID: ${sales.length}\n`);

    if (sales.length === 0) {
      console.log('✅ Todas las ventas ya tienen saleId\n');
      await mongoose.connection.close();
      return;
    }

    console.log('🔄 Agregando IDs a las ventas...\n');

    // Agrupar por año
    const salesByYear = {};
    sales.forEach(sale => {
      const year = new Date(sale.createdAt).getFullYear();
      if (!salesByYear[year]) {
        salesByYear[year] = [];
      }
      salesByYear[year].push(sale);
    });

    let updated = 0;

    for (const [year, yearSales] of Object.entries(salesByYear)) {
      console.log(`\n📅 Año ${year}: ${yearSales.length} ventas`);
      
      for (let i = 0; i < yearSales.length; i++) {
        const sale = yearSales[i];
        const sequentialNumber = String(i + 1).padStart(4, '0');
        const saleId = `VTA-${year}-${sequentialNumber}`;
        
        await Sale.updateOne(
          { _id: sale._id },
          { $set: { saleId } }
        );
        
        updated++;
        console.log(`✅ ${saleId} - Fecha: ${new Date(sale.createdAt).toISOString().split('T')[0]}`);
      }
    }

    console.log(`\n${'='.repeat(80)}`);
    console.log(`✅ ${updated} ventas actualizadas con saleId`);
    console.log(`${'='.repeat(80)}\n`);

    await mongoose.connection.close();
    console.log('✅ Conexión cerrada');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

addSaleIds();
