import Business from "../models/Business.js";
import Membership from "../models/Membership.js";
import User from "../models/User.js";

export class UserRepository {
  /**
   * Count total users
   * @returns {Promise<Number>}
   */
  async count() {
    return User.countDocuments({});
  }

  /**
   * Find all users (for God Panel)
   * @returns {Promise<Array>}
   */
  async findAll() {
    return User.find({}).select("-password").sort({ createdAt: -1 }).lean();
  }

  /**
   * Find user by ID with memberships populated
   * @param {string} id
   * @returns {Promise<Object|null>}
   */
  async findById(id) {
    const user = await User.findById(id).select("-password").lean();
    if (!user) return null;

    // Attach memberships with populated business data
    user.memberships = await this._getUserMemberships(user._id, user.role);
    return user;
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
      query.select("+password");
    }
    const user = await query.lean({ virtuals: true });
    if (!user) return null;

    // Attach memberships with populated business data
    user.memberships = await this._getUserMemberships(user._id, user.role);
    return user;
  }

  /**
   * Find by email returning Document with memberships
   * Used for login (needs password)
   * @param {string} email
   */
  async findByEmailWithMethods(email) {
    const user = await User.findOne({ email }).select("+password");
    if (!user) return null;

    // Convert to object and attach memberships
    const userObj = user.toObject();
    userObj.memberships = await this._getUserMemberships(user._id, user.role);

    // Keep the Mongoose document methods but add memberships
    user._doc.memberships = userObj.memberships;
    return user;
  }

  /**
   * Get user memberships with business data populated
   * Special handling for 'god' role: sees all businesses
   * @param {string} userId
   * @param {string} role
   * @returns {Promise<Array>}
   * @private
   */
  async _getUserMemberships(userId, role) {
    // 👁️ OMNISCIENCE: God sees all businesses as virtual memberships
    if (role === "god") {
      const businesses = await Business.find()
        .select(
          "name description config status contactEmail contactPhone contactWhatsapp contactLocation metadata logoUrl logoPublicId",
        )
        .sort({ createdAt: -1 })
        .lean();

      return businesses.map((b) => ({
        _id: `god_${b._id}`,
        business: b,
        user: userId,
        role: "god",
        status: "active",
      }));
    }

    // Normal users: get actual memberships
    return Membership.find({
      user: userId,
      status: "active",
    })
      .populate(
        "business",
        "name description config status contactEmail contactPhone contactWhatsapp contactLocation metadata logoUrl logoPublicId",
      )
      .lean();
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

  /**
   * Update user status and subscription (for God Mode)
   * @param {string} userId
   * @param {Object} updates
   * @returns {Promise<Object|null>}
   */
  async updateStatus(userId, updates) {
    const user = await User.findById(userId);
    if (!user) return null;

    Object.assign(user, updates);
    await user.save();

    const result = user.toObject();
    delete result.password;
    return result;
  }

  /**
   * Delete a user
   * @param {string} userId
   * @returns {Promise<Object|null>}
   */
  async delete(userId) {
    const user = await User.findById(userId);
    if (!user) return null;
    await user.deleteOne();
    return user.toObject();
  }
}
