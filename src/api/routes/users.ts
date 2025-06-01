import { Router } from 'express';
import { UserRepository } from '../../repositories/user.repository';
import { validateRequest } from '../middleware/validate-request';
import { authenticate, authorize } from '../middleware/authenticate';
import { asyncHandler } from '../utils/async-handler';
import { 
  createUserSchema, 
  updateUserSchema, 
  searchUserSchema,
  assignRoleSchema 
} from '../validators/user.validator';
import { UserRole, UserStatus, PERMISSIONS } from '../../models/user.model';

const router = Router();
const userRepository = new UserRepository();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List users
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: searchTerm
 *         schema:
 *           type: string
 *         description: Search by email, username, or name
 *       - in: query
 *         name: roles
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *         description: Filter by roles
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, SUSPENDED, LOCKED]
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       403:
 *         description: Insufficient permissions
 */
router.get('/', 
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN), 
  validateRequest({ query: searchUserSchema }),
  asyncHandler(async (req, res) => {
    const users = await userRepository.search(req.query);
    
    res.json({
      data: users.map(user => ({
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
      })),
      total: users.length,
    });
  })
);

/**
 * @swagger
 * /users/statistics:
 *   get:
 *     summary: Get user statistics
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 */
router.get('/statistics',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (_req, res) => {
    const statistics = await userRepository.getStatistics();
    res.json({ data: statistics });
  })
);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User retrieved successfully
 *       404:
 *         description: User not found
 */
router.get('/:id',
  asyncHandler(async (req, res) => {
    // Users can view their own profile, admins can view any
    const userId = req.params.id;
    const isOwnProfile = userId === req.user?.id;
    const isAdmin = req.user?.roles.some(role => 
      [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(role as UserRole)
    );

    if (!isOwnProfile && !isAdmin) {
      res.status(403).json({
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
      return;
    }

    const user = await userRepository.findById(userId);
    
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    res.json({
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        roles: user.roles,
        permissions: user.permissions,
        status: user.status,
        emailVerified: user.emailVerified,
        twoFactorEnabled: user.twoFactorEnabled,
        departments: user.departments,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  })
);

/**
 * @swagger
 * /users/{id}/activity:
 *   get:
 *     summary: Get user activity log
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: Number of activities to retrieve
 *     responses:
 *       200:
 *         description: Activity log retrieved successfully
 */
router.get('/:id/activity',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR),
  asyncHandler(async (req, res) => {
    const { limit = 100 } = req.query;
    const activity = await userRepository.getUserActivity(req.params.id, Number(limit));
    
    res.json({
      data: activity,
      userId: req.params.id,
      count: activity.length,
    });
  })
);

/**
 * @swagger
 * /users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUser'
 *     responses:
 *       201:
 *         description: User created successfully
 *       409:
 *         description: User already exists
 */
router.post('/',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest({ body: createUserSchema }),
  asyncHandler(async (req, res) => {
    const userData = {
      ...req.body,
      createdBy: req.user?.id,
    };

    // Check if user exists
    const existingUser = await userRepository.findByEmail(userData.email);
    if (existingUser) {
      res.status(409).json({
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email already exists',
        },
      });
      return;
    }

    const user = await userRepository.create(userData);

    res.status(201).json({
      data: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        roles: user.roles,
        status: user.status,
      },
      message: 'User created successfully',
    });
  })
);

/**
 * @swagger
 * /users/{id}:
 *   patch:
 *     summary: Update user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUser'
 *     responses:
 *       200:
 *         description: User updated successfully
 */
router.patch('/:id',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  validateRequest({ body: updateUserSchema }),
  asyncHandler(async (req, res) => {
    const updates = {
      ...req.body,
      updatedBy: req.user?.id,
    };

    const user = await userRepository.update(req.params.id, updates);
    
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    res.json({
      data: user,
      message: 'User updated successfully',
    });
  })
);

/**
 * @swagger
 * /users/{id}/roles:
 *   post:
 *     summary: Assign role to user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [SUPER_ADMIN, ADMIN, LOAN_OFFICER, UNDERWRITER, SERVICER, COLLECTOR, AUDITOR, VIEWER, API_USER]
 *     responses:
 *       200:
 *         description: Role assigned successfully
 */
router.post('/:id/roles',
  authorize(UserRole.SUPER_ADMIN),
  validateRequest({ body: assignRoleSchema }),
  asyncHandler(async (req, res) => {
    const { role } = req.body;
    const user = await userRepository.addRole(req.params.id, role);
    
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    res.json({
      data: user,
      message: 'Role assigned successfully',
    });
  })
);

/**
 * @swagger
 * /users/{id}/roles/{role}:
 *   delete:
 *     summary: Remove role from user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: role
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role removed successfully
 */
router.delete('/:id/roles/:role',
  authorize(UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const user = await userRepository.removeRole(req.params.id, req.params.role as UserRole);
    
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    res.json({
      data: user,
      message: 'Role removed successfully',
    });
  })
);

/**
 * @swagger
 * /users/{id}/status:
 *   patch:
 *     summary: Update user status
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ACTIVE, INACTIVE, SUSPENDED, LOCKED]
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status updated successfully
 */
router.patch('/:id/status',
  authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const { status, reason } = req.body;
    const user = await userRepository.updateStatus(req.params.id, status, reason);
    
    if (!user) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    res.json({
      data: user,
      message: 'User status updated successfully',
    });
  })
);

/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete user (soft delete)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 */
router.delete('/:id',
  authorize(UserRole.SUPER_ADMIN),
  asyncHandler(async (req, res) => {
    const success = await userRepository.delete(req.params.id, req.user!.id);
    
    if (!success) {
      res.status(404).json({
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found',
        },
      });
      return;
    }

    res.json({
      message: 'User deleted successfully',
    });
  })
);

export { router as usersRouter };