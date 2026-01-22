/**
 * ============================================================================
 * VALIDACIÓN DE PERMISOS READ-ONLY EN PRODUCCIÓN
 * ============================================================================
 *
 * Este módulo valida que la conexión a producción tenga ÚNICAMENTE permisos
 * de lectura. Si detecta cualquier permiso de escritura, detiene el proceso
 * inmediatamente para proteger los datos de producción.
 *
 * @version 2.0.0
 * @date 2026-01-22
 */

import mongoose from "mongoose";
import { syncLogger } from "../utils/syncLogger.js";

// ============================================================================
// CONSTANTES DE PERMISOS PELIGROSOS
// ============================================================================

/**
 * Lista de permisos que indican capacidad de escritura.
 * Si el usuario tiene CUALQUIERA de estos, se rechaza la conexión.
 */
const DANGEROUS_PERMISSIONS = [
  // Permisos directos de escritura
  "insert",
  "update",
  "remove",
  "delete",
  "drop",
  "dropCollection",
  "dropDatabase",
  "createCollection",
  "createIndex",
  "dropIndex",
  "collMod",
  "compact",
  "convertToCapped",
  "reIndex",

  // Roles con capacidad de escritura
  "readWrite",
  "readWriteAnyDatabase",
  "dbAdmin",
  "dbAdminAnyDatabase",
  "userAdmin",
  "userAdminAnyDatabase",
  "clusterAdmin",
  "clusterManager",
  "clusterMonitor",
  "hostManager",
  "backup",
  "restore",
  "root",
  "__system",

  // Acciones peligrosas
  "write",
  "dbWrite",
  "anyAction",
];

/**
 * Roles que tienen permisos de escritura implícitos
 */
const DANGEROUS_ROLES = [
  "readWrite",
  "readWriteAnyDatabase",
  "dbOwner",
  "dbAdmin",
  "dbAdminAnyDatabase",
  "userAdmin",
  "userAdminAnyDatabase",
  "clusterAdmin",
  "clusterManager",
  "hostManager",
  "backup",
  "restore",
  "root",
  "__system",
];

/**
 * Roles permitidos (solo lectura)
 */
const ALLOWED_ROLES = ["read", "readAnyDatabase"];

// ============================================================================
// FUNCIONES DE VALIDACIÓN
// ============================================================================

/**
 * Obtiene información del usuario conectado y sus roles
 * @param {mongoose.Connection} connection - Conexión de Mongoose
 * @returns {Promise<Object>} Información del usuario
 */
async function getUserInfo(connection) {
  try {
    const db = connection.db;
    const result = await db.command({
      connectionStatus: 1,
      showPrivileges: true,
    });
    return result;
  } catch (error) {
    // Si no puede obtener el estado, asumir que es peligroso
    syncLogger.error(
      "No se pudo obtener información del usuario de producción",
    );
    throw new Error(`Error obteniendo info de usuario: ${error.message}`);
  }
}

/**
 * Extrae los roles del resultado de connectionStatus
 * @param {Object} connectionStatus - Resultado del comando connectionStatus
 * @returns {Array<string>} Lista de roles
 */
function extractRoles(connectionStatus) {
  const roles = [];

  if (connectionStatus?.authInfo?.authenticatedUserRoles) {
    for (const roleInfo of connectionStatus.authInfo.authenticatedUserRoles) {
      roles.push(roleInfo.role);
    }
  }

  if (connectionStatus?.authInfo?.authenticatedUsers) {
    for (const user of connectionStatus.authInfo.authenticatedUsers) {
      if (user.roles) {
        for (const role of user.roles) {
          roles.push(typeof role === "string" ? role : role.role);
        }
      }
    }
  }

  return [...new Set(roles)]; // Eliminar duplicados
}

/**
 * Extrae los privilegios del resultado de connectionStatus
 * @param {Object} connectionStatus - Resultado del comando connectionStatus
 * @returns {Array<string>} Lista de acciones permitidas
 */
function extractPrivileges(connectionStatus) {
  const actions = [];

  if (connectionStatus?.authInfo?.authenticatedUserPrivileges) {
    for (const privilege of connectionStatus.authInfo
      .authenticatedUserPrivileges) {
      if (privilege.actions) {
        actions.push(...privilege.actions);
      }
    }
  }

  return [...new Set(actions)]; // Eliminar duplicados
}

/**
 * Verifica si hay roles peligrosos
 * @param {Array<string>} roles - Lista de roles del usuario
 * @returns {Object} { hasDangerous: boolean, dangerousRoles: string[] }
 */
function checkDangerousRoles(roles) {
  const dangerousRoles = roles.filter((role) =>
    DANGEROUS_ROLES.some((dangerous) =>
      role.toLowerCase().includes(dangerous.toLowerCase()),
    ),
  );

  return {
    hasDangerous: dangerousRoles.length > 0,
    dangerousRoles,
  };
}

/**
 * Verifica si hay privilegios peligrosos
 * @param {Array<string>} privileges - Lista de acciones permitidas
 * @returns {Object} { hasDangerous: boolean, dangerousPrivileges: string[] }
 */
function checkDangerousPrivileges(privileges) {
  const dangerousPrivileges = privileges.filter((action) =>
    DANGEROUS_PERMISSIONS.some(
      (dangerous) => action.toLowerCase() === dangerous.toLowerCase(),
    ),
  );

  return {
    hasDangerous: dangerousPrivileges.length > 0,
    dangerousPrivileges,
  };
}

/**
 * Intenta ejecutar una operación de escritura para verificar permisos
 * @param {mongoose.Connection} connection - Conexión de Mongoose
 * @returns {Promise<boolean>} true si la escritura fue bloqueada (seguro)
 */
async function testWriteBlocked(connection) {
  const testCollectionName = `__permission_test_${Date.now()}`;

  try {
    const db = connection.db;

    // Intentar crear una colección temporal
    await db.createCollection(testCollectionName);

    // Si llegamos aquí, la escritura fue exitosa = PELIGRO
    // Intentar limpiar
    try {
      await db.dropCollection(testCollectionName);
    } catch (e) {
      // Ignorar error de limpieza
    }

    return false; // Escritura permitida = NO seguro
  } catch (error) {
    // Error esperado: no tiene permisos de escritura
    const errorMessage = error.message.toLowerCase();

    if (
      errorMessage.includes("not authorized") ||
      errorMessage.includes("unauthorized") ||
      errorMessage.includes("permission denied") ||
      errorMessage.includes("requires authentication") ||
      errorMessage.includes("not allowed to do action") ||
      error.code === 13 || // Unauthorized
      error.code === 18 // AuthenticationFailed
    ) {
      return true; // Escritura bloqueada = SEGURO
    }

    // Otro tipo de error, asumir que es peligroso
    syncLogger.warn(`Error inesperado en test de escritura: ${error.message}`);
    return false;
  }
}

/**
 * Intenta insertar un documento para verificar permisos
 * @param {mongoose.Connection} connection - Conexión de Mongoose
 * @returns {Promise<boolean>} true si la inserción fue bloqueada (seguro)
 */
async function testInsertBlocked(connection) {
  try {
    const db = connection.db;
    const testCollection = db.collection("__insert_test_temp");

    await testCollection.insertOne({
      _id: new mongoose.Types.ObjectId(),
      __test: true,
      timestamp: new Date(),
    });

    // Si llegamos aquí, la inserción fue exitosa = PELIGRO
    // Intentar limpiar
    try {
      await testCollection.deleteMany({ __test: true });
    } catch (e) {
      // Ignorar
    }

    return false; // Inserción permitida = NO seguro
  } catch (error) {
    const errorMessage = error.message.toLowerCase();

    if (
      errorMessage.includes("not authorized") ||
      errorMessage.includes("unauthorized") ||
      errorMessage.includes("permission denied") ||
      errorMessage.includes("not allowed to do action") ||
      errorMessage.includes("bloqueada en producción") ||
      errorMessage.includes("operación de escritura bloqueada") ||
      error.code === 13 ||
      error.code === 18
    ) {
      return true; // Inserción bloqueada = SEGURO
    }

    syncLogger.warn(`Error inesperado en test de inserción: ${error.message}`);
    return false;
  }
}

// ============================================================================
// FUNCIÓN PRINCIPAL DE VALIDACIÓN
// ============================================================================

/**
 * Valida que la conexión de producción sea estrictamente de solo lectura.
 * Si detecta cualquier capacidad de escritura, lanza un error fatal.
 *
 * @param {mongoose.Connection} prodConnection - Conexión a la BD de producción
 * @param {Object} options - Opciones de validación
 * @param {boolean} options.strictMode - Si true, también ejecuta tests de escritura reales
 * @param {boolean} options.exitOnFail - Si true, ejecuta process.exit(1) en caso de fallo
 * @returns {Promise<Object>} Resultado de la validación
 * @throws {Error} Si se detectan permisos de escritura
 */
export async function validateProdReadOnlyPermissions(
  prodConnection,
  options = {},
) {
  const { strictMode = true, exitOnFail = true } = options;

  syncLogger.section("VALIDACIÓN DE PERMISOS READ-ONLY");
  syncLogger.info("Verificando permisos de la conexión de producción...");

  const validationResult = {
    isValid: false,
    roles: [],
    privileges: [],
    dangerousRoles: [],
    dangerousPrivileges: [],
    writeTestPassed: false,
    insertTestPassed: false,
    errors: [],
  };

  try {
    // 1. Obtener información del usuario
    syncLogger.info("Obteniendo información del usuario conectado...");
    const userInfo = await getUserInfo(prodConnection);

    // 2. Extraer roles y privilegios
    validationResult.roles = extractRoles(userInfo);
    validationResult.privileges = extractPrivileges(userInfo);

    syncLogger.info(
      `Roles encontrados: ${validationResult.roles.join(", ") || "ninguno"}`,
    );
    syncLogger.info(
      `Privilegios encontrados: ${validationResult.privileges.length} acciones`,
    );

    // 3. Verificar roles peligrosos
    const roleCheck = checkDangerousRoles(validationResult.roles);
    validationResult.dangerousRoles = roleCheck.dangerousRoles;

    if (roleCheck.hasDangerous) {
      const errorMsg = `🚨 ROLES PELIGROSOS DETECTADOS: ${roleCheck.dangerousRoles.join(", ")}`;
      syncLogger.error(errorMsg);
      validationResult.errors.push(errorMsg);
    } else {
      syncLogger.success("No se detectaron roles peligrosos");
    }

    // 4. Verificar privilegios peligrosos
    const privilegeCheck = checkDangerousPrivileges(
      validationResult.privileges,
    );
    validationResult.dangerousPrivileges = privilegeCheck.dangerousPrivileges;

    if (privilegeCheck.hasDangerous) {
      const errorMsg = `🚨 PRIVILEGIOS PELIGROSOS DETECTADOS: ${privilegeCheck.dangerousPrivileges.join(", ")}`;
      syncLogger.error(errorMsg);
      validationResult.errors.push(errorMsg);
    } else {
      syncLogger.success("No se detectaron privilegios peligrosos");
    }

    // 5. Tests de escritura reales (modo estricto)
    if (strictMode) {
      syncLogger.info("Ejecutando tests de escritura reales...");

      // Test de creación de colección
      validationResult.writeTestPassed = await testWriteBlocked(prodConnection);
      if (validationResult.writeTestPassed) {
        syncLogger.success("Test de createCollection: BLOQUEADO ✓");
      } else {
        const errorMsg = "🚨 Test de createCollection: PERMITIDO (PELIGRO)";
        syncLogger.error(errorMsg);
        validationResult.errors.push(errorMsg);
      }

      // Test de inserción
      validationResult.insertTestPassed =
        await testInsertBlocked(prodConnection);
      if (validationResult.insertTestPassed) {
        syncLogger.success("Test de insertOne: BLOQUEADO ✓");
      } else {
        const errorMsg = "🚨 Test de insertOne: PERMITIDO (PELIGRO)";
        syncLogger.error(errorMsg);
        validationResult.errors.push(errorMsg);
      }
    }

    // 6. Determinar resultado final
    const hasErrors = validationResult.errors.length > 0;
    const rolesOk = !roleCheck.hasDangerous;
    const privilegesOk = !privilegeCheck.hasDangerous;
    const testsOk =
      !strictMode ||
      (validationResult.writeTestPassed && validationResult.insertTestPassed);

    validationResult.isValid = rolesOk && privilegesOk && testsOk;

    // 7. Mostrar resultado final
    if (validationResult.isValid) {
      syncLogger.success(
        "═══════════════════════════════════════════════════════",
      );
      syncLogger.success(
        "✅ VALIDACIÓN EXITOSA: Conexión confirmada como READ-ONLY",
      );
      syncLogger.success(
        "═══════════════════════════════════════════════════════",
      );
      syncLogger.prod("Conexión de producción validada como solo lectura");

      return validationResult;
    } else {
      syncLogger.error(
        "═══════════════════════════════════════════════════════",
      );
      syncLogger.error(
        "🚨 VALIDACIÓN FALLIDA: SE DETECTARON PERMISOS DE ESCRITURA",
      );
      syncLogger.error(
        "═══════════════════════════════════════════════════════",
      );
      syncLogger.error("");
      syncLogger.error("ERRORES ENCONTRADOS:");
      for (const error of validationResult.errors) {
        syncLogger.error(`  • ${error}`);
      }
      syncLogger.error("");
      syncLogger.error("ACCIÓN REQUERIDA:");
      syncLogger.error(
        "  1. Crea un usuario de MongoDB con SOLO permisos de lectura",
      );
      syncLogger.error('  2. Asigna únicamente el rol "read" a ese usuario');
      syncLogger.error(
        "  3. Actualiza MONGO_URI_PROD_READ con las credenciales del nuevo usuario",
      );
      syncLogger.error("");
      syncLogger.error(
        "El servidor NO puede iniciarse con permisos de escritura en producción.",
      );
      syncLogger.error(
        "═══════════════════════════════════════════════════════",
      );

      if (exitOnFail) {
        syncLogger.error("Deteniendo proceso por seguridad...");
        process.exit(1);
      }

      throw new Error("Validación de permisos read-only fallida");
    }
  } catch (error) {
    if (error.message === "Validación de permisos read-only fallida") {
      throw error;
    }

    syncLogger.error(`Error durante validación: ${error.message}`);
    validationResult.errors.push(error.message);

    if (exitOnFail) {
      syncLogger.error("Deteniendo proceso por error de validación...");
      process.exit(1);
    }

    throw error;
  }
}

/**
 * Versión simplificada que solo verifica y retorna boolean
 * @param {mongoose.Connection} prodConnection - Conexión a producción
 * @returns {Promise<boolean>} true si es read-only
 */
export async function isConnectionReadOnly(prodConnection) {
  try {
    const result = await validateProdReadOnlyPermissions(prodConnection, {
      strictMode: true,
      exitOnFail: false,
    });
    return result.isValid;
  } catch (error) {
    return false;
  }
}

/**
 * Valida la URI de producción sin establecer conexión completa
 * @param {string} uri - URI de MongoDB
 * @returns {Object} Análisis de la URI
 */
export function analyzeProductionUri(uri) {
  const analysis = {
    hasCredentials: false,
    isAtlas: false,
    hasReadPreference: false,
    readPreference: null,
    database: null,
    warnings: [],
  };

  if (!uri) {
    analysis.warnings.push("URI no proporcionada");
    return analysis;
  }

  // Verificar si tiene credenciales
  analysis.hasCredentials = uri.includes("@");

  // Verificar si es Atlas
  analysis.isAtlas =
    uri.includes("mongodb+srv://") || uri.includes(".mongodb.net");

  // Extraer readPreference si existe
  const readPrefMatch = uri.match(/readPreference=(\w+)/);
  if (readPrefMatch) {
    analysis.hasReadPreference = true;
    analysis.readPreference = readPrefMatch[1];
  }

  // Extraer nombre de base de datos
  const dbMatch = uri.match(/\/([^/?]+)(\?|$)/);
  if (dbMatch) {
    analysis.database = dbMatch[1];
  }

  // Advertencias
  if (!analysis.hasReadPreference) {
    analysis.warnings.push(
      "No tiene readPreference configurado. Se recomienda: readPreference=secondaryPreferred",
    );
  }

  if (analysis.readPreference === "primary") {
    analysis.warnings.push(
      "readPreference=primary puede causar carga innecesaria en el primario",
    );
  }

  return analysis;
}

export default {
  validateProdReadOnlyPermissions,
  isConnectionReadOnly,
  analyzeProductionUri,
  DANGEROUS_PERMISSIONS,
  DANGEROUS_ROLES,
  ALLOWED_ROLES,
};
