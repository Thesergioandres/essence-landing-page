import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "../models/User.js";

const run = async () => {
  let exitCode = 0;
  try {
    dotenv.config();

    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI no está definido en el .env");
    }

    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 3000,
    });

    const users = await User.find({}, "name email role createdAt").lean();

    if (!users.length) {
      console.log("No hay usuarios registrados en la base de datos.");
    } else {
      console.log("Usuarios registrados:");
      for (const user of users) {
        console.log(`- ${user.name} <${user.email}> (rol: ${user.role})`);
      }
    }
  } catch (error) {
    exitCode = 1;

    const message = error instanceof Error ? error.message : String(error);
    console.error("Error listando usuarios:", message);

    if (message.includes("ECONNREFUSED")) {
      console.error(
        "\nℹ️  Asegúrate de que MongoDB esté corriendo. Inicia el servicio local con 'mongod'."
      );
    }
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect().catch(() => undefined);
    }
    process.exit(exitCode);
  }
};

run();
