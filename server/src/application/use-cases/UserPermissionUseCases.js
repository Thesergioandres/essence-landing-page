/**
 * User Permission Use Cases - Hexagonal Architecture
 * Maneja todas las operaciones de permisos de usuario (God Mode)
 */

/**
 * Lista todos los usuarios del sistema
 */
export class ListUsersUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute() {
    const users = await this.userRepository.findAll();
    return { success: true, data: users };
  }
}

/**
 * Busca un usuario por email
 */
export class FindUserByEmailUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute(email) {
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }
    return { user };
  }
}

/**
 * Activa un usuario y configura su suscripción
 */
export class ActivateUserUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute(userId, { days = 30, months = 0, years = 0 } = {}) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    const subscriptionExpiresAt = this._addDuration(Date.now(), {
      days,
      months,
      years,
    });

    const updatedUser = await this.userRepository.updateStatus(userId, {
      status: "active",
      active: true,
      subscriptionExpiresAt,
      pausedRemainingMs: 0,
    });

    return { success: true, user: updatedUser };
  }

  _addDuration(baseDate, { days = 0, months = 0, years = 0 }) {
    const date = new Date(baseDate || Date.now());
    if (years) date.setFullYear(date.getFullYear() + Number(years));
    if (months) date.setMonth(date.getMonth() + Number(months));
    if (days) date.setDate(date.getDate() + Number(days));
    return date;
  }
}

/**
 * Suspende un usuario
 */
export class SuspendUserUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    const updatedUser = await this.userRepository.updateStatus(userId, {
      status: "suspended",
      active: false,
    });

    return { success: true, user: updatedUser };
  }
}

/**
 * Extiende la suscripción de un usuario
 */
export class ExtendSubscriptionUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute(userId, { days = 0, months = 0, years = 0 } = {}) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    const base =
      user.subscriptionExpiresAt &&
      new Date(user.subscriptionExpiresAt) > new Date()
        ? user.subscriptionExpiresAt
        : Date.now();

    const subscriptionExpiresAt = this._addDuration(base, {
      days,
      months,
      years,
    });

    const updatedUser = await this.userRepository.updateStatus(userId, {
      status: "active",
      active: true,
      subscriptionExpiresAt,
    });

    return { success: true, user: updatedUser };
  }

  _addDuration(baseDate, { days = 0, months = 0, years = 0 }) {
    const date = new Date(baseDate || Date.now());
    if (years) date.setFullYear(date.getFullYear() + Number(years));
    if (months) date.setMonth(date.getMonth() + Number(months));
    if (days) date.setDate(date.getDate() + Number(days));
    return date;
  }
}

/**
 * Pausa la suscripción de un usuario
 */
export class PauseSubscriptionUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    if (user.status !== "active") {
      throw new Error("Solo se puede pausar desde estado active");
    }
    if (!user.subscriptionExpiresAt) {
      throw new Error("El usuario no tiene suscripción activa");
    }

    const remaining =
      new Date(user.subscriptionExpiresAt).getTime() - Date.now();

    const updatedUser = await this.userRepository.updateStatus(userId, {
      status: "paused",
      active: false,
      subscriptionExpiresAt: null,
      pausedRemainingMs: Math.max(0, remaining),
    });

    return { success: true, user: updatedUser };
  }
}

/**
 * Reanuda la suscripción de un usuario pausado
 */
export class ResumeSubscriptionUseCase {
  constructor(userRepository) {
    this.userRepository = userRepository;
  }

  async execute(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    if (user.status !== "paused") {
      throw new Error("Solo se puede reanudar desde estado paused");
    }

    const remaining = user.pausedRemainingMs || 0;
    const expiresAt = new Date(Date.now() + remaining);

    const updatedUser = await this.userRepository.updateStatus(userId, {
      status: "active",
      active: true,
      subscriptionExpiresAt: expiresAt,
      pausedRemainingMs: 0,
    });

    return { success: true, user: updatedUser };
  }
}

/**
 * Elimina un usuario y todos sus datos asociados (cascada)
 */
export class DeleteUserUseCase {
  constructor(userRepository, businessRepository, cascadeDeleteService) {
    this.userRepository = userRepository;
    this.businessRepository = businessRepository;
    this.cascadeDeleteService = cascadeDeleteService;
  }

  async execute(userId, requestingUserId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error("Usuario no encontrado");
    }

    // Prevenir auto-eliminación
    if (requestingUserId === userId) {
      throw new Error("No puedes eliminarte a ti mismo");
    }

    // Obtener negocios del usuario
    const businessIds =
      await this.businessRepository.findBusinessIdsByOwner(userId);

    // Ejecutar eliminación en cascada
    const deletedBusinesses =
      await this.cascadeDeleteService.deleteUserAndRelatedData(
        userId,
        businessIds,
      );

    return {
      success: true,
      deletedBusinesses: deletedBusinesses.length,
    };
  }
}
