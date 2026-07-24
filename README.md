# NexusMarket

Proyecto base full-stack: marketplace multi-vendedor con suscripciones.
Diseñado como plantilla de aprendizaje/portafolio que cubre microservicios,
APIs, pagos, bases de datos, CI/CD y despliegue.

Ver [`ARCHITECTURE.md`](./ARCHITECTURE.md) para el diseño completo.

## Stack
- **Frontend:** Next.js 15 + TypeScript + Tailwind CSS
- **Backend:** NestJS (API Gateway + 3 microservicios)
- **DB:** PostgreSQL (Prisma ORM) + Redis
- **Pagos:** Stripe
- **Monorepo:** npm workspaces + Turborepo

> **v2.0:** `order-service` y `payment-service` se fusionaron en
> `orders-payments-service` para caber en el límite de servicios del plan
> gratuito de Railway. Ver la sección "Estrategia de evolución" en
> [`ARCHITECTURE.md`](./ARCHITECTURE.md) para el detalle de qué cambió.

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
├── ARCHITECTURE.md
└── DEPLOYMENT.md
```

## Cómo empezar

> **Importante:** corre `npm install` siempre desde la **raíz** del monorepo,
> nunca desde dentro de una carpeta de `apps/*`. Con npm workspaces, los
> paquetes internos (como `@nexusmarket/shared`) solo se enlazan
> correctamente cuando la instalación arranca desde la raíz.

1. Copia las variables de entorno de cada servicio:
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
   (son secretos compartidos). Si solo copias los `.env.example` tal cual,
   ya coinciden por defecto.

2. Levanta primero la infraestructura (Postgres + Redis), **antes** que
   cualquier servicio de la app — así evitas errores de conexión al
   arrancar los backends antes de que la base de datos esté lista:
   ```bash
   docker compose up -d postgres redis
   ```

3. Instala las dependencias desde la raíz:
   ```bash
   npm install
   ```
   **En Windows**, el motor de Prisma es un binario nativo que se descarga
   durante el `postinstall`; si npm todavía está enlazando los symlinks de
   los workspaces al mismo tiempo, puede quedar bloqueando ese archivo y la
   instalación falla a mitad de camino. Si te pasa, instala así en su lugar:
   ```powershell
   npm install --ignore-scripts
   ```
   Esto salta la generación automática del cliente de Prisma — la corres
   manualmente en el siguiente paso.

4. Genera el cliente de Prisma de cada servicio (necesario siempre que
   usaste `--ignore-scripts`, y también la primera vez en cualquier SO):
   ```bash
   npx prisma generate --schema=apps/auth-service/prisma/schema.prisma
   npx prisma generate --schema=apps/catalog-service/prisma/schema.prisma
   npx prisma generate --schema=apps/orders-payments-service/prisma/schema.prisma
   ```

5. Aplica las migraciones (crea las tablas en Postgres):
   ```bash
   npx prisma migrate dev --schema=apps/auth-service/prisma/schema.prisma --name init
   npx prisma migrate dev --schema=apps/catalog-service/prisma/schema.prisma --name init
   npx prisma migrate dev --schema=apps/orders-payments-service/prisma/schema.prisma --name init
   ```

6. Arranca todo en modo desarrollo (vía Turborepo):
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

**El proyecto base está completo.** Ver [`DEPLOYMENT.md`](./DEPLOYMENT.md)
para la guía de despliegue a producción (Vercel + Railway).

## Seguridad y Observabilidad
Cada servicio de backend valida sus variables de entorno al arrancar
(falla rápido y claro si falta algo — ver `src/env.validation.ts` en cada
servicio), expone Helmet para headers de seguridad, un health check real
en `GET /health`, y Sentry opcional (no-op sin `SENTRY_DSN`). Detalle
completo en [`ARCHITECTURE.md`](./ARCHITECTURE.md#seguridad).

## Testing
Cada servicio de backend tiene tests unitarios con Jest, mockeando Prisma
y los clientes entre servicios (nunca se conecta a una base de datos
real). Corren en segundos y cubren la lógica de negocio más sensible:

- **`auth-service`**: registro, login, y la rotación de refresh tokens
  (incluye una prueba que verifica que la contraseña nunca se guarda en
  texto plano).
- **`catalog-service`**: ownership de productos — un vendedor no puede
  editar/borrar el producto de otro, un admin sí puede cualquiera.
- **`orders-payments-service`**:
  - *Orders*: el precio de un pedido SIEMPRE sale de `catalog-service`,
    nunca del body del request; validación de stock; reglas de
    cancelación.
  - *Payments*: ownership del pago, y que un error crudo de Stripe nunca
    se filtre al cliente; el flujo completo que dispara el webhook
    (marcar pagado — ahora una llamada directa a `OrdersService`, no HTTP
    — + descontar stock en `catalog-service`).
- **`api-gateway`**: el mapa de enrutamiento (`buildProxyRoutes`),
  incluyendo que `/orders` y `/payments` compartan siempre el mismo
  destino desde la fusión v2.0.

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

## Probar todo el stack junto (incluyendo el frontend)
```bash
docker compose up -d postgres redis
# (una vez, si no lo hiciste ya) generar clientes + migrar, ver pasos 4 y 5 arriba
docker compose up --build auth-service catalog-service orders-payments-service api-gateway web
```
Abre `http://localhost:3006` — regístrate como "Vendedor", publica un
producto, cierra sesión, regístrate como "Comprador" y cómpralo (con la
tarjeta de prueba de Stripe `4242 4242 4242 4242`, cualquier fecha futura
y cualquier CVC).

Para que el webhook de pago funcione en local necesitas exponer
`orders-payments-service` a internet con la CLI de Stripe:
```bash
stripe listen --forward-to localhost:3003/payments/webhook
```
Copia el `whsec_...` que te da ese comando a `STRIPE_WEBHOOK_SECRET` en
`apps/orders-payments-service/.env`.

## Notas de compatibilidad (Windows / monorepo)
- **`bcryptjs` en vez de `bcrypt`** en `auth-service`: `bcrypt` requiere
  compilar un binario nativo de C++ (`bcrypt_lib.node`), lo que rompe
  fácilmente al cambiar de versión de Node en Windows. `bcryptjs` es 100%
  JavaScript, misma API, sin binarios que compilar.
- **Cada servicio genera su cliente de Prisma en `apps/<servicio>/generated/client`**
  (ver el `output` en cada `schema.prisma`), en vez de la ubicación por
  defecto `node_modules/@prisma/client`. Con npm workspaces, todos los
  `node_modules` se hoistean a la raíz — si los servicios generaran su
  cliente en esa misma ubicación por defecto, se pisarían entre sí. Esta
  carpeta se regenera con `prisma generate` y no se versiona (está en
  `.gitignore`).
