import * as Joi from 'joi';

// Esto es exactamente lo que nos hubiera ahorrado horas de debugging con
// el JWT_SECRET desincronizado entre servicios: si falta o está vacía
// una variable requerida, el servicio ni siquiera arranca, y el mensaje
// de error dice cuál falta — en vez de fallar en producción con un 401
// confuso tres pasos después.
export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3001),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  SENTRY_DSN: Joi.string().uri().allow('').optional(),
});
