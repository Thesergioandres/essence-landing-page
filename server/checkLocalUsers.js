import mongoose from "mongoose";
import User from "./models/User.js";

async function checkUsers() {
  try {
    await mongoose.connect("mongodb://localhost:27017/essence_local");
    console.log("\n✅ Conectado a essence_local\n");

    const users = await User.find({}, "email role");

    console.log("📋 Usuarios encontrados:");
    console.log("─".repeat(50));

    if (users.length === 0) {
      console.log("❌ No hay usuarios en la base de datos local");
      console.log("\n💡 Ejecuta: node seedAdmin.js o node createGodUser.js");
    } else {
      users.forEach((u) => {
        console.log(`  • ${u.email.padEnd(30)} [${u.role}]`);
      });
      console.log("─".repeat(50));
      console.log(`\nTotal: ${users.length} usuarios\n`);
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

checkUsers();
