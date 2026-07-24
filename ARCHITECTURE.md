# NexusMarket — Arquitectura

## Dominio
Marketplace multi-vendedor con planes de suscripción. Actores: comprador,
vendedor, admin.

## Estrategia de evolución
1. **Fase inicial (monolito modular):** todos los servicios corren en local
   vía Docker Compose, se comunican por HTTP interno. Un solo repo, fácil
   de razonar y depurar.
2. **Fase de extracción:** cuando un módulo necesita escalar o
   desplegarse de forma independiente, se separa como microservicio real.
   Así nacieron `order-service` y `payment-service` como servicios
   separados en la v1.0 de este proyecto.
3. **Fase de consolidación (v2.0, donde estamos ahora):** la separación
   entre pedidos y pagos no estaba pagando su costo operativo — dos
   procesos, dos deploys, una llamada HTTP interna con su propio secreto
   compartido, para una relación 1:1 que además necesitaba fusionarse
   igual para caber en el límite de servicios del plan gratuito de
   Railway. Se fusionaron en `orders-payments-service`. La comunicación
   entre "crear pedido" y "confirmar pago" pasó de HTTP interno a una
   llamada de método directa (ver `payments.service.ts`, inyecta
   `OrdersService` en vez de un `OrderClient` HTTP).
4. **Fase de orquestación:** cuando el tráfico lo justifique, se
   introduce Kubernetes para gestión de despliegues, autoscaling y
   service discovery — y ahí sí, si `orders-payments-service` se vuelve
   un cuello de botella, se vuelve a separar. La lección de ida y vuelta:
   el límite de un microservicio no es una decisión de una sola vez, es
   algo que se revisa con la realidad del tráfico y del equipo.

## Servicios

| Servicio                  | Responsabilidad                                          | Puerto |
|----------------------------|-----------------------------------------------------------|--------|
| `api-gateway`              | Punto de entrada único, rate limiting, enrutado            | 3000   |
| `auth-service`              | Registro, login, JWT, OAuth2, roles                        | 3001   |
| `catalog-service`           | Productos, categorías, búsqueda                            | 3002   |
| `orders-payments-service`   | Carrito, checkout, estados de pedido, Stripe, webhooks     | 3003   |
| `notification-service`      | Emails transaccionales, notificaciones in-app (pendiente)  | 3005   |
| `web`                       | Frontend Next.js                                           | 3006   |

> **v2.0:** `order-service` y `payment-service` se fusionaron en
> `orders-payments-service` para caber en el límite de servicios del plan
> gratuito de Railway (ver "Estrategia de evolución" abajo — esto es
> exactamente el movimiento inverso al de "extracción": consolidar cuando
> la separación deja de pagar su costo operativo).

## Base de datos
- **PostgreSQL**: una instancia en desarrollo, con schemas separados por
  servicio (`auth`, `catalog`, `orders_payments`). En producción, cada
  servicio puede migrar a su propia instancia (*database-per-service*).
- **Redis**: cache de sesiones + backend de colas (BullMQ) para eventos
  asíncronos entre servicios (pendiente de conectar con
  `notification-service`).

## Comunicación entre servicios
- **Síncrona:** REST interno entre `api-gateway` y cada servicio (fase 1).
- **Asíncrona:** eventos de dominio (`order.created`, `order.paid`, etc.)
  publicados en una cola Redis/BullMQ, consumidos por `notification-service`
  y otros interesados (fase 2, al extraer microservicios).

## Contratos compartidos
El paquete `packages/shared` centraliza los tipos y schemas de validación
(Zod) usados tanto en frontend como en backend, evitando duplicación y
garantizando que un cambio de contrato se detecte en tiempo de compilación
en todo el monorepo.

## Flujo de pago completo
1. El comprador tiene un pedido en estado `pending` (creado por
   `orders-payments-service`).
2. Llama a `POST /payments/checkout-session` en `orders-payments-service`
   con su JWT.
3. El servicio valida ownership del pedido (llamada directa a
   `OrdersService`, sin red — viven en el mismo proceso), crea una Stripe
   Checkout Session y guarda un registro `Payment` en estado `pending`.
   Devuelve la URL de Stripe al frontend para redirigir al usuario.
4. El usuario paga en Stripe. Stripe llama a `POST /payments/webhook` con
   el evento `checkout.session.completed`, firmado con HMAC.
5. `orders-payments-service` verifica la firma, marca el `Payment` como
   `succeeded`, y en cascada: marca el pedido como `paid` (llamada de
   método directa a `OrdersService.markPaid()`) y llama a `catalog-service`
   (endpoint interno, ese sí sigue siendo un servicio externo real) para
   descontar el stock.

## Endpoints internos (servicio-a-servicio)
Nunca se exponen al frontend ni al `api-gateway` público. Se protegen con
un header `x-internal-api-key` (secreto compartido solo entre backends):

| Servicio          | Endpoint interno                                | Quién lo llama            |
|--------------------|-------------------------------------------------|----------------------------|
| `catalog-service`  | `PATCH /internal/products/:id/decrement-stock`  | `orders-payments-service`  |

> Antes de la v2.0 también existía `GET /internal/orders/:id` y
> `PATCH /internal/orders/:id/mark-paid` en `order-service`, llamados por
> `payment-service`. Al fusionarse en un solo proceso, esa comunicación
> se volvió una llamada de método directa (`OrdersService.findOneRaw()` /
> `OrdersService.markPaid()`) — ya no hay HTTP, ni secreto compartido, ni
> posibilidad de que "el otro servicio esté caído" entre esos dos pasos.

En producción, el endpoint que sí sigue siendo interno evoluciona hacia
mTLS o un service mesh (Istio, Linkerd); el secreto compartido es la
versión de aprendizaje del mismo concepto: separar el tráfico de usuarios
finales del tráfico interno.

## Seguridad
- JWT de corta duración + refresh tokens con rotación.
- Rate limiting en el `api-gateway` (`express-rate-limit`, aplicado antes
  del proxy — protege a todos los servicios de detrás de una sola vez).
- **Helmet** en los 4 servicios NestJS (`auth-service`, `catalog-service`,
  `orders-payments-service`, `api-gateway`): headers de seguridad estándar
  (`X-Frame-Options`, `X-Content-Type-Options`, HSTS, etc).
- **CORS restringible** en el `api-gateway` vía `CORS_ORIGIN` (nota: casi
  irrelevante para el flujo normal de la app, ya que el frontend nunca
  llama al gateway desde el navegador — solo desde los Route Handlers de
  Next.js, que son llamadas servidor-a-servidor y no pasan por CORS. Sirve
  como defensa en profundidad si en el futuro otro cliente consume esta
  API directamente desde un navegador).
- **Validación de variables de entorno al arrancar** (Joi, vía
  `ConfigModule.validationSchema` en cada servicio): si falta una variable
  requerida — o tiene un formato inválido, como una clave de Stripe que
  sigue siendo el placeholder — el servicio falla inmediatamente al
  arrancar con un mensaje claro, en vez de fallar de forma confusa varios
  pasos después.
- Stripe maneja los datos de tarjeta directamente (PCI compliance) — el
  backend nunca almacena números de tarjeta.
- Los errores de proveedores externos (ej. Stripe) nunca se devuelven tal
  cual al cliente — se traducen a un mensaje seguro y se loguean completos
  del lado del servidor (ver `payments.service.ts`).
- Variables sensibles solo en `.env` (nunca commiteadas — ver
  `.gitignore`).

## Observabilidad
- **Health checks reales** en los 4 servicios (`GET /health`): los 3
  backends con base de datos (`auth`, `catalog`, `orders-payments`)
  verifican conectividad real (`SELECT 1`), no solo que el proceso esté
  vivo — la distinción que le importa a un orquestador (Railway,
  Kubernetes, etc) para decidir si un servicio está listo para recibir
  tráfico.
- **Sentry** (`@sentry/nestjs`) integrado en los 4 servicios NestJS, vía
  un archivo `instrument.ts` que se importa primero que cualquier otro
  módulo. Sin `SENTRY_DSN` configurado, el SDK queda en modo no-op — no
  rompe nada si no lo usas. Con un DSN real, captura excepciones no
  manejadas automáticamente (`SentryGlobalFilter`) y hace tracing de
  performance (`tracesSampleRate: 0.1`).
- El logger nativo de NestJS (`Logger`) ya se usa en puntos clave con
  contexto (ej. `payments.service.ts` loguea el error completo de Stripe
  del lado del servidor antes de devolver un mensaje seguro al cliente).
  Un siguiente paso natural es reemplazarlo por un logger estructurado
  (ej. `nestjs-pino`) que emita JSON en vez de texto plano, para que una
  plataforma de logs (Datadog, Better Stack) lo pueda indexar y filtrar.
