import { AnyZodObject, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

/**
 * Creates middleware that validates incoming requests against the supplied Zod schema before invoking the route handler.
 *
 * @param schema - Zod schema describing the expected request shape.
 * @returns An Express middleware function that parses the request and forwards validation errors to the client.
 */
const validate = (schema: AnyZodObject) => (req: Request, res: Response, next: NextFunction): void => {
  try {
    schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    next();
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({ errors: error.issues });
      return;
    }
    next(error);
  }
};

export default validate;
