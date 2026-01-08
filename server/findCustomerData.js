import mongoose from "mongoose";

async function findCustomer() {
  try {
    await mongoose.connect("mongodb://localhost:27017/essence");
    console.log("✅ Conectado a MongoDB");

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    console.log("\n📚 Todas las colecciones:");
    collections.forEach((c) => console.log(`  - ${c.name}`));

    // Buscar en todas las colecciones que puedan contener clientes
    for (const coll of collections) {
      if (
        coll.name.toLowerCase().includes("client") ||
        coll.name.toLowerCase().includes("customer")
      ) {
        const count = await db.collection(coll.name).countDocuments();
        console.log(`\n📊 ${coll.name}: ${count} documentos`);

        if (count > 0) {
          const docs = await db.collection(coll.name).find().limit(3).toArray();
          console.log(`  Primeros documentos:`);
          docs.forEach((d) => {
            console.log(
              `    - ${d.name || d._id} | ${JSON.stringify(d).substring(
                0,
                100
              )}`
            );
          });
        }
      }
    }

    await mongoose.connection.close();
    console.log("\n✅ Desconectado");
  } catch (error) {
    console.error("❌ Error:", error.message);
    console.error(error);
    process.exit(1);
  }
}

findCustomer();
