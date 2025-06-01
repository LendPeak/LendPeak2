import request from 'supertest';
import mongoose from 'mongoose';
import { app } from '../../../src/api';
import { UserModel } from '../../../src/schemas/user.schema';
import { UserActivityModel } from '../../../src/schemas/user-activity.schema';
import { UserRole, UserStatus } from '../../../src/models/user.model';
import { config } from '../../../src/config';
import { AuthService } from '../../../src/services/auth.service';

describe('User Management Routes', () => {
  let adminUser: any;
  let superAdminUser: any;
  let regularUser: any;
  let adminToken: string;
  let superAdminToken: string;
  let regularToken: string;
  const authService = new AuthService();

  beforeAll(async () => {
    await mongoose.connect(config.database.uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  beforeEach(async () => {
    // Create test users
    superAdminUser = await UserModel.create({
      email: 'superadmin@example.com',
      username: 'superadmin',
      password: 'SuperAdmin123!',
      firstName: 'Super',
      lastName: 'Admin',
      roles: [UserRole.SUPER_ADMIN],
      status: UserStatus.ACTIVE,
    });

    adminUser = await UserModel.create({
      email: 'admin@example.com',
      username: 'admin',
      password: 'AdminPass123!',
      firstName: 'Admin',
      lastName: 'User',
      roles: [UserRole.ADMIN],
      status: UserStatus.ACTIVE,
    });

    regularUser = await UserModel.create({
      email: 'regular@example.com',
      username: 'regular',
      password: 'RegularPass123!',
      firstName: 'Regular',
      lastName: 'User',
      roles: [UserRole.VIEWER],
      status: UserStatus.ACTIVE,
    });

    // Generate tokens
    const superAdminTokens = await authService.generateTokens(superAdminUser);
    const adminTokens = await authService.generateTokens(adminUser);
    const regularTokens = await authService.generateTokens(regularUser);

    superAdminToken = superAdminTokens.accessToken;
    adminToken = adminTokens.accessToken;
    regularToken = regularTokens.accessToken;
  });

  afterEach(async () => {
    await UserModel.deleteMany({});
    await UserActivityModel.deleteMany({});
  });

  describe('GET /api/v1/users', () => {
    it('should list users for admin', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(3);
      expect(response.body.total).toBe(3);
    });

    it('should search users by email', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .query({ email: 'admin' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(2); // admin and superadmin
    });

    it('should filter users by role', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .query({ roles: UserRole.ADMIN })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].roles).toContain(UserRole.ADMIN);
    });

    it('should filter users by status', async () => {
      // Create inactive user
      await UserModel.create({
        email: 'inactive@example.com',
        username: 'inactive',
        password: 'InactivePass123!',
        firstName: 'Inactive',
        lastName: 'User',
        status: UserStatus.INACTIVE,
      });

      const response = await request(app)
        .get('/api/v1/users')
        .query({ status: UserStatus.INACTIVE })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].status).toBe(UserStatus.INACTIVE);
    });

    it('should search users by term', async () => {
      const response = await request(app)
        .get('/api/v1/users')
        .query({ searchTerm: 'Regular' })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].firstName).toBe('Regular');
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v1/users')
        .expect(401);
    });
  });

  describe('GET /api/v1/users/statistics', () => {
    it('should get user statistics for admin', async () => {
      const response = await request(app)
        .get('/api/v1/users/statistics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.totalUsers).toBe(3);
      expect(response.body.data.activeUsers).toBe(3);
      expect(response.body.data.inactiveUsers).toBe(0);
      expect(response.body.data.usersByRole).toBeDefined();
      expect(response.body.data.usersByRole[UserRole.SUPER_ADMIN]).toBe(1);
      expect(response.body.data.usersByRole[UserRole.ADMIN]).toBe(1);
      expect(response.body.data.usersByRole[UserRole.VIEWER]).toBe(1);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get('/api/v1/users/statistics')
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('should get user by ID for admin', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.email).toBe('regular@example.com');
      expect(response.body.data.username).toBe('regular');
      expect(response.body.data.password).toBeUndefined();
    });

    it('should allow users to view their own profile', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(200);

      expect(response.body.data.email).toBe('regular@example.com');
    });

    it('should deny regular users from viewing other profiles', async () => {
      await request(app)
        .get(`/api/v1/users/${adminUser._id}`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .get(`/api/v1/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);
    });
  });

  describe('GET /api/v1/users/:id/activity', () => {
    beforeEach(async () => {
      // Create some activity
      await UserActivityModel.create([
        {
          userId: regularUser._id,
          action: 'LOGIN',
          success: true,
          ipAddress: '127.0.0.1',
          userAgent: 'Test Agent',
          timestamp: new Date(),
        },
        {
          userId: regularUser._id,
          action: 'LOGOUT',
          success: true,
          timestamp: new Date(),
        },
      ]);
    });

    it('should get user activity for admin', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${regularUser._id}/activity`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2);
      expect(response.body.count).toBe(2);
    });

    it('should limit activity results', async () => {
      const response = await request(app)
        .get(`/api/v1/users/${regularUser._id}/activity`)
        .query({ limit: 1 })
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.length).toBe(1);
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .get(`/api/v1/users/${regularUser._id}/activity`)
        .set('Authorization', `Bearer ${regularToken}`)
        .expect(403);
    });
  });

  describe('POST /api/v1/users', () => {
    it('should create new user as admin', async () => {
      const userData = {
        email: 'newuser@example.com',
        username: 'newuser',
        password: 'NewUser123!',
        firstName: 'New',
        lastName: 'User',
        roles: [UserRole.LOAN_OFFICER],
        departments: ['Lending'],
      };

      const response = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(userData)
        .expect(201);

      expect(response.body.data.email).toBe(userData.email);
      expect(response.body.data.username).toBe(userData.username);
      expect(response.body.data.roles).toContain(UserRole.LOAN_OFFICER);
      expect(response.body.message).toBe('User created successfully');
    });

    it('should reject duplicate email', async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'regular@example.com',
          username: 'another',
          password: 'Another123!',
          firstName: 'Another',
          lastName: 'User',
        })
        .expect(409);

      expect(response.body.error.code).toBe('USER_EXISTS');
    });

    it('should validate user data', async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          email: 'invalid-email',
          username: 'u', // too short
          password: 'weak',
          firstName: 'A', // too short
          lastName: 'B', // too short
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should deny access to regular users', async () => {
      await request(app)
        .post('/api/v1/users')
        .set('Authorization', `Bearer ${regularToken}`)
        .send({
          email: 'test@example.com',
          username: 'test',
          password: 'Test123!',
          firstName: 'Test',
          lastName: 'User',
        })
        .expect(403);
    });
  });

  describe('PATCH /api/v1/users/:id', () => {
    it('should update user as admin', async () => {
      const updates = {
        firstName: 'Updated',
        lastName: 'Name',
        phoneNumber: '+1234567890',
        departments: ['Sales', 'Support'],
      };

      const response = await request(app)
        .patch(`/api/v1/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates)
        .expect(200);

      expect(response.body.data.firstName).toBe(updates.firstName);
      expect(response.body.data.lastName).toBe(updates.lastName);
      expect(response.body.data.phoneNumber).toBe(updates.phoneNumber);
      expect(response.body.data.departments).toEqual(updates.departments);
    });

    it('should validate update data', async () => {
      const response = await request(app)
        .patch(`/api/v1/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          firstName: 'A', // too short
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should require at least one field to update', async () => {
      const response = await request(app)
        .patch(`/api/v1/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .patch(`/api/v1/users/${fakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ firstName: 'Test' })
        .expect(404);
    });
  });

  describe('POST /api/v1/users/:id/roles', () => {
    it('should assign role as super admin', async () => {
      const response = await request(app)
        .post(`/api/v1/users/${regularUser._id}/roles`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: UserRole.LOAN_OFFICER })
        .expect(200);

      expect(response.body.data.roles).toContain(UserRole.LOAN_OFFICER);
      expect(response.body.data.roles).toContain(UserRole.VIEWER);
      expect(response.body.message).toBe('Role assigned successfully');
    });

    it('should not duplicate roles', async () => {
      // Assign role first time
      await request(app)
        .post(`/api/v1/users/${regularUser._id}/roles`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: UserRole.LOAN_OFFICER })
        .expect(200);

      // Assign same role again
      const response = await request(app)
        .post(`/api/v1/users/${regularUser._id}/roles`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: UserRole.LOAN_OFFICER })
        .expect(200);

      const roleCount = response.body.data.roles.filter(
        (r: string) => r === UserRole.LOAN_OFFICER
      ).length;
      expect(roleCount).toBe(1);
    });

    it('should deny access to regular admin', async () => {
      await request(app)
        .post(`/api/v1/users/${regularUser._id}/roles`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ role: UserRole.LOAN_OFFICER })
        .expect(403);
    });

    it('should validate role', async () => {
      const response = await request(app)
        .post(`/api/v1/users/${regularUser._id}/roles`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ role: 'INVALID_ROLE' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/v1/users/:id/roles/:role', () => {
    beforeEach(async () => {
      // Add multiple roles to test user
      regularUser.roles = [UserRole.VIEWER, UserRole.LOAN_OFFICER];
      await regularUser.save();
    });

    it('should remove role as super admin', async () => {
      const response = await request(app)
        .delete(`/api/v1/users/${regularUser._id}/roles/${UserRole.LOAN_OFFICER}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.roles).not.toContain(UserRole.LOAN_OFFICER);
      expect(response.body.data.roles).toContain(UserRole.VIEWER);
      expect(response.body.message).toBe('Role removed successfully');
    });

    it('should handle removing non-existent role', async () => {
      const response = await request(app)
        .delete(`/api/v1/users/${regularUser._id}/roles/${UserRole.ADMIN}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.data.roles).toEqual([UserRole.VIEWER, UserRole.LOAN_OFFICER]);
    });

    it('should deny access to regular admin', async () => {
      await request(app)
        .delete(`/api/v1/users/${regularUser._id}/roles/${UserRole.LOAN_OFFICER}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });
  });

  describe('PATCH /api/v1/users/:id/status', () => {
    it('should update user status as admin', async () => {
      const response = await request(app)
        .patch(`/api/v1/users/${regularUser._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: UserStatus.SUSPENDED,
          reason: 'Policy violation',
        })
        .expect(200);

      expect(response.body.data.status).toBe(UserStatus.SUSPENDED);
      expect(response.body.message).toBe('User status updated successfully');
    });

    it('should revoke tokens when suspending user', async () => {
      // Login as regular user to create tokens
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'regular@example.com',
          password: 'RegularPass123!',
        });

      const refreshToken = loginResponse.body.data.tokens.refreshToken;

      // Suspend user
      await request(app)
        .patch(`/api/v1/users/${regularUser._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          status: UserStatus.SUSPENDED,
          reason: 'Security concern',
        })
        .expect(200);

      // Verify refresh token is revoked
      await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('should require status field', async () => {
      const response = await request(app)
        .patch(`/api/v1/users/${regularUser._id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Test' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('should soft delete user as super admin', async () => {
      const response = await request(app)
        .delete(`/api/v1/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      expect(response.body.message).toBe('User deleted successfully');

      // Verify user is soft deleted (status changed to inactive)
      const user = await UserModel.findById(regularUser._id);
      expect(user?.status).toBe(UserStatus.INACTIVE);
      expect(user?.deactivatedAt).toBeDefined();
      expect(user?.deactivatedBy).toBe(superAdminUser._id.toString());
    });

    it('should revoke tokens when deleting user', async () => {
      // Login as regular user to create tokens
      const loginResponse = await request(app)
        .post('/api/v1/auth/login')
        .send({
          email: 'regular@example.com',
          password: 'RegularPass123!',
        });

      const refreshToken = loginResponse.body.data.tokens.refreshToken;

      // Delete user
      await request(app)
        .delete(`/api/v1/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(200);

      // Verify refresh token is revoked
      await request(app)
        .post('/api/v1/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('should deny access to regular admin', async () => {
      await request(app)
        .delete(`/api/v1/users/${regularUser._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent user', async () => {
      const fakeId = new mongoose.Types.ObjectId();
      await request(app)
        .delete(`/api/v1/users/${fakeId}`)
        .set('Authorization', `Bearer ${superAdminToken}`)
        .expect(404);
    });
  });
});