# DineIQ — PRD (MVP)

## Vision
**Know before you go. Order before you sit.** A premium dining-tech app that solves the wait-time problem at popular Indian restaurants via Live Queue Intelligence, Virtual Queue, and Pre-Ordering.

## MVP Scope (this build)
Single mobile app (React Native / Expo) with TWO role-based experiences sharing one backend.

### Customer flow
1. **Splash → Login** (Phone OTP, mocked — any 6-digit OTP works)
2. **Role select** (Diner / Host)
3. **Discover** — list of restaurants with live wait-time pills, search, cuisine chip filter, hero map illustration with live pins
4. **Restaurant detail** — image, rating, address, live ETA, parties ahead, party-size selector, Join Virtual Queue CTA, "View Full Menu"
5. **Menu / Pre-order** — categories (Recommended, Breakfast, Meals, Beverages, Desserts), veg/non-veg indicator, add/inc/dec stepper, sticky cart bar
6. **Cart** — line items, subtotal + GST(5%), mock "Pay & Confirm"
7. **Order Tracking** — 4-step indicator (Confirmed → Table Ready → Preparing → Ready to Serve), live updates, "I'm Seated" CTA when notified
8. **My Queue** — big position card with ETA, live queue list with "You" highlighted, pre-order/leave actions
9. **Orders** — history with status pills
10. **Notifications** — WhatsApp-style inbox (auto-generated from queue/order events)
11. **Profile** — DineIQ Pass premium teaser (₹99/mo), switch role, logout

### Host flow
1. **Dashboard** — current wait time, parties in queue, seated today, pending orders KPIs + live snapshot
2. **Queue** — live list, "Notify" (→ table assigned, customer pinged), "Seat Now", "No-show", "Add Walk-in" modal
3. **Kitchen** — incoming orders with table tags, status progression: Confirmed → Preparing → Ready to Serve → Served
4. **Profile** — host details, settings stubs, switch role, logout

## Tech Stack
- **Frontend:** Expo Router (file-based), React Native, react-native-safe-area-context, expo-image, Feather icons
- **Backend:** FastAPI + Motor (async MongoDB) + Pydantic v2
- **Storage:** AsyncStorage via `@/src/utils/storage` for user/auth
- **Real-time:** Polling (4–6s) on queue/order screens
- **Auth:** Mocked phone OTP (header `X-User-Id` for API auth)
- **Payments:** Mock "Pay & Confirm" — no real charge

## Design System
- **Dark theme**, primary teal `#19E0B7`, background `#0B0F19`
- Wait-time color coding: ≤15min green, ≤30min amber, >30min red
- 44pt+ touch targets, kebab-case `testID` on every interactive element

## Key Backend Routes (all prefixed `/api`)
Auth: `/auth/request-otp`, `/auth/verify-otp`
Restaurants: `/restaurants`, `/restaurants/{id}`, `/restaurants/{id}/menu`
Queue (customer): `/queue/join`, `/queue/me`, `/queue/{id}`, `/queue/{id}/cancel`, `/queue/{id}/seated`
Orders: `POST /orders`, `/orders/me`, `/orders/{id}`
Notifications: `/notifications/me`, `/notifications/read-all`
Host: `/host/dashboard`, `/host/queue`, `/host/queue/{id}/notify`, `/host/queue/{id}/seat`, `/host/queue/{id}/no-show`, `/host/walk-in`, `/host/orders`, `/host/orders/{id}/status`
Seed reset: `POST /seed/reset`

## Out of MVP (future iterations)
- Real Razorpay payments, real WhatsApp Business API alerts
- Real interactive map (react-native-maps — needs dev build)
- ML wait-time predictor v0 (linear regression)
- Restaurant analytics dashboard, POS (Petpooja/Torqus) integration
- DineIQ Pass purchase flow, priority queue logic
