"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomerType } from "@/types";

interface CustomerFormProps {
  customer?: {
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
  };
}

export function CustomerForm({ customer }: CustomerFormProps) {
  const router = useRouter();
  const isEditing = !!customer;

  const [type, setType] = useState<CustomerType>(customer?.type ?? "retail");
  const [form, setForm] = useState({
    name: customer?.name ?? "",
    company_name: customer?.company_name ?? "",
    phone: customer?.phone ?? "",
    whatsapp: customer?.whatsapp ?? "",
    email: customer?.email ?? "",
    address: customer?.address ?? "",
    notes: customer?.notes ?? "",
    tags: customer?.tags?.join(", ") ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(field: string, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    const supabase = createClient();
    const payload = {
      type,
      name: form.name,
      company_name: type === "b2b" ? form.company_name || null : null,
      phone: form.phone || null,
      whatsapp: form.whatsapp || null,
      email: form.email || null,
      address: form.address || null,
      notes: form.notes || null,
      tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
    };

    const { error: err } = isEditing
      ? await supabase.from("customers").update(payload).eq("id", customer!.id)
      : await supabase.from("customers").insert(payload);

    if (err) {
      setError(err.message);
      setSaving(false);
    } else {
      router.push(isEditing ? `/customers/${customer!.id}` : "/customers");
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
      {/* Type toggle */}
      <div className="space-y-1.5">
        <Label>Customer Type</Label>
        <div className="flex gap-2">
          {(["retail", "b2b"] as CustomerType[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                type === t ? "bg-primary text-primary-foreground border-primary" : "border-input hover:bg-accent"
              }`}
            >
              {t === "retail" ? "Retail / Walk-in" : "B2B / Contractor"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="name">{type === "b2b" ? "Contact Name" : "Full Name"} *</Label>
          <Input id="name" value={form.name} onChange={(e) => set("name", e.target.value)} required placeholder={type === "b2b" ? "e.g. Ahmed Koné" : "e.g. Marie Dupont"} />
        </div>
        {type === "b2b" && (
          <div className="space-y-1.5">
            <Label htmlFor="company_name">Company Name</Label>
            <Input id="company_name" value={form.company_name} onChange={(e) => set("company_name", e.target.value)} placeholder="e.g. Koné Constructions" />
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="phone">Phone</Label>
          <Input id="phone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+32 4XX XX XX XX" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="whatsapp">WhatsApp</Label>
          <Input id="whatsapp" type="tel" value={form.whatsapp} onChange={(e) => set("whatsapp", e.target.value)} placeholder="+32 4XX XX XX XX" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="customer@example.com" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Street, city, postal code…" rows={2} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="tags">Tags</Label>
        <Input id="tags" value={form.tags} onChange={(e) => set("tags", e.target.value)} placeholder="e.g. vip, repeat-buyer, architect (comma-separated)" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Any notes about this customer…" rows={3} />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : isEditing ? "Save Changes" : "Add Customer"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
      </div>
    </form>
  );
}
