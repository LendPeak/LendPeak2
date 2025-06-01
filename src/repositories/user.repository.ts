import { ClientSession } from 'mongoose';
import { UserModel } from '../schemas/user.schema';
import { UserActivityModel } from '../schemas/user-activity.schema';
import { IUser, UserRole, UserStatus } from '../models/user.model';
import { logger } from '../utils/logger';

export interface UserSearchCriteria {
  email?: string;
  username?: string;
  roles?: UserRole[];
  status?: UserStatus;
  department?: string;
  searchTerm?: string;
}

export interface UserStatistics {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  suspendedUsers: number;
  lockedUsers: number;
  usersByRole: Record<string, number>;
  recentRegistrations: number;
  recentLogins: number;
}

export class UserRepository {
  /**
   * Create a new user
   */
  async create(userData: Partial<IUser>, session?: ClientSession): Promise<IUser> {
    const [user] = await UserModel.create([userData], { session });
    
    logger.info('User created', { userId: user.id, email: user.email });
    
    return user;
  }

  /**
   * Find user by ID
   */
  async findById(id: string, includePassword = false): Promise<IUser | null> {
    const query = UserModel.findById(id);
    
    if (includePassword) {
      query.select('+password');
    }
    
    return query.exec();
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string, includePassword = false): Promise<IUser | null> {
    const query = UserModel.findOne({ email: email.toLowerCase() });
    
    if (includePassword) {
      query.select('+password');
    }
    
    return query.exec();
  }

  /**
   * Find user by username
   */
  async findByUsername(username: string, includePassword = false): Promise<IUser | null> {
    const query = UserModel.findOne({ username });
    
    if (includePassword) {
      query.select('+password');
    }
    
    return query.exec();
  }

  /**
   * Search users
   */
  async search(criteria: UserSearchCriteria): Promise<IUser[]> {
    const query: any = {};

    if (criteria.email) {
      query.email = new RegExp(criteria.email, 'i');
    }

    if (criteria.username) {
      query.username = new RegExp(criteria.username, 'i');
    }

    if (criteria.roles && criteria.roles.length > 0) {
      query.roles = { $in: criteria.roles };
    }

    if (criteria.status) {
      query.status = criteria.status;
    }

    if (criteria.department) {
      query.departments = criteria.department;
    }

    if (criteria.searchTerm) {
      query.$or = [
        { email: new RegExp(criteria.searchTerm, 'i') },
        { username: new RegExp(criteria.searchTerm, 'i') },
        { firstName: new RegExp(criteria.searchTerm, 'i') },
        { lastName: new RegExp(criteria.searchTerm, 'i') },
      ];
    }

    return UserModel.find(query).exec();
  }

  /**
   * Update user
   */
  async update(id: string, updates: Partial<IUser>): Promise<IUser | null> {
    const user = await UserModel.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true, runValidators: true }
    );

    if (user) {
      logger.info('User updated', { userId: id, updates: Object.keys(updates) });
    }

    return user;
  }

  /**
   * Add role to user
   */
  async addRole(userId: string, role: UserRole): Promise<IUser | null> {
    const user = await UserModel.findById(userId);
    
    if (!user) {
      return null;
    }

    if (!user.roles.includes(role)) {
      user.roles.push(role);
      await user.save();
      logger.info('Role added to user', { userId, role });
    }

    return user;
  }

  /**
   * Remove role from user
   */
  async removeRole(userId: string, role: UserRole): Promise<IUser | null> {
    const user = await UserModel.findById(userId);
    
    if (!user) {
      return null;
    }

    user.roles = user.roles.filter(r => r !== role);
    await user.save();
    
    logger.info('Role removed from user', { userId, role });

    return user;
  }

  /**
   * Update user status
   */
  async updateStatus(userId: string, status: UserStatus, reason?: string): Promise<IUser | null> {
    const user = await this.update(userId, { status });

    if (user && status === UserStatus.SUSPENDED) {
      // Revoke all tokens when suspended
      const authService = await import('../services/auth.service');
      await authService.AuthService.prototype.revokeAllTokens.call(
        new authService.AuthService(),
        userId,
        reason || 'Account suspended'
      );
    }

    logger.info('User status updated', { userId, status, reason });

    return user;
  }

  /**
   * Get user statistics
   */
  async getStatistics(): Promise<UserStatistics> {
    const [
      totalUsers,
      activeUsers,
      inactiveUsers,
      suspendedUsers,
      lockedUsers,
      usersByRole,
      recentRegistrations,
      recentLogins,
    ] = await Promise.all([
      UserModel.countDocuments(),
      UserModel.countDocuments({ status: UserStatus.ACTIVE }),
      UserModel.countDocuments({ status: UserStatus.INACTIVE }),
      UserModel.countDocuments({ status: UserStatus.SUSPENDED }),
      UserModel.countDocuments({ status: UserStatus.LOCKED }),
      this.getUsersByRole(),
      this.getRecentRegistrations(),
      this.getRecentLogins(),
    ]);

    return {
      totalUsers,
      activeUsers,
      inactiveUsers,
      suspendedUsers,
      lockedUsers,
      usersByRole,
      recentRegistrations,
      recentLogins,
    };
  }

  /**
   * Get users by role count
   */
  private async getUsersByRole(): Promise<Record<string, number>> {
    const result = await UserModel.aggregate([
      { $unwind: '$roles' },
      { $group: { _id: '$roles', count: { $sum: 1 } } },
    ]);

    return result.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
  }

  /**
   * Get recent registrations count
   */
  private async getRecentRegistrations(): Promise<number> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return UserModel.countDocuments({
      createdAt: { $gte: thirtyDaysAgo },
    });
  }

  /**
   * Get recent logins count
   */
  private async getRecentLogins(): Promise<number> {
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    return UserActivityModel.countDocuments({
      action: 'LOGIN',
      success: true,
      timestamp: { $gte: twentyFourHoursAgo },
    });
  }

  /**
   * Get user activity
   */
  async getUserActivity(userId: string, limit = 100): Promise<any[]> {
    return UserActivityModel
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  /**
   * Delete user (soft delete)
   */
  async delete(id: string, deletedBy: string): Promise<boolean> {
    const user = await this.update(id, {
      status: UserStatus.INACTIVE,
      deactivatedAt: new Date(),
      deactivatedBy: deletedBy,
    });

    if (user) {
      // Revoke all tokens
      const authService = await import('../services/auth.service');
      await authService.AuthService.prototype.revokeAllTokens.call(
        new authService.AuthService(),
        id,
        'Account deactivated'
      );

      logger.info('User soft deleted', { userId: id, deletedBy });
    }

    return !!user;
  }
}

// Export singleton instance
export const userRepository = new UserRepository();