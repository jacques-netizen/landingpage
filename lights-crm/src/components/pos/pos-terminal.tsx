"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/utils";
import { Search, Plus, Minus, Trash2, ShoppingCart, CheckCircle2, Printer, User, X, UserPlus } from "lucide-react";
import { CartItem, PaymentMethod, SaleChannel, CustomerType } from "@/types";

interface Product {
  id: string;
  sku: string;
  name: string;
  unit_price: number;
  stock_qty: number;
  is_custom_order: boolean;
  categories?: { name: string } | null;
}

interface POSCustomer {
  id: string;
  name: string;
  company_name?: string | null;
  type: CustomerType;
  phone?: string | null;
}

interface POSTerminalProps {
  products: Product[];
  customers: POSCustomer[];
  userId: string;
}

const TAX_RATE = 12.5;

export function POSTerminal({ products, customers, userId }: POSTerminalProps) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [channel, setChannel] = useState<SaleChannel>("walk_in");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [amountTendered, setAmountTendered] = useState("");
  const [customerList, setCustomerList] = useState<POSCustomer[]>(customers);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customer, setCustomer] = useState<POSCustomer | null>(null);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<{ orderNumber: string; invoiceNumber: string; invoiceId: string; customerName: string } | null>(null);

  const customerId = customer?.id ?? null;

  const customerMatches = useMemo(() => {
    const q = customerSearch.toLowerCase().trim();
    if (!q) return customerList.slice(0, 8);
    return customerList
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.company_name ?? "").toLowerCase().includes(q) ||
          (c.phone ?? "").toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [customerList, customerSearch]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return !q ? products : products.filter(
      (p) => p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)
    );
  }, [products, search]);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.product.id === product.id);
      if (existing) {
        return prev.map((i) =>
          i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i
        );
      }
      return [...prev, { product: product as any, qty: 1, unit_price: product.unit_price, discount_pct: 0 }];
    });
  }

  function updateQty(productId: string, qty: number) {
    if (qty <= 0) {
      setCart((prev) => prev.filter((i) => i.product.id !== productId));
    } else {
      setCart((prev) => prev.map((i) => i.product.id === productId ? { ...i, qty } : i));
    }
  }

  function updateDiscount(productId: string, pct: number) {
    setCart((prev) => prev.map((i) => i.product.id === productId ? { ...i, discount_pct: Math.min(100, Math.max(0, pct)) } : i));
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((i) => i.product.id !== productId));
  }

  const subtotal = cart.reduce((s, i) => s + i.unit_price * i.qty, 0);
  const discountTotal = cart.reduce((s, i) => s + i.unit_price * i.qty * (i.discount_pct / 100), 0);
  const taxable = subtotal - discountTotal;
  const taxTotal = taxable * (TAX_RATE / 100);
  const total = taxable + taxTotal;
  const change = parseFloat(amountTendered || "0") - total;

  async function completeSale() {
    if (!cart.length) return;
    setProcessing(true);
    setError("");

    const supabase = createClient();

    try {
      // Resolve the customer for this sale (selected, or fall back to a shared Walk-in record)
      const saleCustomerId = customerId ?? (await ensureWalkInCustomer(supabase));
      const saleCustomerName = customer
        ? customer.company_name || customer.name
        : "Walk-in Customer";

      // Create order — flag stock_deducted so a later cancellation knows to restock
      const { data: order, error: orderErr } = await supabase
        .from("orders")
        .insert({ customer_id: saleCustomerId, channel, status: "delivered", created_by: userId, stock_deducted: true })
        .select("id, order_number")
        .single();
      if (orderErr) throw orderErr;

      // Order items
      const { error: itemsErr } = await supabase.from("order_items").insert(
        cart.map((i) => ({
          order_id: order.id,
          product_id: i.product.id,
          qty: i.qty,
          unit_price: i.unit_price,
          discount_pct: i.discount_pct,
          is_custom_order: false,
        }))
      );
      if (itemsErr) throw itemsErr;

      // Create invoice
      const { data: invoice, error: invErr } = await supabase
        .from("invoices")
        .insert({
          order_id: order.id,
          customer_id: saleCustomerId,
          status: "paid",
          subtotal,
          discount_total: discountTotal,
          tax_rate: TAX_RATE,
          tax_total: taxTotal,
          total,
          amount_paid: total,
        })
        .select("id, invoice_number")
        .single();
      if (invErr) throw invErr;

      // Invoice items
      await supabase.from("invoice_items").insert(
        cart.map((i) => ({
          invoice_id: invoice.id,
          product_id: i.product.id,
          description: i.product.name,
          qty: i.qty,
          unit_price: i.unit_price,
          discount_pct: i.discount_pct,
          line_total: i.unit_price * i.qty * (1 - i.discount_pct / 100),
        }))
      );

      // Payment record
      await supabase.from("payments").insert({
        invoice_id: invoice.id,
        amount: total,
        method: paymentMethod,
        recorded_by: userId,
      });

      // Reduce stock + log a stock adjustment per item so the ledger balances with cancellations
      for (const item of cart) {
        await supabase.from("products").update({
          stock_qty: item.product.stock_qty - item.qty,
        }).eq("id", item.product.id);
        await supabase.from("stock_adjustments").insert({
          product_id: item.product.id,
          qty_change: -item.qty,
          reason: `Sale ${order.order_number} (${invoice.invoice_number})`,
          adjusted_by: userId,
        });
      }

      setReceipt({
        orderNumber: order.order_number,
        invoiceNumber: invoice.invoice_number,
        invoiceId: invoice.id,
        customerName: saleCustomerName,
      });
    } catch (err: any) {
      setError(err.message ?? "Something went wrong.");
      setProcessing(false);
    }
  }

  async function ensureWalkInCustomer(supabase: any) {
    const { data } = await supabase.from("customers").select("id").eq("name", "Walk-in Customer").maybeSingle();
    if (data) return data.id;
    const { data: created } = await supabase.from("customers").insert({ name: "Walk-in Customer", type: "retail" }).select("id").single();
    return created.id;
  }

  async function createCustomer(form: { type: CustomerType; name: string; phone: string; whatsapp: string; email: string }) {
    const supabase = createClient();
    const { data, error: createErr } = await supabase
      .from("customers")
      .insert({
        type: form.type,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        email: form.email.trim() || null,
      })
      .select("id, name, company_name, type, phone")
      .single();
    if (createErr) throw createErr;
    setCustomerList((prev) => [data as POSCustomer, ...prev]);
    setCustomer(data as POSCustomer);
    setNewCustomerOpen(false);
  }

  function resetTerminal() {
    setCart([]);
    setSearch("");
    setChannel("walk_in");
    setPaymentMethod("cash");
    setAmountTendered("");
    setCustomer(null);
    setCustomerSearch("");
    setCustomerOpen(false);
    setReceipt(null);
    setProcessing(false);
    setError("");
    router.refresh();
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] gap-0 -m-6">
      {/* Left: Product Grid */}
      <div className="flex flex-col flex-1 overflow-hidden border-r">
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or SKU…"
              className="pl-9"
              autoFocus
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map((product) => {
              const inCart = cart.find((i) => i.product.id === product.id);
              const outOfStock = product.stock_qty <= 0 && !product.is_custom_order;
              return (
                <button
                  key={product.id}
                  onClick={() => !outOfStock && addToCart(product)}
                  disabled={outOfStock}
                  className={`text-left rounded-xl border p-3 transition-all ${
                    outOfStock
                      ? "opacity-40 cursor-not-allowed"
                      : inCart
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "hover:border-primary/50 hover:shadow-sm bg-card"
                  }`}
                >
                  <div className="flex items-start justify-between gap-1 mb-1">
                    <span className="text-sm font-medium leading-snug line-clamp-2">{product.name}</span>
                    {inCart && (
                      <Badge variant="default" className="shrink-0 text-xs">{inCart.qty}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">{(product.categories as any)?.name}</div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm">{formatCurrency(product.unit_price)}</span>
                    <span className="text-xs text-muted-foreground">
                      {product.is_custom_order ? "Custom" : `${product.stock_qty} in stock`}
                    </span>
                  </div>
                </button>
              );
            })}
            {!filtered.length && (
              <p className="col-span-3 text-center py-12 text-muted-foreground text-sm">No products found.</p>
            )}
          </div>
        </div>
      </div>

      {/* Right: Cart */}
      <div className="w-[380px] flex flex-col bg-card">
        <div className="flex items-center gap-2 p-4 border-b">
          <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold">Cart</span>
          {cart.length > 0 && <Badge variant="secondary">{cart.reduce((s, i) => s + i.qty, 0)} items</Badge>}
        </div>

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {!cart.length && (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground text-sm gap-2">
              <ShoppingCart className="h-8 w-8 opacity-30" />
              <span>Tap a product to add it</span>
            </div>
          )}
          {cart.map((item) => (
            <div key={item.product.id} className="rounded-lg border bg-background p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium leading-snug">{item.product.name}</span>
                <button onClick={() => removeFromCart(item.product.id)} className="text-muted-foreground hover:text-destructive mt-0.5 shrink-0">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <button onClick={() => updateQty(item.product.id, item.qty - 1)} className="h-6 w-6 rounded border flex items-center justify-center hover:bg-accent">
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{item.qty}</span>
                  <button onClick={() => updateQty(item.product.id, item.qty + 1)} className="h-6 w-6 rounded border flex items-center justify-center hover:bg-accent">
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <div className="flex items-center gap-1 ml-auto">
                  <span className="text-xs text-muted-foreground">Disc:</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={item.discount_pct}
                    onChange={(e) => updateDiscount(item.product.id, parseFloat(e.target.value) || 0)}
                    className="h-6 w-14 text-xs px-1"
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{formatCurrency(item.unit_price)} × {item.qty}</span>
                <span className="font-medium">
                  {formatCurrency(item.unit_price * item.qty * (1 - item.discount_pct / 100))}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="border-t p-3 space-y-3">
          {/* Customer */}
          <div className="relative">
            {customer ? (
              <div className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2">
                <User className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{customer.company_name || customer.name}</div>
                  <div className="truncate text-xs text-muted-foreground">
                    {customer.type === "b2b" ? "B2B" : "Retail"}
                    {customer.phone ? ` · ${customer.phone}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => { setCustomer(null); setCustomerSearch(""); }}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  aria-label="Remove customer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={customerSearch}
                    onChange={(e) => { setCustomerSearch(e.target.value); setCustomerOpen(true); }}
                    onFocus={() => setCustomerOpen(true)}
                    placeholder="Walk-in — search customer…"
                    className="h-9 pl-9 text-sm"
                  />
                </div>
                {customerOpen && (
                  <div className="absolute bottom-full z-20 mb-1 w-full overflow-hidden rounded-lg border bg-card shadow-lg">
                    <div className="max-h-52 overflow-y-auto">
                      {customerMatches.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => { setCustomer(c); setCustomerOpen(false); setCustomerSearch(""); }}
                          className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-accent"
                        >
                          <span className="text-sm font-medium">{c.company_name || c.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {c.type === "b2b" ? "B2B" : "Retail"}{c.phone ? ` · ${c.phone}` : ""}
                          </span>
                        </button>
                      ))}
                      {!customerMatches.length && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">No matches.</p>
                      )}
                    </div>
                    <button
                      onClick={() => { setNewCustomerOpen(true); setCustomerOpen(false); }}
                      className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm font-medium text-primary hover:bg-accent"
                    >
                      <UserPlus className="h-4 w-4" /> New customer
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Channel */}
          <Select value={channel} onValueChange={(v) => setChannel(v as SaleChannel)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="walk_in">Walk-in</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="b2b">B2B</SelectItem>
            </SelectContent>
          </Select>

          {/* Totals */}
          {cart.length > 0 && (
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span><span>{formatCurrency(subtotal)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Discount</span><span className="text-red-500">-{formatCurrency(discountTotal)}</span>
                </div>
              )}
              <div className="flex justify-between text-muted-foreground">
                <span>VAT {TAX_RATE}%</span><span>{formatCurrency(taxTotal)}</span>
              </div>
              <Separator />
              <div className="flex justify-between font-semibold">
                <span>Total</span><span>{formatCurrency(total)}</span>
              </div>
            </div>
          )}

          {/* Payment method */}
          <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
            </SelectContent>
          </Select>

          {paymentMethod === "cash" && (
            <div className="space-y-1">
              <Input
                type="number"
                placeholder="Amount tendered…"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                className="h-8 text-sm"
              />
              {change >= 0 && amountTendered && (
                <p className="text-xs text-green-600 font-medium">Change: {formatCurrency(change)}</p>
              )}
            </div>
          )}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button
            className="w-full"
            disabled={!cart.length || processing}
            onClick={completeSale}
          >
            {processing ? "Processing…" : `Complete Sale · ${formatCurrency(total)}`}
          </Button>
        </div>
      </div>

      {/* Receipt Modal */}
      <Dialog open={!!receipt} onOpenChange={(open) => !open && resetTerminal()}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <div className="flex justify-center mb-2">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <DialogTitle>Sale Complete!</DialogTitle>
          </DialogHeader>
          {receipt && (
            <div className="space-y-3 text-sm">
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Customer</span>
                  <span className="font-medium">{receipt.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order</span>
                  <span className="font-mono font-medium">{receipt.orderNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Invoice</span>
                  <span className="font-mono font-medium">{receipt.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-semibold">{formatCurrency(total)}</span>
                </div>
                {paymentMethod === "cash" && change >= 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Change</span>
                    <span className="font-semibold">{formatCurrency(change)}</span>
                  </div>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <Button variant="outline" className="w-full" asChild>
                  <a href={`/invoices/${receipt.invoiceId}`} target="_blank" rel="noopener noreferrer">
                    <Printer className="h-4 w-4" />
                    View / Download Invoice
                  </a>
                </Button>
                <Button className="w-full" onClick={resetTerminal}>New Sale</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* New customer dialog */}
      <NewCustomerDialog
        open={newCustomerOpen}
        onOpenChange={setNewCustomerOpen}
        onSubmit={createCustomer}
      />
    </div>
  );
}

function NewCustomerDialog({
  open,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (form: { type: CustomerType; name: string; phone: string; whatsapp: string; email: string }) => Promise<void>;
}) {
  const [type, setType] = useState<CustomerType>("retail");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function handleSave() {
    if (!name.trim()) { setErr("Name is required."); return; }
    setSaving(true);
    setErr("");
    try {
      await onSubmit({ type, name, phone, whatsapp, email });
      setType("retail"); setName(""); setPhone(""); setWhatsapp(""); setEmail("");
    } catch (e: any) {
      setErr(e.message ?? "Could not create customer.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as CustomerType)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="retail">Retail</SelectItem>
                <SelectItem value="b2b">B2B / Trade</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-name">Name {type === "b2b" ? "/ Company" : ""}</Label>
            <Input id="nc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Customer name" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="nc-phone">Phone</Label>
              <Input id="nc-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="nc-wa">WhatsApp</Label>
              <Input id="nc-wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-email">Email</Label>
            <Input id="nc-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email (optional)" />
          </div>
          {err && <p className="text-xs text-destructive">{err}</p>}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Add customer"}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
