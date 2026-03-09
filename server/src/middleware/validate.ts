import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

/**
 * Wrapper for express-validator: runs the given validation chains,
 * then returns 422 with all validation errors as [{ field, message }]
 * if any failed. Otherwise calls next().
 */
export function validate(validations: ValidationChain[]) {
  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    await Promise.all(validations.map((v) => v.run(req)));

    const result = validationResult(req);

    if (result.isEmpty()) {
      next();
      return;
    }

    const errors = result.array().map((err) => ({
      field: typeof (err as { path?: string }).path === 'string' ? (err as { path: string }).path : 'unknown',
      message: typeof (err as { msg?: string }).msg === 'string' ? (err as { msg: string }).msg : 'Invalid value',
    }));

    res.status(422).json({
      success: false,
      error: 'Validation failed',
      errors,
    });
  };
}
