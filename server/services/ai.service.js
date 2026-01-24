import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

// Lista de modelos priorizada para intentar en caso de fallo (429/404)
const MODELS_TO_TRY = [
  "gemini-2.0-flash-exp", // Preferido (Experimental suele ser gratuito/alto límite)
  "gemini-flash-latest", // Alias de la versión Flash estable actual
  "gemini-pro-latest", // Alias de la versión Pro estable actual
  "gemini-1.5-flash", // Fallback clásico
];

class AIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.client = null;

    if (this.apiKey) {
      try {
        this.client = new GoogleGenerativeAI(this.apiKey);
        // No inicializamos un único modelo aquí, lo haremos dinámicamente
      } catch (error) {
        console.error("Error initializing Gemini client:", error);
      }
    } else {
      console.warn(
        "GEMINI_API_KEY not found in environment variables. AI features will be disabled.",
      );
    }
  }

  /**
   * Intenta generar contenido probando múltiples modelos en cascada.
   */
  async generateWithFallback(prompt) {
    if (!this.client)
      throw new Error("Cliente Gemini no inicializado (Falta API Key)");

    let lastError = null;

    for (const modelName of MODELS_TO_TRY) {
      try {
        // console.log(`🤖 Intentando con modelo: ${modelName}...`);
        const model = this.client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text(); // Si tiene éxito, retornamos inmediatamente
      } catch (error) {
        console.warn(`⚠️ Falló modelo ${modelName}:`, error.message);

        // Si el error es de seguridad (Blocked), no tiene sentido reintentar con otro modelo igual
        if (error.response?.promptFeedback?.blockReason) {
          throw new Error(
            `Bloqueado por seguridad: ${error.response.promptFeedback.blockReason}`,
          );
        }

        lastError = error;
        // Continuamos al siguiente modelo en el bucle
      }
    }

    // Si agotamos todos los modelos
    throw lastError || new Error("Todos los modelos de IA fallaron.");
  }

  /**
   * Analiza el contexto del negocio y genera un reporte estratégico.
   * Diseñado para ser una única llamada de alto rendimiento.
   *
   * @param {Object} context - Datos minificados del negocio (Ventas, Gastos, Inventario, etc.)
   * @param {String} userQuestion - Pregunta específica del usuario (opcional)
   * @returns {Promise<String>} - Respuesta en Markdown
   */
  async analyzeBusinessContext(context, userQuestion = "") {
    if (!this.client) {
      return "⚠️ **Servicio de IA no disponible.**\n\nNo se ha configurado la API Key de Gemini. Por favor verifica las variables de entorno del servidor (`GEMINI_API_KEY`).\n\nMientras tanto, puedes consultar las métricas manuales en el dashboard.";
    }

    try {
      // Prompt Engineering: Project CEO
      const prompt = `
Eres un **Consultor Estratégico Senior (MBA)** especializado en retail y optimización de negocios. Estás analizando "Essence Vapes".

**TU MISIÓN:**
Analizar los datos financieros proporcionados y generar un reporte estratégico multidimensional en una sola respuesta.
Prioriza la brevedad, la claridad y el impacto. Usa formato Markdown.

**DATOS DEL NEGOCIO (Contexto Minificado):**
\`\`\`json
${JSON.stringify(context)}
\`\`\`

**PREGUNTA DEL USUARIO:**
"${userQuestion || "Dame un Resumen Ejecutivo del estado del negocio"}"

**ESTRUCTURA DE RESPUESTA REQUERIDA:**

1.  **🩺 Diagnóstico Rápido:**
    *   Define el "Estado de Salud" (Excelente / Estable / Crítico / En Crecimiento) basándote en el Margen y el Flujo con los datos provistos.
    *   Menciona 1 indicador clave que justifique tu diagnóstico.

2.  **💬 Respuesta Directa:**
    *   Responde específicamente a la pregunta del usuario usando los datos. Si no hay pregunta, omite esta sección o da un insight general.

3.  **💎 Oportunidad Oculta (Insight CEO):**
    *   Detecta **UN** patrón o anomalía que un humano podría pasar por alto.
    *   Ejemplo: "Tienes $5M estancados en inventario de baja rotación" o "Tu producto X tiene margen negativo real".

4.  **🚀 Acción Prioritaria (Solo UNA):**
    *   ¿Qué es lo *único* mas importante que el dueño debería hacer HOY para mejorar la rentabilidad? Sé imperativo y accionable.

**REGLAS:**
*   Sé directo. No uses saludos corporativos largos.
*   Si los datos son insuficientes, dilo claramente.
*   Usa emojis con moderación para facilitar la lectura.
*   Habla en español profesional pero cercano.
`;

      const text = await this.generateWithFallback(prompt);
      return text;
    } catch (error) {
      console.error(
        "Error generating content with Gemini (All models failed):",
        error,
      );

      let errorMsg = "Hubo un problema procesando tu solicitud.";

      if (error.message.includes("429")) {
        errorMsg =
          "⚠️ **Límite de Cuota Excedido.**\n\nEl plan gratuito de Gemini está saturado temporalmente o ha alcanzado su límite diario. Por favor intenta de nuevo en unos minutos.";
      } else {
        errorMsg = `⚠️ **Error de Análisis Inteligente.**\n\n${error.message}`;
      }

      return errorMsg;
    }
  }
}

export const aiService = new AIService();
