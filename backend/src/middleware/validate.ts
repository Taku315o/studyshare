import { AnyZodObject, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

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
