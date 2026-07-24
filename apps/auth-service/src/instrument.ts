import * as Sentry from '@sentry/nestjs';

// Sin SENTRY_DSN, el SDK de Sentry queda inactivo (no-op) — no rompe nada
// en desarrollo local ni si decides no usar Sentry en tu propio fork.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV ?? 'development',
  // 10% de las transacciones para tracing de rendimiento. Súbelo en
  // desarrollo si quieres ver más detalle, bájalo en producción de alto
  // tráfico para no generar costos innecesarios en Sentry.
  tracesSampleRate: 0.1,
});
