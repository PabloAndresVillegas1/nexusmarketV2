import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3002),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  // Debe coincidir EXACTAMENTE con el de auth-service: es lo que permite
  // a este servicio verificar tokens emitidos por otro, sin llamarlo.
  JWT_SECRET: Joi.string().min(16).required(),
  // Secreto compartido para las rutas /internal/* (llamadas servicio-a-servicio)
  INTERNAL_API_KEY: Joi.string().min(16).required(),
  SENTRY_DSN: Joi.string().uri().allow('').optional(),
});
