import mongoose from "mongoose";

const connectDB = async () => {
  try {
    // Soportar tanto MONGODB_URI (Vercel) como MONGO_URI (legacy)
    const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;

    if (!mongoUri) {
      throw new Error(
        "MONGODB_URI no está definida en las variables de entorno"
      );
    }

    const conn = await mongoose.connect(mongoUri);
    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error("❌ Error conectando a MongoDB:", error.message);
    process.exit(1);
  }
};

export default connectDB;
