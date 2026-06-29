export type UserRole = "admin" | "sales" | "warehouse" | "accountant";

export type CustomerType = "retail" | "b2b";

export type OrderStatus = "pending" | "confirmed" | "in_progress" | "ready" | "delivered" | "cancelled";

export type InvoiceStatus = "draft" | "sent" | "partially_paid" | "paid" | "overdue" | "void";

export type PaymentMethod = "cash" | "card" | "bank_transfer";

export type SaleChannel = "walk_in" | "phone" | "whatsapp" | "b2b";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url?: string;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id?: string;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  notes?: string;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  category_id?: string;
  category?: Category;
  supplier_id?: string;
  supplier?: Supplier;
  brand?: string;
  unit_price: number;
  stock_qty: number;
  low_stock_threshold: number;
  is_custom_order: boolean;
  images: string[];
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  type: CustomerType;
  name: string;
  company_name?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  notes?: string;
  tags: string[];
  created_at: string;
}

export interface CartItem {
  product: Product;
  qty: number;
  unit_price: number;
  discount_pct: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id?: string;
  customer?: Customer;
  channel: SaleChannel;
  status: OrderStatus;
  items: OrderItem[];
  notes?: string;
  expected_delivery?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product?: Product;
  qty: number;
  unit_price: number;
  discount_pct: number;
  is_custom_order: boolean;
  supplier_id?: string;
  expected_arrival?: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id?: string;
  customer_id: string;
  customer?: Customer;
  status: InvoiceStatus;
  items: InvoiceItem[];
  subtotal: number;
  discount_total: number;
  tax_rate: number;
  tax_total: number;
  total: number;
  amount_paid: number;
  due_date?: string;
  notes?: string;
  created_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  product_id?: string;
  product?: Product;
  description: string;
  qty: number;
  unit_price: number;
  discount_pct: number;
  line_total: number;
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  method: PaymentMethod;
  reference?: string;
  paid_at: string;
  recorded_by: string;
}

export interface StockAdjustment {
  id: string;
  product_id: string;
  product?: Product;
  qty_change: number;
  reason: string;
  adjusted_by: string;
  adjusted_at: string;
}
