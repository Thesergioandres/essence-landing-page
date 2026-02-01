import { LoginUseCase } from "../../../application/use-cases/LoginUseCase.js";
import { RegisterUserUseCase } from "../../../application/use-cases/RegisterUserUseCase.js";

/**
 * Login Controller (Hexagonal)
 */
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const useCase = new LoginUseCase();
    const result = await useCase.execute(email, password);

    res.json(result);
  } catch (error) {
    if (error.message === "Invalid credentials") {
      return res.status(401).json({ message: error.message });
    }
    next(error);
  }
};

/**
 * Register Controller (Hexagonal)
 * Note: Assuming public registration or protected by admin logic depending on route
 */
export const register = async (req, res, next) => {
  try {
    const useCase = new RegisterUserUseCase();
    // businessId might come from headers if SaaS or body if simple logic
    const businessId = req.headers["x-business-id"] || req.body.businessId;

    const result = await useCase.execute({
      ...req.body,
      businessId,
    });

    res.status(201).json(result);
  } catch (error) {
    if (error.message === "User already exists") {
      return res.status(400).json({ message: error.message });
    }
    next(error);
  }
};
