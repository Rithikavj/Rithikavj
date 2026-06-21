// Tiny in-memory cart used between Menu and Cart screens
import { useEffect, useState } from "react";

export interface CartItem {
  menu_item_id: string;
  name: string;
  price: number;
  qty: number;
  image?: string;
}

interface CartState {
  restaurantId: string | null;
  restaurantName: string | null;
  queueId: string | null;
  items: CartItem[];
}

const state: CartState = {
  restaurantId: null,
  restaurantName: null,
  queueId: null,
  items: [],
};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const cart = {
  get: () => state,
  setRestaurant(id: string, name: string, queueId?: string | null) {
    if (state.restaurantId !== id) state.items = [];
    state.restaurantId = id;
    state.restaurantName = name;
    state.queueId = queueId ?? null;
    emit();
  },
  add(it: { menu_item_id: string; name: string; price: number; image?: string }) {
    const existing = state.items.find((x) => x.menu_item_id === it.menu_item_id);
    if (existing) existing.qty += 1;
    else state.items.push({ ...it, qty: 1 });
    emit();
  },
  decrement(menu_item_id: string) {
    const it = state.items.find((x) => x.menu_item_id === menu_item_id);
    if (!it) return;
    it.qty -= 1;
    if (it.qty <= 0) state.items = state.items.filter((x) => x.menu_item_id !== menu_item_id);
    emit();
  },
  remove(menu_item_id: string) {
    state.items = state.items.filter((x) => x.menu_item_id !== menu_item_id);
    emit();
  },
  clear() {
    state.items = [];
    state.queueId = null;
    emit();
  },
  total: () => state.items.reduce((s, x) => s + x.price * x.qty, 0),
  count: () => state.items.reduce((s, x) => s + x.qty, 0),
  subscribe(fn: () => void) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },
};

export function useCart() {
  const [, force] = useState(0);
  useEffect(() => cart.subscribe(() => force((x) => x + 1)) as any, []);
  return cart;
}
