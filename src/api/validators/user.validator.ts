import Joi from 'joi';
import { UserRole, UserStatus } from '../../models/user.model';

export const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  username: Joi.string().alphanum().min(3).max(30).required(),
  password: Joi.string().min(8).required()
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
  firstName: Joi.string().min(2).max(50).required(),
  lastName: Joi.string().min(2).max(50).required(),
  phoneNumber: Joi.string().pattern(/^\+?[\d\s-()]+$/).optional(),
  roles: Joi.array().items(
    Joi.string().valid(...Object.values(UserRole))
  ).default([UserRole.VIEWER]),
  status: Joi.string().valid(...Object.values(UserStatus)).default(UserStatus.ACTIVE),
  departments: Joi.array().items(Joi.string()).optional(),
  allowedLoanTypes: Joi.array().items(Joi.string()).optional(),
  maxLoanAmount: Joi.number().positive().optional(),
});

export const updateUserSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).optional(),
  lastName: Joi.string().min(2).max(50).optional(),
  phoneNumber: Joi.string().pattern(/^\+?[\d\s-()]+$/).optional(),
  departments: Joi.array().items(Joi.string()).optional(),
  allowedLoanTypes: Joi.array().items(Joi.string()).optional(),
  maxLoanAmount: Joi.number().positive().optional(),
  twoFactorEnabled: Joi.boolean().optional(),
}).min(1);

export const searchUserSchema = Joi.object({
  email: Joi.string().optional(),
  username: Joi.string().optional(),
  roles: Joi.alternatives().try(
    Joi.string().valid(...Object.values(UserRole)),
    Joi.array().items(Joi.string().valid(...Object.values(UserRole)))
  ).optional(),
  status: Joi.string().valid(...Object.values(UserStatus)).optional(),
  department: Joi.string().optional(),
  searchTerm: Joi.string().optional(),
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(20),
});

export const assignRoleSchema = Joi.object({
  role: Joi.string().valid(...Object.values(UserRole)).required(),
});

export const updateStatusSchema = Joi.object({
  status: Joi.string().valid(...Object.values(UserStatus)).required(),
  reason: Joi.string().optional(),
});