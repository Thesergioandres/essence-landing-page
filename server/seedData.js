import dotenv from "dotenv";
import mongoose from "mongoose";
import Category from "./models/Category.js";
import Product from "./models/Product.js";

dotenv.config();

const categories = [
  {
    name: "Skincare",
    description: "Productos para el cuidado de la piel",
  },
  {
    name: "Makeup",
    description: "Productos de maquillaje",
  },
  {
    name: "Haircare",
    description: "Productos para el cuidado del cabello",
  },
];

const products = [
  {
    name: "Crema Hidratante Facial",
    description:
      "Crema hidratante para todo tipo de piel con ácido hialurónico",
    purchasePrice: 15000,
    suggestedPrice: 25000,
    distributorPrice: 20000,
    clientPrice: 25000,
    distributorCommission: 5000,
    totalStock: 50,
    warehouseStock: 50,
    lowStockAlert: 10,
    featured: true,
    ingredients: ["Ácido Hialurónico", "Vitamina E", "Aloe Vera"],
    benefits: ["Hidratación profunda", "Reduce arrugas", "Piel suave"],
  },
  {
    name: "Sérum Facial Vitamina C",
    description: "Sérum iluminador con vitamina C y antioxidantes",
    purchasePrice: 20000,
    suggestedPrice: 35000,
    distributorPrice: 28000,
    clientPrice: 35000,
    distributorCommission: 8000,
    totalStock: 30,
    warehouseStock: 30,
    lowStockAlert: 5,
    featured: true,
    ingredients: ["Vitamina C", "Ácido Ferúlico", "Vitamina E"],
    benefits: ["Ilumina la piel", "Reduce manchas", "Antioxidante"],
  },
  {
    name: "Labial Matte",
    description: "Labial de larga duración con acabado mate",
    purchasePrice: 8000,
    suggestedPrice: 15000,
    distributorPrice: 12000,
    clientPrice: 15000,
    distributorCommission: 4000,
    totalStock: 100,
    warehouseStock: 100,
    lowStockAlert: 20,
    featured: false,
    ingredients: ["Cera de Abeja", "Vitamina E", "Aceite de Jojoba"],
    benefits: ["Larga duración", "No reseca", "Colores vibrantes"],
  },
];

async function seedDatabase() {
  try {
    console.log("🔌 Conectando a MongoDB...");
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ Conectado a MongoDB");

    // Limpiar datos existentes
    console.log("\n🗑️  Limpiando datos existentes...");
    await Category.deleteMany({});
    await Product.deleteMany({});
    console.log("✅ Datos limpiados");

    // Crear categorías
    console.log("\n📁 Creando categorías...");
    const createdCategories = [];
    for (const cat of categories) {
      const category = await Category.create(cat);
      createdCategories.push(category);
    }
    console.log(`✅ ${createdCategories.length} categorías creadas`);

    // Asignar categoría a productos
    const skincareCategory = createdCategories.find(
      (c) => c.name === "Skincare"
    );
    const makeupCategory = createdCategories.find((c) => c.name === "Makeup");

    products[0].category = skincareCategory._id;
    products[1].category = skincareCategory._id;
    products[2].category = makeupCategory._id;

    // Crear productos
    console.log("\n📦 Creando productos...");
    const createdProducts = await Product.insertMany(products);
    console.log(`✅ ${createdProducts.length} productos creados`);

    console.log("\n🎉 ¡Base de datos poblada exitosamente!");
    console.log("\n📊 Resumen:");
    console.log(`   - Categorías: ${createdCategories.length}`);
    console.log(`   - Productos: ${createdProducts.length}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

seedDatabase();
