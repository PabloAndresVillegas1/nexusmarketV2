import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3003),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  JWT_SECRET: Joi.string().min(16).required(),
  // Sigue haciendo falta: este servicio TODAVÍA llama a catalog-service
  // (para validar stock/precio y para descontar stock tras un pago), así
  // que ese límite de servicio real se mantiene.
  INTERNAL_API_KEY: Joi.string().min(16).required(),
  CATALOG_SERVICE_URL: Joi.string().uri().required(),

  STRIPE_SECRET_KEY: Joi.string()
    .pattern(/^sk_(test|live)_[A-Za-z0-9]{10,}$/)
    .required()
    .messages({
      'string.pattern.base':
        'STRIPE_SECRET_KEY no tiene el formato de una clave real de Stripe (sk_test_... o sk_live_...). ¿Sigue siendo el placeholder del .env.example?',
    }),
  STRIPE_WEBHOOK_SECRET: Joi.string()
    .pattern(/^whsec_[A-Za-z0-9]{10,}$/)
    .required()
    .messages({
      'string.pattern.base':
        'STRIPE_WEBHOOK_SECRET no tiene el formato esperado (whsec_...). Lo obtienes con `stripe listen` en local, o desde el dashboard de Stripe en producción.',
    }),

  CHECKOUT_SUCCESS_URL: Joi.string().uri().optional(),
  CHECKOUT_CANCEL_URL: Joi.string().uri().optional(),
  SENTRY_DSN: Joi.string().uri().allow('').optional(),
});
