export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Product {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  stock: number;
  isActive: boolean;
  categoryId: string | null;
  category?: Category | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductListResponse {
  items: Product[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface OrderItem {
  id: string;
  productId: string;
  quantity: number;
  unitPriceCents: number;
}

export type OrderStatus = 'pending' | 'paid' | 'shipped' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  buyerId: string;
  status: OrderStatus;
  totalCents: number;
  currency: string;
  items: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SessionUser {
  sub: string;
  email: string;
  role: 'buyer' | 'seller' | 'admin';
}
