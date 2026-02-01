import User from "../models/User.js";

export class UserRepository {
  /**
   * Find user by ID
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    return User.findById(id).lean();
  }

  /**
   * Find user by Email (with password select option)
   * @param {string} email
   * @param {boolean} withPassword
   * @returns {Promise<Object|null>}
   */
  async findByEmail(email, withPassword = false) {
    const query = User.findOne({ email });
    if (withPassword) {
      query.select("+password"); // Mongoose specific
    }
    return query.lean({ virtuals: true }); // virtuals: true ensures properties like 'id' are available if lean is used, though Mongoose lean removes getters usually.
    // For Auth check, we might need the Mongoose document if we rely on instance methods like matchPassword.
    // But in Hexagonal, we should invoke AuthService for password matching using bcrypt directly if possible,
    // OR return the document if we reuse the Schema method.
    // Let's return the plain object and handle comparison in Service to be pure.
  }

  /**
   * Find by email returning Document (to use instance methods like matchPassword if needed)
   * @param {string} email
   */
  async findByEmailWithMethods(email) {
    return User.findOne({ email }).select("+password");
  }

  /**
   * Create a new user
   * @param {Object} userData
   * @returns {Promise<Object>}
   */
  async createUser(userData) {
    const user = await User.create(userData);
    return user.toObject();
  }
}
