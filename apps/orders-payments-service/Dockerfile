# --- Etapa 1: build ---
FROM node:22-alpine AS builder
WORKDIR /app

# 1. Instalar openssl para Prisma
RUN apk add --no-cache openssl

# 2. Copiar manifest y prisma antes de instalar
COPY package*.json ./
COPY prisma ./prisma

# 3. Instalar dependencias IGNO RANDO scripts automáticos de postinstall
RUN npm install --ignore-scripts

# 4. Generar el cliente de Prisma explícitamente
RUN npx prisma generate

# 5. Copiar el resto del código y compilar NestJS
COPY . .
RUN npm run build

# --- Etapa 2: runtime (imagen liviana) ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache openssl

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/generated ./generated

EXPOSE 3003
CMD ["node", "dist/main"]