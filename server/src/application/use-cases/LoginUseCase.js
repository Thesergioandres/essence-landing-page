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

    // 1. Find User (Need password for check + memberships)
    const user = await this.userRepository.findByEmailWithMethods(email);

    if (!user) {
      throw new Error("Invalid credentials");
    }

    // 2. Validate Password
    const isMatch = await AuthService.validatePassword(password, user.password);

    if (!isMatch) {
      throw new Error("Invalid credentials");
    }

    // 3. Get first active business from memberships (for token)
    const memberships = user._doc?.memberships || user.memberships || [];
    const primaryMembership = memberships[0];
    const businessId = primaryMembership?.business?._id || null;

    // 4. Generate Token
    const token = AuthService.generateToken(user._id, user.role, businessId);

    // 5. Return result with memberships for frontend
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      active: user.active,
      subscriptionExpiresAt: user.subscriptionExpiresAt,
      memberships, // 🔑 Frontend needs this to know user has businesses
      token,
    };
  }
}
