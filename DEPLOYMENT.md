# Despliegue a producción

## Topología recomendada

```
                    ┌─────────────────┐
   Usuarios ──────▶ │  Vercel (web)    │
                    └────────┬─────────┘
                             │ HTTPS (server-to-server,
                             │ no pasa por el navegador)
                    ┌────────▼─────────┐
                    │ Railway: api-gateway │ ◀── único servicio con dominio público
                    └────────┬─────────┘
              ┌──────────────┼──────────────────────┐
        ┌─────▼────┐  ┌──────▼─────┐  ┌─────────────▼──────────┐
        │ auth-svc │  │ catalog-svc│  │ orders-payments-service│
        └─────┬────┘  └──────┬─────┘  └─────────────┬──────────┘
              └──────────────┴──────────────────────┘
                             │
                    ┌────────▼─────────┐
                    │ Postgres + Redis │  (managed, un solo Postgres,
                    └──────────────────┘   schemas separados por servicio)
```

**v2.0:** `order-service` y `payment-service` se fusionaron en
`orders-payments-service` — 4 servicios de backend en Railway (gateway +
3) en vez de 5, para caber cómodo en el plan gratuito.

**Por qué esta combinación:** Vercel es el lugar natural para Next.js (lo
construye la misma empresa, soporta monorepos con npm workspaces de forma
nativa). Railway es el equivalente más simple a "Docker Compose pero en la
nube" — cada servicio de este repo ya tiene su Dockerfile, así que Railway
los despliega prácticamente sin cambios, con redes privadas entre servicios
igual que hicimos en local.

> Alternativas equivalentes: Render o Fly.io en vez de Railway; AWS
> ECS/Fargate si ya trabajas con AWS. La guía de abajo es específica de
> Railway porque es la de menor fricción para un proyecto de portafolio,
> pero el patrón (Dockerfile por servicio + red privada + un solo gateway
> público) es el mismo en cualquier plataforma de contenedores.

---

## 1. Base de datos y caché

1. Crea un proyecto en [Railway](https://railway.app) (o Supabase/Neon para
   Postgres administrado si prefieres separarlo de la capa de cómputo).
2. Agrega un plugin de **PostgreSQL** — Railway te da un `DATABASE_URL` ya
   armado.
3. Agrega un plugin de **Redis** (para cuando conectes
   `notification-service` más adelante).
4. Los 4 servicios comparten esta MISMA instancia de Postgres, cada uno con
   su propio `?schema=` (igual que en local): `auth`, `catalog`, `orders`,
   `payments`.

## 2. Backend: los 4 servicios NestJS

Para cada uno de `auth-service`, `catalog-service`,
`orders-payments-service`, `api-gateway`:

1. Railway → **New Service** → **Deploy from GitHub repo** → selecciona
   este repo.
2. En **Settings → Root Directory**, apunta a `apps/<servicio>` (así
   Railway construye ese Dockerfile específico, no el monorepo completo).
3. En **Variables**, carga las del `.env.example` de ese servicio con
   valores REALES de producción (nunca los placeholders).
4. Para `auth-service`, `catalog-service`, `orders-payments-service`: usa
   el `DATABASE_URL` del paso 1, agregando el `?schema=<nombre>`
   correspondiente (`auth`, `catalog`, `orders_payments`).
5. Para que los servicios se hablen entre sí por la red privada de
   Railway (sin salir a internet), usa el nombre interno que Railway
   asigna a cada servicio en vez de una URL pública — por ejemplo
   `CATALOG_SERVICE_URL=http://catalog-service.railway.internal:3002`.
6. **Solo `api-gateway`** necesita un dominio público: en su
   **Settings → Networking**, genera un dominio (`*.up.railway.app` o uno
   propio). Los otros 3 servicios se quedan sin dominio público — ya
   quedan protegidos por estar solo en la red privada.
7. `JWT_SECRET` e `INTERNAL_API_KEY` deben ser valores nuevos, largos y
   aleatorios (`openssl rand -base64 32`) — **nunca reutilices** los
   placeholders de desarrollo, y deben coincidir exactamente entre los
   servicios que los comparten (ver `ARCHITECTURE.md`).
   `JWT_REFRESH_SECRET` solo lo necesita `auth-service`.

### Migraciones en producción

Antes del primer arranque de cada servicio, corre una vez (desde tu
máquina, apuntando el `DATABASE_URL` al de producción):
```bash
npx prisma migrate deploy --schema=apps/auth-service/prisma/schema.prisma
npx prisma migrate deploy --schema=apps/catalog-service/prisma/schema.prisma
npx prisma migrate deploy --schema=apps/orders-payments-service/prisma/schema.prisma
```
(`migrate deploy`, no `migrate dev` — este último es interactivo y no está
pensado para producción.)

## 3. Frontend: Vercel

1. [vercel.com](https://vercel.com) → **New Project** → importa este repo.
2. En **Root Directory**, selecciona `apps/web`. Vercel detecta que es un
   monorepo con `npm workspaces` automáticamente y corre el install desde
   la raíz (necesario para que `@nexusmarket/shared` se resuelva bien).
3. Variable de entorno: `GATEWAY_URL` → la URL pública del `api-gateway`
   que generaste en Railway (paso 2.6).
4. Deploy. Cada push a `main` vuelve a desplegar automáticamente.

## 4. Stripe en producción

1. En el [dashboard de Stripe](https://dashboard.stripe.com), cambia a
   modo **Live** (o crea claves de producción si usas una cuenta separada).
2. **Developers → Webhooks → Add endpoint**, con la URL:
   `https://<tu-gateway>.up.railway.app/payments/webhook`
3. Selecciona los eventos `checkout.session.completed` y
   `checkout.session.expired`.
4. Copia el `whsec_...` que te da Stripe y ponlo como
   `STRIPE_WEBHOOK_SECRET` en las variables de `orders-payments-service`
   en Railway.
5. Copia tu `sk_live_...` a `STRIPE_SECRET_KEY` del mismo servicio.

## 5. Verificación post-despliegue

Un checklist rápido después de cada deploy:

- [ ] `https://<gateway>/health` responde `200 {"status":"ok",...}`
- [ ] Cada servicio de backend arrancó sin errores de validación de env
      (revisa los logs de Railway — si algo falta, el servicio ni
      arranca, con un mensaje claro de qué variable falta)
- [ ] El frontend carga el catálogo (`GET /products` a través del gateway
      funciona)
- [ ] Un registro + login completa el flujo y setea las cookies
- [ ] Una compra de prueba con tarjeta `4242 4242 4242 4242` llega a
      "Pagado" en `/orders/:id` (confirma que el webhook de Stripe está
      bien conectado)

## 6. Extender CI a CD (opcional)

El workflow de `.github/workflows/ci.yml` valida cada push. Para
desplegar automáticamente, la forma más simple es dejar que Railway y
Vercel se conecten directo a GitHub (ambos ya redeployan solos en cada
push a `main`, sin necesidad de un job de deploy en Actions).

Si prefieres controlarlo explícitamente desde GitHub Actions, un job
adicional al final de `ci.yml` (solo en push a `main`, y solo si el resto
del pipeline pasó) se vería así:
```yaml
  deploy:
    needs: build-and-test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy a Railway
        run: npx @railway/cli up --service api-gateway
        env:
          RAILWAY_TOKEN: ${{ secrets.RAILWAY_TOKEN }}
```
Necesitas generar un `RAILWAY_TOKEN` en Railway y guardarlo en
**GitHub → Settings → Secrets and variables → Actions**. No lo incluí
activo en el workflow porque requiere ese secreto configurado por ti —
lo dejo documentado para cuando lo necesites.
