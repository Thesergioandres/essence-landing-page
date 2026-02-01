import { AuthService } from "../../domain/services/AuthService.js";
import { UserRepository } from "../../infrastructure/database/repositories/UserRepository.js";

export class RegisterUserUseCase {
  constructor() {
    this.userRepository = new UserRepository();
  }

  async execute(userData) {
    const { name, email, password, role, businessId } = userData;

    if (!name || !email || !password) {
      throw new Error("Missing required fields: name, email, password");
    }

    // 1. Check if user exists
    const userExists = await this.userRepository.findByEmail(email);
    if (userExists) {
      throw new Error("User already exists");
    }

    // 2. Hash Password (Domain Service)
    const hashedPassword = await AuthService.hashPassword(password);

    // 3. Create User (Identity)
    // We assume Business check happens in Controller or Request Validation
    const newUser = await this.userRepository.createUser({
      name,
      email,
      password: hashedPassword, // Store hash!
      role: role || "user",
      business: businessId,
      // Other defaults handled by Mongoose Schema or added here
    });

    // 4. Generate Token (Auto-login after register?)
    const token = AuthService.generateToken(
      newUser._id,
      newUser.role,
      newUser.business,
    );

    return {
      _id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      business: newUser.business,
      token,
    };
  }
}
