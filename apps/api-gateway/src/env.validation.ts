import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  AUTH_SERVICE_URL: Joi.string().uri().required(),
  CATALOG_SERVICE_URL: Joi.string().uri().required(),
  ORDERS_PAYMENTS_SERVICE_URL: Joi.string().uri().required(),
  RATE_LIMIT_WINDOW_MS: Joi.number().default(60000),
  RATE_LIMIT_MAX: Joi.number().default(100),
  // '*' en desarrollo; en producción, lista separada por comas de los
  // orígenes que sí pueden llamar al gateway directamente desde el
  // navegador (no confundir con las llamadas server-to-server desde
  // Next.js, que nunca pasan por CORS).
  CORS_ORIGIN: Joi.string().default('*'),
  SENTRY_DSN: Joi.string().uri().allow('').optional(),
});
