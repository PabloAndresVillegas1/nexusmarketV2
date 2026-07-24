import { z } from "zod";

// --- Roles y usuarios ---
export const UserRole = z.enum(["buyer", "seller", "admin"]);
export type UserRole = z.infer<typeof UserRole>;

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(2),
  role: UserRole,
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;

// --- Productos ---
export const ProductSchema = z.object({
  id: z.string().uuid(),
  sellerId: z.string().uuid(),
  title: z.string().min(3),
  description: z.string(),
  priceCents: z.number().int().positive(),
  currency: z.string().default("USD"),
  stock: z.number().int().nonnegative(),
});
export type Product = z.infer<typeof ProductSchema>;

// --- Pedidos ---
export const OrderStatus = z.enum([
  "pending",
  "paid",
  "shipped",
  "completed",
  "cancelled",
]);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const OrderSchema = z.object({
  id: z.string().uuid(),
  buyerId: z.string().uuid(),
  items: z.array(
    z.object({
      productId: z.string().uuid(),
      quantity: z.number().int().positive(),
      unitPriceCents: z.number().int().positive(),
    })
  ),
  status: OrderStatus,
  totalCents: z.number().int().positive(),
  createdAt: z.string().datetime(),
});
export type Order = z.infer<typeof OrderSchema>;

// --- Eventos entre microservicios (para la cola de mensajes) ---
export const DomainEvent = z.enum([
  "order.created",
  "order.paid",
  "order.cancelled",
  "user.registered",
]);
export type DomainEvent = z.infer<typeof DomainEvent>;
