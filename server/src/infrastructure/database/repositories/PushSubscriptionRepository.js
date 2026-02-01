/**
 * PushSubscription Repository - Data Access Layer
 * Handles push notification subscription operations in Hexagonal Architecture
 */

import PushSubscription from "../../../../models/PushSubscription.js";

class PushSubscriptionRepository {
  /**
   * Subscribe or update push subscription
   */
  async subscribe(userId, businessId, subscription, userAgent) {
    if (!subscription?.endpoint || !subscription?.keys) {
      throw new Error("Datos de suscripción inválidos");
    }

    // Upsert subscription
    const pushSub = await PushSubscription.findOneAndUpdate(
      {
        user: userId,
        "subscription.endpoint": subscription.endpoint,
      },
      {
        user: userId,
        business: businessId,
        subscription,
        userAgent,
        active: true,
        lastUsed: new Date(),
      },
      {
        upsert: true,
        new: true,
      },
    );

    return pushSub;
  }

  /**
   * Unsubscribe push notification
   */
  async unsubscribe(userId, endpoint) {
    if (!endpoint) {
      throw new Error("Endpoint requerido");
    }

    const result = await PushSubscription.findOneAndUpdate(
      {
        user: userId,
        "subscription.endpoint": endpoint,
      },
      {
        active: false,
        lastUsed: new Date(),
      },
      { new: true },
    );

    return result;
  }

  /**
   * Get user subscriptions
   */
  async getUserSubscriptions(userId, businessId) {
    return await PushSubscription.find({
      user: userId,
      business: businessId,
      active: true,
    })
      .sort({ lastUsed: -1 })
      .lean();
  }

  /**
   * Update subscription preferences
   */
  async updatePreferences(userId, subscriptionId, preferences) {
    const subscription = await PushSubscription.findOne({
      _id: subscriptionId,
      user: userId,
    });

    if (!subscription) {
      return null;
    }

    subscription.preferences = {
      ...subscription.preferences,
      ...preferences,
    };

    return await subscription.save();
  }

  /**
   * Delete subscription
   */
  async delete(userId, subscriptionId) {
    const result = await PushSubscription.deleteOne({
      _id: subscriptionId,
      user: userId,
    });

    return result.deletedCount > 0;
  }

  /**
   * Get VAPID public key (static method)
   */
  getVapidPublicKey() {
    return process.env.VAPID_PUBLIC_KEY || null;
  }
}

export default new PushSubscriptionRepository();
