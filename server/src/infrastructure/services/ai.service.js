import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";

dotenv.config();

// Lista de modelos priorizada para intentar en caso de fallo (429/404)
const MODELS_TO_TRY = [
  "gemini-2.0-flash-exp", // Preferido (Experimental suele ser gratuito/alto lÃ­mite)
  "gemini-flash-latest", // Alias de la versiÃ³n Flash estable actual
  "gemini-pro-latest", // Alias de la versiÃ³n Pro estable actual
  "gemini-1.5-flash", // Fallback clÃ¡sico
];

class AIService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.client = null;

    if (this.apiKey) {
      try {
        this.client = new GoogleGenerativeAI(this.apiKey);
        // No inicializamos un Ãºnico modelo aquÃ­, lo haremos dinÃ¡micamente
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
   * Intenta generar contenido probando mÃºltiples modelos en cascada.
   */
  async generateWithFallback(prompt) {
    if (!this.client)
      throw new Error("Cliente Gemini no inicializado (Falta API Key)");

    let lastError = null;

    for (const modelName of MODELS_TO_TRY) {
      try {
        const model = this.client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text(); // Si tiene Ã©xito, retornamos inmediatamente
      } catch (error) {
        console.warn(`âš ï¸ FallÃ³ modelo ${modelName}:`, error.message);

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
   * Analiza el contexto del negocio y genera un reporte estratÃ©gico.
   * DiseÃ±ado para ser una Ãºnica llamada de alto rendimiento.
   *
   * @param {Object} context - Datos minificados del negocio (Ventas, Gastos, Inventario, etc.)
   * @param {String} userQuestion - Pregunta especÃ­fica del usuario (opcional)
   * @returns {Promise<String>} - Respuesta en Markdown
   */
  async analyzeBusinessContext(context, userQuestion = "") {
    if (!this.client) {
      return "âš ï¸ **Servicio de IA no disponible.**\n\nNo se ha configurado la API Key de Gemini. Por favor verifica las variables de entorno del servidor (`GEMINI_API_KEY`).\n\nMientras tanto, puedes consultar las mÃ©tricas manuales en el dashboard.";
    }

    try {
      // Prompt Engineering: Project CEO
      const prompt = `
Eres un **Consultor EstratÃ©gico Senior (MBA)** especializado en retail y optimizaciÃ³n de negocios. EstÃ¡s analizando "Essence Vapes".

**TU MISIÃ“N:**
Analizar los datos financieros proporcionados y generar un reporte estratÃ©gico multidimensional en una sola respuesta.
Prioriza la brevedad, la claridad y el impacto. Usa formato Markdown.

**DATOS DEL NEGOCIO (Contexto Minificado):**
\`\`\`json
${JSON.stringify(context)}
\`\`\`

**PREGUNTA DEL USUARIO:**
"${userQuestion || "Dame un Resumen Ejecutivo del estado del negocio"}"

**ESTRUCTURA DE RESPUESTA REQUERIDA:**

1.  **ðŸ©º DiagnÃ³stico RÃ¡pido:**
    *   Define el "Estado de Salud" (Excelente / Estable / CrÃ­tico / En Crecimiento) basÃ¡ndote en el Margen y el Flujo con los datos provistos.
    *   Menciona 1 indicador clave que justifique tu diagnÃ³stico.

2.  **ðŸ’¬ Respuesta Directa:**
    *   Responde especÃ­ficamente a la pregunta del usuario usando los datos. Si no hay pregunta, omite esta secciÃ³n o da un insight general.

3.  **ðŸ’Ž Oportunidad Oculta (Insight CEO):**
    *   Detecta **UN** patrÃ³n o anomalÃ­a que un humano podrÃ­a pasar por alto.
    *   Ejemplo: "Tienes $5M estancados en inventario de baja rotaciÃ³n" o "Tu producto X tiene margen negativo real".

4.  **ðŸš€ AcciÃ³n Prioritaria (Solo UNA):**
    *   Â¿QuÃ© es lo *Ãºnico* mas importante que el dueÃ±o deberÃ­a hacer HOY para mejorar la rentabilidad? SÃ© imperativo y accionable.

**REGLAS:**
*   SÃ© directo. No uses saludos corporativos largos.
*   Si los datos son insuficientes, dilo claramente.
*   Usa emojis con moderaciÃ³n para facilitar la lectura.
*   Habla en espaÃ±ol profesional pero cercano.
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
          "âš ï¸ **LÃ­mite de Cuota Excedido.**\n\nEl plan gratuito de Gemini estÃ¡ saturado temporalmente o ha alcanzado su lÃ­mite diario. Por favor intenta de nuevo en unos minutos.";
      } else {
        errorMsg = `âš ï¸ **Error de AnÃ¡lisis Inteligente.**\n\n${error.message}`;
      }

      return errorMsg;
    }
  }
}

export const aiService = new AIService();
