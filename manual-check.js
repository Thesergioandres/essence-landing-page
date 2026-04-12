// Token extraÃ­do de tus logs recientes (VÃ¡lido hasta marzo 2026)
const TOKEN = "TU_TOKEN_AQUI"; // El usuario no me dio el string del token, solo el payload decodificado.
// Wait, the logs showed: "ðŸ”‘ Token decodificado: { ... }" followed by no "Authorization" header dump.
// I DO NOT HAVE THE ACTUAL SIGNED TOKEN STRING. I only have the decoded payload.
// I cannot use the token. I must ask the user to provide it or run a curl command themselves.

// Revert plan: I will create a script that asks for the token or just does a basic health check,
// but most importantly, I will instruct the user to use CURL.

console.warn("[Essence Debug]", 
  "âš ï¸ No tengo tu token firmado (solo vi el contenido decodificado en los logs).",
);
console.warn("[Essence Debug]", 
  "Por favor, abre una terminal y ejecuta este comando EXACTO para ver quÃ© responde el servidor realmente:",
);
console.warn("[Essence Debug]", "");
console.warn("[Essence Debug]", 
  `curl -v http://localhost:5000/api/v2/auth/profile -H "Authorization: Bearer <PEGA_TU_TOKEN_AQUI>"`,
);
console.warn("[Essence Debug]", "");
console.warn("[Essence Debug]", 
  "Si el servidor responde JSON vÃ¡lido, el problema es 100% del navegador/extensiones.",
);

