// Light API client + auth context for DineIQ
import { storage } from "@/src/utils/storage";

const BASE = process.env.EXPO_PUBLIC_BACKEND_URL;
if (!BASE) {
  // eslint-disable-next-line no-console
  console.warn("EXPO_PUBLIC_BACKEND_URL is not set");
}

export type Role = "customer" | "host";

export interface User {
  id: string;
  phone: string;
  name: string;
  role: Role;
  restaurant_id?: string | null;
}

const AUTH_KEY = "dineiq.auth.v1";

export async function loadUser(): Promise<User | null> {
  const raw = await storage.getItem<string>(AUTH_KEY, "");
  if (!raw) return null;
  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export async function saveUser(u: User): Promise<void> {
  await storage.setItem(AUTH_KEY, JSON.stringify(u));
}

export async function clearUser(): Promise<void> {
  await storage.removeItem(AUTH_KEY);
}

async function request<T>(
  path: string,
  opts: { method?: string; body?: any; userId?: string | null } = {},
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.userId) headers["X-User-Id"] = opts.userId;
  const res = await fetch(`${BASE}/api${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const j = await res.json();
      detail = j.detail || JSON.stringify(j);
    } catch {}
    throw new Error(detail);
  }
  return (await res.json()) as T;
}

export const api = {
  // auth
  requestOtp: (phone: string, role: Role) =>
    request<{ ok: boolean; hint: string }>("/auth/request-otp", {
      method: "POST",
      body: { phone, role },
    }),
  verifyOtp: (phone: string, otp: string, role: Role, name?: string) =>
    request<{ user: User; token: string }>("/auth/verify-otp", {
      method: "POST",
      body: { phone, otp, role, name },
    }),
  // restaurants
  listRestaurants: (q?: string, cuisine?: string) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (cuisine) qs.set("cuisine", cuisine);
    return request<any[]>(`/restaurants${qs.toString() ? `?${qs}` : ""}`);
  },
  getRestaurant: (id: string) => request<any>(`/restaurants/${id}`),
  getMenu: (id: string) => request<any>(`/restaurants/${id}/menu`),
  // queue (customer)
  joinQueue: (userId: string, restaurant_id: string, party_size: number) =>
    request<any>("/queue/join", { method: "POST", body: { restaurant_id, party_size }, userId }),
  myQueue: (userId: string) => request<any[]>("/queue/me", { userId }),
  getQueueEntry: (id: string) => request<any>(`/queue/${id}`),
  cancelQueue: (userId: string, id: string) =>
    request<any>(`/queue/${id}/cancel`, { method: "POST", userId }),
  markSelfSeated: (userId: string, id: string) =>
    request<any>(`/queue/${id}/seated`, { method: "POST", userId }),
  // orders
  createOrder: (userId: string, body: any) =>
    request<any>("/orders", { method: "POST", body, userId }),
  myOrders: (userId: string) => request<any[]>("/orders/me", { userId }),
  getOrder: (id: string) => request<any>(`/orders/${id}`),
  // notifications
  myNotifications: (userId: string) => request<any[]>("/notifications/me", { userId }),
  readAllNotifications: (userId: string) =>
    request<any>("/notifications/read-all", { method: "POST", userId }),
  // DineIQ Pass
  getPass: (userId: string) => request<any>("/me/pass", { userId }),
  subscribePass: (userId: string, plan: "monthly" | "yearly") =>
    request<any>("/me/pass/subscribe", { method: "POST", body: { plan }, userId }),
  cancelPass: (userId: string) =>
    request<any>("/me/pass/cancel", { method: "POST", userId }),
  // host
  hostDashboard: (userId: string) => request<any>("/host/dashboard", { userId }),
  hostAnalytics: (userId: string) => request<any>("/host/analytics", { userId }),
  hostQueue: (userId: string) => request<any[]>("/host/queue", { userId }),
  hostNotify: (userId: string, id: string) =>
    request<any>(`/host/queue/${id}/notify`, { method: "POST", userId }),
  hostSeat: (userId: string, id: string) =>
    request<any>(`/host/queue/${id}/seat`, { method: "POST", userId }),
  hostNoShow: (userId: string, id: string) =>
    request<any>(`/host/queue/${id}/no-show`, { method: "POST", userId }),
  hostWalkIn: (userId: string, name: string, party_size: number) =>
    request<any>("/host/walk-in", { method: "POST", body: { name, party_size }, userId }),
  hostOrders: (userId: string) => request<any[]>("/host/orders", { userId }),
  hostUpdateOrderStatus: (userId: string, id: string, status: string) =>
    request<any>(`/host/orders/${id}/status`, { method: "POST", body: { status }, userId }),
};
