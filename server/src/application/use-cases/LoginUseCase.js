import { AuthService } from "../../domain/services/AuthService.js";
import { UserRepository } from "../../infrastructure/database/repositories/UserRepository.js";

export class LoginUseCase {
  constructor() {
    this.userRepository = new UserRepository();
  }

  async execute(email, password) {
    if (!email || !password) {
      throw new Error("Please provide an email and password");
    }

    // 1. Find User (Need password for check)
    // Using findByEmailWithMethods if we rely on schema or just plain object if we do manual compare.
    // Let's use the object + AuthService for purity.
    // However, Mongoose 'select("+password")' is needed.
    // The query MUST return the hash.
    const user = await this.userRepository.findByEmailWithMethods(email);

    if (!user) {
      throw new Error("Invalid credentials");
    }

    // 2. Validate Password
    // Check if use matchPassword method typically found in Mongoose schemas
    // Or use AuthService.
    const isMatch = await AuthService.validatePassword(password, user.password);

    if (!isMatch) {
      throw new Error("Invalid credentials");
    }

    // 3. Generate Token
    const token = AuthService.generateToken(user._id, user.role, user.business);

    // 4. Return result
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      active: user.active,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      business: user.business,
      token,
    };
  }
}
