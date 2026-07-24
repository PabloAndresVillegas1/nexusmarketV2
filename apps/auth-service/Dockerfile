# --- Etapa 1: build ---
FROM node:22-alpine AS builder
WORKDIR /app

# Instalar openssl necesario para que 'npx prisma generate' funcione en Alpine
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma

# Instalar dependencias sin ejecutar scripts automáticos
RUN npm install --ignore-scripts

# Generar el cliente de Prisma explícitamente
RUN npx prisma generate

COPY . .
RUN npm run build

# --- Etapa 2: runtime (imagen liviana) ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Instalar openssl en runtime para la conexión con Postgres
RUN apk add --no-cache openssl

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated

EXPOSE 3001
CMD ["node", "dist/main"]