import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';

interface ValidationSchemas {
  body?: Joi.Schema;
  query?: Joi.Schema;
  params?: Joi.Schema;
}

export const validateRequest = (schemas: ValidationSchemas) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const validationErrors: string[] = [];

    // Validate body
    if (schemas.body) {
      const { error, value } = schemas.body.validate(req.body, { 
        abortEarly: false,
        stripUnknown: true,
      });
      
      if (error) {
        validationErrors.push(...error.details.map(detail => `body.${detail.path.join('.')}: ${detail.message}`));
      } else {
        req.body = value;
      }
    }

    // Validate query
    if (schemas.query) {
      const { error, value } = schemas.query.validate(req.query, { 
        abortEarly: false,
        stripUnknown: true,
      });
      
      if (error) {
        validationErrors.push(...error.details.map(detail => `query.${detail.path.join('.')}: ${detail.message}`));
      } else {
        req.query = value;
      }
    }

    // Validate params
    if (schemas.params) {
      const { error, value } = schemas.params.validate(req.params, { 
        abortEarly: false,
        stripUnknown: true,
      });
      
      if (error) {
        validationErrors.push(...error.details.map(detail => `params.${detail.path.join('.')}: ${detail.message}`));
      } else {
        req.params = value;
      }
    }

    if (validationErrors.length > 0) {
      res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: validationErrors,
        },
      });
      return;
    }

    next();
  };
};