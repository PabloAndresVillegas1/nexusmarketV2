# NexusMarket

Proyecto base full-stack: marketplace multi-vendedor con suscripciones.
cubre microservicios,APIs, pagos, bases de datos, CI/CD y despliegue.

## Stack
- **Frontend:** Next.js 15 + TypeScript + Tailwind CSS
- **Backend:** NestJS (API Gateway + 3 microservicios)
- **DB:** PostgreSQL (Prisma ORM) + Redis
- **Pagos:** Stripe
- **Monorepo:** npm workspaces + Turborepo

> **v2.0:** `order-service` y `payment-service` se fusionaron en
> `orders-payments-service` 

## Estructura
```
nexusmarket/
├── apps/
│   ├── web/                      # Frontend Next.js
│   ├── api-gateway/              # Punto de entrada único
│   ├── auth-service/             # Auth, JWT, OAuth2
│   ├── catalog-service/          # Productos y categorías
│   ├── orders-payments-service/  # Pedidos + Stripe (fusionados en v2.0)
│   └── notification-service/     # Emails y notificaciones (pendiente)
├── packages/
│   └── shared/                    # Tipos y schemas compartidos (Zod)
├── docker-compose.yml
```

## Cómo inicialización

> **Correr `npm install` 

1. Copiar las variables de entorno de cada servicio:
   ```bash
   # Bash (Linux/macOS)
   for d in apps/*/; do cp "${d}.env.example" "${d}.env" 2>/dev/null; done
   ```
   ```powershell
   # PowerShell (Windows)
   Get-ChildItem apps -Directory | ForEach-Object {
     Copy-Item "$($_.FullName)\.env.example" "$($_.FullName)\.env" -ErrorAction SilentlyContinue
   }
   ```
   `JWT_SECRET` e `INTERNAL_API_KEY` deben tener el **mismo valor** en
   `auth-service`, `catalog-service` y `orders-payments-service`
   (son secretos compartidos).

2. Levantar primero la infraestructura (Postgres + Redis), 
   ```bash
   docker compose up -d postgres redis
   ```

3. Instalar las dependencias desde la raíz:
   ```bash
   npm install
   ```
   
   ```powershell
   npm install --ignore-scripts
   ```
   
4. Generar el cliente de Prisma de cada servicio 
   ```bash
   npx prisma generate --schema=apps/auth-service/prisma/schema.prisma
   npx prisma generate --schema=apps/catalog-service/prisma/schema.prisma
   npx prisma generate --schema=apps/orders-payments-service/prisma/schema.prisma
   ```

5. Aplicar las migraciones (crea las tablas en Postgres):
   ```bash
   npx prisma migrate dev --schema=apps/auth-service/prisma/schema.prisma --name init
   npx prisma migrate dev --schema=apps/catalog-service/prisma/schema.prisma --name init
   npx prisma migrate dev --schema=apps/orders-payments-service/prisma/schema.prisma --name init
   ```

6. Arrancar todo en modo desarrollo (vía Turborepo):
   ```bash
   npm run dev
   ```

## Roadmap del proyecto
- [x] Fase 1: Definición de dominio y arquitectura
- [x] Fase 2: Monorepo y entorno base
- [x] Fase 3a: `auth-service` (registro, login, JWT, refresh tokens)
- [x] Fase 3b: `catalog-service` (productos, categorías, ownership por rol)
- [x] Fase 3c: `order-service` (checkout, precios server-side, comunicación entre servicios)
- [x] Fase 3d: `payment-service` (Stripe, webhooks, endpoints internos servicio-a-servicio)
- [x] Fase 4: `api-gateway` (punto de entrada único, rate limiting, proxy)
- [x] Fase 5: Frontend Next.js (catálogo, auth con cookies httpOnly, checkout con Stripe)
- [x] Fase 6: Testing (Jest, 34 tests) + CI/CD (GitHub Actions)
- [x] Fase 7: Seguridad (Helmet, validación de env, CORS) + Observabilidad (Sentry, health checks) + Despliegue
- [x] v2.0: `order-service` + `payment-service` → `orders-payments-service` (límite de Railway free tier)


## Testing
```bash
npm run test              # todos los servicios, vía Turborepo
npm run test --workspace=apps/auth-service   # solo uno
```

## CI/CD
`.github/workflows/ci.yml` corre en cada push/PR a `main`: instala desde
la raíz, genera los 3 clientes de Prisma, y corre `lint`, `test`, `build`
y un smoke test que arranca cada servicio de verdad (`/health`) — todo
vía Turborepo. Usa valores dummy con el formato correcto para las
variables de entorno (JWT, Stripe) — los tests unitarios no se conectan a
nada externo, pero el smoke test sí levanta un Postgres real en el CI.

## Probarr todo el stack junto (incluyendo el frontend)
```bash
docker compose up -d postgres redis
# (una vez) generar clientes + migrar, ver pasos 4 y 5 arriba
docker compose up --build auth-service catalog-service orders-payments-service api-gateway web
```
Abrir `http://localhost:3006` — registrarse como "Vendedor", publicar un
producto, cerrar sesión, registrarse como "Comprador" y comprarlo (con la
tarjeta de prueba de Stripe `4242 4242 4242 4242`, cualquier fecha futura
y cualquier CVC).

Para que el webhook de pago funcione en local se necesita exponer
`orders-payments-service` a internet con la CLI de Stripe:
```bash
stripe listen --forward-to localhost:3003/payments/webhook
```
Copia el `whsec_...` que da ese comando a `STRIPE_WEBHOOK_SECRET` en
`apps/orders-payments-service/.env`.