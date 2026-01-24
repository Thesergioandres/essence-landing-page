import dotenv from "dotenv";
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
const URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

console.log("🔍 Consultando modelos disponibles...");

async function checkModels() {
  if (!API_KEY) {
    console.error("❌ Error: No hay GEMINI_API_KEY en el archivo .env");
    return;
  }

  try {
    const response = await fetch(URL);
    const data = await response.json();

    if (data.error) {
      console.error("❌ Error de API:", data.error.message);
    } else if (data.models) {
      console.log("✅ Modelos Disponibles para tu cuenta:");
      data.models.forEach((m) => {
        // Filtrar solo los que sirven para generar contenido
        if (m.supportedGenerationMethods.includes("generateContent")) {
          console.log(`   - ${m.name.replace("models/", "")}`);
        }
      });
    } else {
      console.log("⚠️ Respuesta extraña:", data);
    }
  } catch (error) {
    console.error("❌ Error de red:", error.message);
  }
}

checkModels();
