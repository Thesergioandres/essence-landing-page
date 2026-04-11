/**
 * User Permission Controller - Hexagonal Architecture
 * Handles HTTP layer for user permission operations (God Mode)
 */
import {
  ActivateUserUseCase,
  ExtendSubscriptionUseCase,
  FindUserByEmailUseCase,
  ListUsersUseCase,
  PauseSubscriptionUseCase,
  ResumeSubscriptionUseCase,
  SuspendUserUseCase,
} from "../../../application/use-cases/UserPermissionUseCases.js";
import { UserPersistenceUseCase } from "../../../application/use-cases/repository-gateways/UserPersistenceUseCase.js";

const userRepository = new UserPersistenceUseCase();

/**
 * GET /api/v2/users
 * Lista todos los usuarios del sistema
 */
export const listUsers = async (_req, res) => {
  try {
    const useCase = new ListUsersUseCase(userRepository);
    const result = await useCase.execute();
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/**
 * GET /api/v2/users/email/:email
 * Busca un usuario por email
 */
export const findUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;
    const useCase = new FindUserByEmailUseCase(userRepository);
    const result = await useCase.execute(email);
    res.json(result);
  } catch (error) {
    if (error.message === "Usuario no encontrado") {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * PUT /api/v2/users/:id/activate
 * Activa un usuario y configura su suscripción
 */
export const activateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 30, months = 0, years = 0 } = req.body || {};

    const useCase = new ActivateUserUseCase(userRepository);
    const result = await useCase.execute(id, { days, months, years });
    res.json(result);
  } catch (error) {
    if (error.message === "Usuario no encontrado") {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * PUT /api/v2/users/:id/suspend
 * Suspende un usuario
 */
export const suspendUser = async (req, res) => {
  try {
    const { id } = req.params;
    const useCase = new SuspendUserUseCase(userRepository);
    const result = await useCase.execute(id);
    res.json(result);
  } catch (error) {
    if (error.message === "Usuario no encontrado") {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * PUT /api/v2/users/:id/extend
 * Extiende la suscripción de un usuario
 */
export const extendSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const { days = 0, months = 0, years = 0 } = req.body || {};

    const useCase = new ExtendSubscriptionUseCase(userRepository);
    const result = await useCase.execute(id, { days, months, years });
    res.json(result);
  } catch (error) {
    if (error.message === "Usuario no encontrado") {
      return res.status(404).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * PUT /api/v2/users/:id/pause
 * Pausa la suscripción de un usuario
 */
export const pauseSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const useCase = new PauseSubscriptionUseCase(userRepository);
    const result = await useCase.execute(id);
    res.json(result);
  } catch (error) {
    if (error.message === "Usuario no encontrado") {
      return res.status(404).json({ message: error.message });
    }
    if (
      error.message.includes("Solo se puede") ||
      error.message.includes("no tiene suscripción")
    ) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};

/**
 * PUT /api/v2/users/:id/resume
 * Reanuda la suscripción de un usuario pausado
 */
export const resumeSubscription = async (req, res) => {
  try {
    const { id } = req.params;
    const useCase = new ResumeSubscriptionUseCase(userRepository);
    const result = await useCase.execute(id);
    res.json(result);
  } catch (error) {
    if (error.message === "Usuario no encontrado") {
      return res.status(404).json({ message: error.message });
    }
    if (error.message.includes("Solo se puede")) {
      return res.status(400).json({ message: error.message });
    }
    res.status(500).json({ message: error.message });
  }
};
