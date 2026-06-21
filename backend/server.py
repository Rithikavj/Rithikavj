"""
DineIQ backend - Real-Time Restaurant Queue Intelligence
- Mocked phone OTP auth (any 6-digit OTP; "123456" recommended)
- Restaurants, menus, virtual queue, pre-orders, notifications
- Auto-seed on startup so the app has live demo data
"""
from __future__ import annotations

import asyncio
import logging
import os
import random
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional, Literal

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Header
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s - %(message)s")
logger = logging.getLogger("dineiq")


# ---------- helpers ----------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def new_id() -> str:
    return str(uuid.uuid4())


# ---------- Models ----------
Role = Literal["customer", "host"]
QueueStatus = Literal["waiting", "notified", "seated", "cancelled", "no_show"]
OrderStatus = Literal["confirmed", "table_ready", "preparing", "ready_to_serve", "served", "cancelled"]


class OTPRequest(BaseModel):
    phone: str
    role: Role = "customer"


class OTPVerify(BaseModel):
    phone: str
    otp: str
    role: Role = "customer"
    name: Optional[str] = None


class User(BaseModel):
    id: str = Field(default_factory=new_id)
    phone: str
    name: str
    role: Role
    restaurant_id: Optional[str] = None  # only for host
    # DineIQ Pass (mock subscription)
    pass_active: bool = False
    pass_plan: Optional[str] = None  # "monthly" | "yearly"
    pass_started_at: Optional[str] = None
    pass_expires_at: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


class Restaurant(BaseModel):
    id: str = Field(default_factory=new_id)
    name: str
    cuisine: str
    cuisines: List[str] = []
    rating: float
    price_level: str  # ₹, ₹₹, ₹₹₹
    address: str
    area: str
    city: str
    image: str
    hero_image: str
    base_wait_min: int  # default wait time when no queue
    capacity: int  # tables
    distance_km: float
    lat: float
    lng: float
    created_at: str = Field(default_factory=now_iso)


class MenuItem(BaseModel):
    id: str = Field(default_factory=new_id)
    restaurant_id: str
    category: str
    name: str
    description: str
    price: int  # in INR
    image: str
    is_veg: bool = True
    is_recommended: bool = False


class QueueEntry(BaseModel):
    id: str = Field(default_factory=new_id)
    restaurant_id: str
    user_id: str
    user_name: str
    party_size: int
    status: QueueStatus = "waiting"
    joined_at: str = Field(default_factory=now_iso)
    notified_at: Optional[str] = None
    seated_at: Optional[str] = None
    table_number: Optional[int] = None
    is_walk_in: bool = False
    is_priority: bool = False  # DineIQ Pass priority queue


class OrderItem(BaseModel):
    menu_item_id: str
    name: str
    price: int
    qty: int
    image: Optional[str] = None


class Order(BaseModel):
    id: str = Field(default_factory=new_id)
    short_id: str  # DQ1245 style
    restaurant_id: str
    restaurant_name: str
    user_id: str
    queue_id: Optional[str] = None
    items: List[OrderItem]
    total: int
    status: OrderStatus = "confirmed"
    created_at: str = Field(default_factory=now_iso)
    seated_at: Optional[str] = None
    table_number: Optional[int] = None


class Notification(BaseModel):
    id: str = Field(default_factory=new_id)
    user_id: str
    title: str
    body: str
    type: str  # queue, order, system
    created_at: str = Field(default_factory=now_iso)
    read: bool = False


# ---------- request models ----------
class JoinQueueReq(BaseModel):
    restaurant_id: str
    party_size: int


class CreateOrderReq(BaseModel):
    restaurant_id: str
    queue_id: Optional[str] = None
    items: List[OrderItem]


class OrderStatusUpdate(BaseModel):
    status: OrderStatus


class WalkInReq(BaseModel):
    name: str
    party_size: int


# ---------- App ----------
PROJECTION = {"_id": 0}


async def current_user(x_user_id: Optional[str] = Header(default=None)) -> dict:
    if not x_user_id:
        raise HTTPException(401, "Missing X-User-Id header")
    user = await db.users.find_one({"id": x_user_id}, PROJECTION)
    if not user:
        raise HTTPException(401, "User not found")
    return user


def short_order_id() -> str:
    return "DQ" + "".join(str(random.randint(0, 9)) for _ in range(4))


async def compute_wait(restaurant_id: str, base_wait: int) -> int:
    """Live wait time = base + (waiting queue length * 4) minutes."""
    n = await db.queue.count_documents({"restaurant_id": restaurant_id, "status": "waiting"})
    return max(0, base_wait + n * 4)


async def queue_position(entry_id: str, restaurant_id: str) -> int:
    """1-indexed position. Priority (DineIQ Pass) entries jump ahead in the same status."""
    waiting = await db.queue.find(
        {"restaurant_id": restaurant_id, "status": {"$in": ["waiting", "notified"]}},
        PROJECTION,
    ).to_list(500)
    waiting.sort(key=lambda q: (not q.get("is_priority", False), q["joined_at"]))
    for i, q in enumerate(waiting):
        if q["id"] == entry_id:
            return i + 1
    return len(waiting) + 1


def pass_is_active(user: dict) -> bool:
    if not user.get("pass_active"):
        return False
    exp = user.get("pass_expires_at")
    if not exp:
        return False
    try:
        return datetime.fromisoformat(exp) > datetime.now(timezone.utc)
    except Exception:
        return False


async def push_notification(user_id: str, title: str, body: str, type_: str = "queue"):
    n = Notification(user_id=user_id, title=title, body=body, type=type_)
    await db.notifications.insert_one(n.model_dump())


# ---------- Auth ----------
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"app": "DineIQ", "status": "ok"}


@api_router.post("/auth/request-otp")
async def request_otp(req: OTPRequest):
    # mocked OTP: any 6-digit works; we hint 123456
    logger.info(f"OTP requested for {req.phone} role={req.role}")
    return {"ok": True, "hint": "Use OTP 123456 (any 6 digits also work)"}


@api_router.post("/auth/verify-otp")
async def verify_otp(req: OTPVerify):
    if not (req.otp.isdigit() and len(req.otp) == 6):
        raise HTTPException(400, "OTP must be 6 digits")

    existing = await db.users.find_one({"phone": req.phone, "role": req.role}, PROJECTION)
    if existing:
        return {"user": existing, "token": existing["id"]}

    name = req.name or ("Host Manager" if req.role == "host" else f"Guest {req.phone[-4:]}")
    user = User(phone=req.phone, name=name, role=req.role)
    user_dict = user.model_dump()

    if req.role == "host":
        # assign first restaurant or create a default if none
        restaurant = await db.restaurants.find_one({}, PROJECTION)
        if restaurant:
            user_dict["restaurant_id"] = restaurant["id"]

    await db.users.insert_one(user_dict)
    user_dict.pop("_id", None)
    return {"user": user_dict, "token": user_dict["id"]}


@api_router.get("/me")
async def me(user: dict = None):  # set via dependency below
    raise HTTPException(401, "use /auth/me")


@api_router.get("/auth/me")
async def auth_me(x_user_id: str = Header(...)):
    u = await db.users.find_one({"id": x_user_id}, PROJECTION)
    if not u:
        raise HTTPException(401, "Not found")
    return u


# ---------- Restaurants ----------
@api_router.get("/restaurants")
async def list_restaurants(q: Optional[str] = None, cuisine: Optional[str] = None):
    query = {}
    if q:
        query["name"] = {"$regex": q, "$options": "i"}
    if cuisine and cuisine.lower() != "all":
        query["cuisines"] = {"$in": [cuisine]}
    rests = await db.restaurants.find(query, PROJECTION).to_list(200)
    for r in rests:
        r["wait_time_min"] = await compute_wait(r["id"], r["base_wait_min"])
        r["parties_ahead"] = await db.queue.count_documents(
            {"restaurant_id": r["id"], "status": "waiting"}
        )
    return rests


@api_router.get("/restaurants/{restaurant_id}")
async def get_restaurant(restaurant_id: str):
    r = await db.restaurants.find_one({"id": restaurant_id}, PROJECTION)
    if not r:
        raise HTTPException(404, "Restaurant not found")
    r["wait_time_min"] = await compute_wait(restaurant_id, r["base_wait_min"])
    r["parties_ahead"] = await db.queue.count_documents(
        {"restaurant_id": restaurant_id, "status": "waiting"}
    )
    return r


@api_router.get("/restaurants/{restaurant_id}/menu")
async def get_menu(restaurant_id: str):
    items = await db.menu_items.find({"restaurant_id": restaurant_id}, PROJECTION).to_list(500)
    cats: dict = {}
    for it in items:
        cats.setdefault(it["category"], []).append(it)
    # ordered categories
    order = ["Recommended", "Breakfast", "Meals", "Beverages", "Desserts"]
    out = []
    for c in order:
        if c in cats:
            out.append({"name": c, "items": cats[c]})
    for c, lst in cats.items():
        if c not in order:
            out.append({"name": c, "items": lst})
    return {"restaurant_id": restaurant_id, "categories": out}


# ---------- Queue (customer) ----------
@api_router.post("/queue/join")
async def join_queue(req: JoinQueueReq, x_user_id: str = Header(...)):
    u = await db.users.find_one({"id": x_user_id}, PROJECTION)
    if not u:
        raise HTTPException(401, "Login required")
    r = await db.restaurants.find_one({"id": req.restaurant_id}, PROJECTION)
    if not r:
        raise HTTPException(404, "Restaurant not found")

    # one active entry per user per restaurant
    existing = await db.queue.find_one(
        {"user_id": x_user_id, "restaurant_id": req.restaurant_id,
         "status": {"$in": ["waiting", "notified"]}},
        PROJECTION,
    )
    if existing:
        existing["position"] = await queue_position(existing["id"], req.restaurant_id)
        existing["eta_min"] = await compute_wait(req.restaurant_id, r["base_wait_min"])
        existing["restaurant_name"] = r["name"]
        return existing

    entry = QueueEntry(
        restaurant_id=req.restaurant_id,
        user_id=x_user_id,
        user_name=u["name"],
        party_size=req.party_size,
        is_priority=pass_is_active(u),
    )
    await db.queue.insert_one(entry.model_dump())
    pos = await queue_position(entry.id, req.restaurant_id)
    eta = await compute_wait(req.restaurant_id, r["base_wait_min"])
    priority_note = " (DineIQ Pass priority applied — you skipped ahead!)" if entry.is_priority else ""
    await push_notification(
        x_user_id,
        f"Queue at {r['name']} confirmed",
        f"You are number {pos}. Estimated wait: {eta} min.{priority_note} "
        f"We'll alert you when your table is ready.",
        "queue",
    )
    out = entry.model_dump()
    out["position"] = pos
    out["eta_min"] = eta
    out["restaurant_name"] = r["name"]
    return out


@api_router.get("/queue/me")
async def my_queue(x_user_id: str = Header(...)):
    entries = await db.queue.find(
        {"user_id": x_user_id, "status": {"$in": ["waiting", "notified", "seated"]}},
        PROJECTION,
    ).sort("joined_at", -1).to_list(50)
    for e in entries:
        r = await db.restaurants.find_one({"id": e["restaurant_id"]}, PROJECTION)
        e["restaurant_name"] = r["name"] if r else "Restaurant"
        e["restaurant_image"] = r["image"] if r else ""
        e["restaurant_area"] = r["area"] if r else ""
        e["position"] = await queue_position(e["id"], e["restaurant_id"])
        e["eta_min"] = await compute_wait(e["restaurant_id"], r["base_wait_min"] if r else 10)
    return entries


@api_router.get("/queue/{queue_id}")
async def get_queue_entry(queue_id: str):
    e = await db.queue.find_one({"id": queue_id}, PROJECTION)
    if not e:
        raise HTTPException(404, "Not found")
    r = await db.restaurants.find_one({"id": e["restaurant_id"]}, PROJECTION)
    e["restaurant_name"] = r["name"] if r else "Restaurant"
    e["restaurant_image"] = r["image"] if r else ""
    e["restaurant_area"] = r["area"] if r else ""
    e["position"] = await queue_position(queue_id, e["restaurant_id"])
    e["eta_min"] = await compute_wait(e["restaurant_id"], r["base_wait_min"] if r else 10)
    # live queue around this entry (priority entries jump ahead)
    live = await db.queue.find(
        {"restaurant_id": e["restaurant_id"], "status": {"$in": ["waiting", "notified"]}},
        PROJECTION,
    ).to_list(200)
    live.sort(key=lambda q: (not q.get("is_priority", False), q["joined_at"]))
    for i, q in enumerate(live):
        q["position"] = i + 1
        q["is_you"] = q["id"] == queue_id
    e["live_queue"] = live
    return e


@api_router.post("/queue/{queue_id}/cancel")
async def cancel_queue(queue_id: str, x_user_id: str = Header(...)):
    e = await db.queue.find_one({"id": queue_id}, PROJECTION)
    if not e:
        raise HTTPException(404, "Not found")
    if e["user_id"] != x_user_id:
        raise HTTPException(403, "Not your queue")
    await db.queue.update_one({"id": queue_id}, {"$set": {"status": "cancelled"}})
    return {"ok": True}


@api_router.post("/queue/{queue_id}/seated")
async def mark_self_seated(queue_id: str, x_user_id: str = Header(...)):
    """Customer taps 'I'm Seated' after table is ready."""
    e = await db.queue.find_one({"id": queue_id}, PROJECTION)
    if not e:
        raise HTTPException(404, "Not found")
    if e["user_id"] != x_user_id:
        raise HTTPException(403, "Not your queue")
    table = e.get("table_number") or random.randint(1, 20)
    await db.queue.update_one(
        {"id": queue_id},
        {"$set": {"status": "seated", "seated_at": now_iso(), "table_number": table}},
    )
    # advance any related order to preparing
    await db.orders.update_many(
        {"queue_id": queue_id, "status": {"$in": ["confirmed", "table_ready"]}},
        {"$set": {"status": "preparing", "seated_at": now_iso(), "table_number": table}},
    )
    await push_notification(
        x_user_id, "Enjoy your meal!",
        f"You're seated at Table {table}. Your order is being prepared.",
        "order",
    )
    return {"ok": True, "table_number": table}


# ---------- Orders (customer) ----------
@api_router.post("/orders")
async def create_order(req: CreateOrderReq, x_user_id: str = Header(...)):
    r = await db.restaurants.find_one({"id": req.restaurant_id}, PROJECTION)
    if not r:
        raise HTTPException(404, "Restaurant not found")
    total = sum(it.price * it.qty for it in req.items)
    order = Order(
        short_id=short_order_id(),
        restaurant_id=req.restaurant_id,
        restaurant_name=r["name"],
        user_id=x_user_id,
        queue_id=req.queue_id,
        items=req.items,
        total=total,
    )
    await db.orders.insert_one(order.model_dump())
    await push_notification(
        x_user_id, "Order Confirmed",
        f"Your pre-order at {r['name']} (#{order.short_id}, ₹{total}) is confirmed. "
        f"We'll start cooking once you're seated.",
        "order",
    )
    return order.model_dump()


@api_router.get("/orders/me")
async def my_orders(x_user_id: str = Header(...)):
    orders = await db.orders.find({"user_id": x_user_id}, PROJECTION).sort("created_at", -1).to_list(100)
    return orders


@api_router.get("/orders/{order_id}")
async def get_order(order_id: str):
    o = await db.orders.find_one({"id": order_id}, PROJECTION)
    if not o:
        raise HTTPException(404, "Not found")
    return o


# ---------- Notifications ----------
@api_router.get("/notifications/me")
async def my_notifications(x_user_id: str = Header(...)):
    notes = await db.notifications.find({"user_id": x_user_id}, PROJECTION).sort("created_at", -1).to_list(100)
    return notes


@api_router.post("/notifications/read-all")
async def read_all(x_user_id: str = Header(...)):
    await db.notifications.update_many({"user_id": x_user_id}, {"$set": {"read": True}})
    return {"ok": True}


# ---------- DineIQ Pass (mock subscription) ----------
PASS_PLANS = {
    "monthly": {"price": 99, "days": 30, "label": "Monthly"},
    "yearly": {"price": 999, "days": 365, "label": "Yearly"},
}


class PassSubscribeReq(BaseModel):
    plan: Literal["monthly", "yearly"] = "monthly"


@api_router.get("/me/pass")
async def get_my_pass(x_user_id: str = Header(...)):
    u = await db.users.find_one({"id": x_user_id}, PROJECTION)
    if not u:
        raise HTTPException(404, "User not found")
    active = pass_is_active(u)
    return {
        "active": active,
        "plan": u.get("pass_plan") if active else None,
        "started_at": u.get("pass_started_at") if active else None,
        "expires_at": u.get("pass_expires_at") if active else None,
        "plans": PASS_PLANS,
    }


@api_router.post("/me/pass/subscribe")
async def subscribe_pass(req: PassSubscribeReq, x_user_id: str = Header(...)):
    u = await db.users.find_one({"id": x_user_id}, PROJECTION)
    if not u:
        raise HTTPException(404, "User not found")
    plan = PASS_PLANS[req.plan]
    now = datetime.now(timezone.utc)
    # extend existing pass if active, else start fresh
    base = now
    if pass_is_active(u):
        try:
            base = max(datetime.fromisoformat(u["pass_expires_at"]), now)
        except Exception:
            base = now
    expires = base + timedelta(days=plan["days"])
    await db.users.update_one(
        {"id": x_user_id},
        {"$set": {
            "pass_active": True, "pass_plan": req.plan,
            "pass_started_at": now.isoformat(), "pass_expires_at": expires.isoformat(),
        }},
    )
    await push_notification(
        x_user_id, "Welcome to DineIQ Pass!",
        f"Your {plan['label']} Pass is active until {expires.strftime('%d %b %Y')}. "
        f"You'll skip ahead in queues, get priority alerts and group booking.",
        "system",
    )
    updated = await db.users.find_one({"id": x_user_id}, PROJECTION)
    return {"ok": True, "user": updated}


@api_router.post("/me/pass/cancel")
async def cancel_pass(x_user_id: str = Header(...)):
    await db.users.update_one(
        {"id": x_user_id},
        {"$set": {"pass_active": False}},
    )
    await push_notification(
        x_user_id, "DineIQ Pass cancelled",
        "Your Pass benefits will end after the current billing period. We're sorry to see you go!",
        "system",
    )
    return {"ok": True}


# ---------- Host ----------
@api_router.get("/host/dashboard")
async def host_dashboard(x_user_id: str = Header(...)):
    u = await db.users.find_one({"id": x_user_id}, PROJECTION)
    if not u or u["role"] != "host":
        raise HTTPException(403, "Host only")
    rid = u.get("restaurant_id")
    if not rid:
        raise HTTPException(404, "No restaurant linked")
    r = await db.restaurants.find_one({"id": rid}, PROJECTION)
    waiting = await db.queue.count_documents({"restaurant_id": rid, "status": "waiting"})
    notified = await db.queue.count_documents({"restaurant_id": rid, "status": "notified"})
    seated_today = await db.queue.count_documents({
        "restaurant_id": rid, "status": "seated",
        "seated_at": {"$gte": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()},
    })
    pending_orders = await db.orders.count_documents({
        "restaurant_id": rid,
        "status": {"$in": ["confirmed", "table_ready", "preparing"]},
    })
    wait = await compute_wait(rid, r["base_wait_min"])
    return {
        "restaurant": r,
        "waiting": waiting,
        "notified": notified,
        "seated_today": seated_today,
        "pending_orders": pending_orders,
        "current_wait_min": wait,
    }


@api_router.get("/host/queue")
async def host_queue(x_user_id: str = Header(...)):
    u = await db.users.find_one({"id": x_user_id}, PROJECTION)
    if not u or u["role"] != "host":
        raise HTTPException(403, "Host only")
    rid = u.get("restaurant_id")
    entries = await db.queue.find(
        {"restaurant_id": rid, "status": {"$in": ["waiting", "notified"]}},
        PROJECTION,
    ).to_list(500)
    entries.sort(key=lambda q: (not q.get("is_priority", False), q["joined_at"]))
    for i, e in enumerate(entries):
        e["position"] = i + 1
    return entries


@api_router.get("/host/analytics")
async def host_analytics(x_user_id: str = Header(...)):
    u = await db.users.find_one({"id": x_user_id}, PROJECTION)
    if not u or u["role"] != "host":
        raise HTTPException(403, "Host only")
    rid = u.get("restaurant_id")
    if not rid:
        raise HTTPException(404, "No restaurant linked")
    r = await db.restaurants.find_one({"id": rid}, PROJECTION)
    now = datetime.now(timezone.utc)
    day_start = now - timedelta(hours=24)
    week_start = now - timedelta(days=7)
    prev_24_start = now - timedelta(hours=48)

    # All queue entries created in the last 24h
    today_q = await db.queue.find(
        {"restaurant_id": rid, "joined_at": {"$gte": day_start.isoformat()}},
        PROJECTION,
    ).to_list(2000)
    yest_q = await db.queue.find(
        {"restaurant_id": rid,
         "joined_at": {"$gte": prev_24_start.isoformat(), "$lt": day_start.isoformat()}},
        PROJECTION,
    ).to_list(2000)

    parties_today = len(today_q)
    parties_yest = len(yest_q)
    seated = [q for q in today_q if q.get("status") == "seated"]
    cancelled = [q for q in today_q if q.get("status") == "cancelled"]
    no_shows = [q for q in today_q if q.get("status") == "no_show"]
    waiting = [q for q in today_q if q.get("status") in ("waiting", "notified")]

    # avg wait (minutes) for seated parties today
    waits = []
    for q in seated:
        try:
            joined = datetime.fromisoformat(q["joined_at"])
            sat = datetime.fromisoformat(q["seated_at"]) if q.get("seated_at") else None
            if sat:
                waits.append(int((sat - joined).total_seconds() // 60))
        except Exception:
            pass
    avg_wait_min = int(sum(waits) / len(waits)) if waits else 0

    walk_away_rate = round((len(cancelled) / parties_today) * 100, 1) if parties_today else 0.0
    no_show_rate = round((len(no_shows) / parties_today) * 100, 1) if parties_today else 0.0
    seated_rate = round((len(seated) / parties_today) * 100, 1) if parties_today else 0.0

    # Hourly traffic (24 buckets starting 24h ago)
    buckets = [0] * 24
    for q in today_q:
        try:
            joined = datetime.fromisoformat(q["joined_at"])
            hours_ago = int((now - joined).total_seconds() // 3600)
            if 0 <= hours_ago < 24:
                buckets[23 - hours_ago] += 1
        except Exception:
            pass

    # Top items today
    item_counts: dict = {}
    item_meta: dict = {}
    today_orders = await db.orders.find(
        {"restaurant_id": rid, "created_at": {"$gte": day_start.isoformat()}},
        PROJECTION,
    ).to_list(1000)
    revenue_today = 0
    for o in today_orders:
        revenue_today += int(o.get("total", 0))
        for it in o.get("items", []):
            item_counts[it["menu_item_id"]] = item_counts.get(it["menu_item_id"], 0) + it["qty"]
            item_meta[it["menu_item_id"]] = {"name": it["name"], "price": it["price"], "image": it.get("image")}
    top_items = sorted(item_counts.items(), key=lambda x: -x[1])[:5]
    top_items_out = [
        {"id": iid, "name": item_meta[iid]["name"], "image": item_meta[iid]["image"],
         "qty": qty, "revenue": qty * item_meta[iid]["price"]}
        for iid, qty in top_items
    ]

    # weekly bar (7 buckets, parties per day)
    week_buckets = [0] * 7
    week_q = await db.queue.find(
        {"restaurant_id": rid, "joined_at": {"$gte": week_start.isoformat()}},
        PROJECTION,
    ).to_list(5000)
    for q in week_q:
        try:
            joined = datetime.fromisoformat(q["joined_at"])
            days_ago = int((now - joined).total_seconds() // 86400)
            if 0 <= days_ago < 7:
                week_buckets[6 - days_ago] += 1
        except Exception:
            pass

    # peak hour
    peak_hour_idx = buckets.index(max(buckets)) if max(buckets) > 0 else None
    peak_hour_label = None
    if peak_hour_idx is not None:
        peak_dt = now - timedelta(hours=23 - peak_hour_idx)
        peak_hour_label = peak_dt.strftime("%-I %p") if hasattr(peak_dt, "strftime") else None

    pct_change = 0
    if parties_yest > 0:
        pct_change = round(((parties_today - parties_yest) / parties_yest) * 100, 1)

    return {
        "restaurant": r,
        "summary": {
            "parties_today": parties_today,
            "parties_yesterday": parties_yest,
            "pct_change": pct_change,
            "seated_today": len(seated),
            "cancelled_today": len(cancelled),
            "no_shows_today": len(no_shows),
            "waiting_now": len(waiting),
            "avg_wait_min": avg_wait_min,
            "walk_away_rate": walk_away_rate,
            "no_show_rate": no_show_rate,
            "seated_rate": seated_rate,
            "revenue_today": revenue_today,
            "orders_today": len(today_orders),
            "peak_hour": peak_hour_label,
        },
        "hourly": buckets,
        "weekly": week_buckets,
        "top_items": top_items_out,
    }


@api_router.post("/host/queue/{queue_id}/notify")
async def host_notify(queue_id: str, x_user_id: str = Header(...)):
    u = await db.users.find_one({"id": x_user_id}, PROJECTION)
    if not u or u["role"] != "host":
        raise HTTPException(403, "Host only")
    e = await db.queue.find_one({"id": queue_id}, PROJECTION)
    if not e:
        raise HTTPException(404, "Not found")
    table = random.randint(1, 20)
    await db.queue.update_one(
        {"id": queue_id},
        {"$set": {"status": "notified", "notified_at": now_iso(), "table_number": table}},
    )
    # bump related order to table_ready
    await db.orders.update_many(
        {"queue_id": queue_id, "status": "confirmed"},
        {"$set": {"status": "table_ready", "table_number": table}},
    )
    r = await db.restaurants.find_one({"id": e["restaurant_id"]}, PROJECTION)
    await push_notification(
        e["user_id"], "Your table is ready!",
        f"Good news! Table {table} is ready at {r['name'] if r else ''}. Please head to the restaurant.",
        "queue",
    )
    return {"ok": True, "table_number": table}


@api_router.post("/host/queue/{queue_id}/seat")
async def host_seat(queue_id: str, x_user_id: str = Header(...)):
    u = await db.users.find_one({"id": x_user_id}, PROJECTION)
    if not u or u["role"] != "host":
        raise HTTPException(403, "Host only")
    e = await db.queue.find_one({"id": queue_id}, PROJECTION)
    if not e:
        raise HTTPException(404, "Not found")
    table = e.get("table_number") or random.randint(1, 20)
    await db.queue.update_one(
        {"id": queue_id},
        {"$set": {"status": "seated", "seated_at": now_iso(), "table_number": table}},
    )
    await db.orders.update_many(
        {"queue_id": queue_id, "status": {"$in": ["confirmed", "table_ready"]}},
        {"$set": {"status": "preparing", "seated_at": now_iso(), "table_number": table}},
    )
    await push_notification(
        e["user_id"], "Enjoy your meal!",
        f"You're seated at Table {table}. Your order is being prepared.",
        "order",
    )
    return {"ok": True}


@api_router.post("/host/queue/{queue_id}/no-show")
async def host_no_show(queue_id: str, x_user_id: str = Header(...)):
    u = await db.users.find_one({"id": x_user_id}, PROJECTION)
    if not u or u["role"] != "host":
        raise HTTPException(403, "Host only")
    await db.queue.update_one({"id": queue_id}, {"$set": {"status": "no_show"}})
    return {"ok": True}


@api_router.post("/host/walk-in")
async def host_walk_in(req: WalkInReq, x_user_id: str = Header(...)):
    u = await db.users.find_one({"id": x_user_id}, PROJECTION)
    if not u or u["role"] != "host":
        raise HTTPException(403, "Host only")
    rid = u.get("restaurant_id")
    entry = QueueEntry(
        restaurant_id=rid,
        user_id=f"walkin-{new_id()[:6]}",
        user_name=req.name,
        party_size=req.party_size,
        is_walk_in=True,
    )
    await db.queue.insert_one(entry.model_dump())
    return entry.model_dump()


@api_router.get("/host/orders")
async def host_orders(x_user_id: str = Header(...)):
    u = await db.users.find_one({"id": x_user_id}, PROJECTION)
    if not u or u["role"] != "host":
        raise HTTPException(403, "Host only")
    rid = u.get("restaurant_id")
    orders = await db.orders.find(
        {"restaurant_id": rid, "status": {"$in": ["confirmed", "table_ready", "preparing", "ready_to_serve"]}},
        PROJECTION,
    ).sort("created_at", -1).to_list(200)
    return orders


@api_router.post("/host/orders/{order_id}/status")
async def host_update_order_status(order_id: str, req: OrderStatusUpdate, x_user_id: str = Header(...)):
    u = await db.users.find_one({"id": x_user_id}, PROJECTION)
    if not u or u["role"] != "host":
        raise HTTPException(403, "Host only")
    o = await db.orders.find_one({"id": order_id}, PROJECTION)
    if not o:
        raise HTTPException(404, "Not found")
    await db.orders.update_one({"id": order_id}, {"$set": {"status": req.status}})
    msg = {
        "preparing": "Your order is being prepared.",
        "ready_to_serve": "Your order is ready and on its way!",
        "served": "Enjoy your meal! Tap to rate your experience.",
    }.get(req.status, f"Order status: {req.status}")
    await push_notification(o["user_id"], "Order update", msg, "order")
    return {"ok": True}


# ---------- Seed ----------
SEED_RESTAURANTS = [
    {
        "name": "Murugan Idli Shop",
        "cuisine": "South Indian",
        "cuisines": ["South Indian", "Breakfast"],
        "rating": 4.5,
        "price_level": "₹₹",
        "address": "18, N Usman Road, T. Nagar",
        "area": "T. Nagar",
        "city": "Chennai",
        "image": "https://images.pexels.com/photos/9619560/pexels-photo-9619560.jpeg",
        "hero_image": "https://images.pexels.com/photos/29222614/pexels-photo-29222614.jpeg",
        "base_wait_min": 10,
        "capacity": 30,
        "distance_km": 1.2,
        "lat": 13.0418, "lng": 80.2341,
    },
    {
        "name": "Paradise Biryani",
        "cuisine": "Hyderabadi",
        "cuisines": ["Hyderabadi", "Biryani"],
        "rating": 4.4,
        "price_level": "₹₹₹",
        "address": "Jubilee Hills Rd No. 36",
        "area": "Jubilee Hills",
        "city": "Hyderabad",
        "image": "https://images.pexels.com/photos/17497626/pexels-photo-17497626.jpeg",
        "hero_image": "https://images.pexels.com/photos/4224314/pexels-photo-4224314.jpeg",
        "base_wait_min": 25,
        "capacity": 60,
        "distance_km": 2.8,
        "lat": 17.4239, "lng": 78.4738,
    },
    {
        "name": "Saravana Bhavan",
        "cuisine": "South Indian",
        "cuisines": ["South Indian", "Vegetarian"],
        "rating": 4.3,
        "price_level": "₹₹",
        "address": "K.K. Nagar, 8th Main Rd",
        "area": "K.K. Nagar",
        "city": "Chennai",
        "image": "https://images.pexels.com/photos/4224314/pexels-photo-4224314.jpeg",
        "hero_image": "https://images.pexels.com/photos/29222614/pexels-photo-29222614.jpeg",
        "base_wait_min": 5,
        "capacity": 80,
        "distance_km": 3.4,
        "lat": 13.0335, "lng": 80.2018,
    },
    {
        "name": "Bombay Canteen",
        "cuisine": "Modern Indian",
        "cuisines": ["Modern Indian", "Cafe"],
        "rating": 4.6,
        "price_level": "₹₹₹",
        "address": "Process House, Kamala Mills",
        "area": "Lower Parel",
        "city": "Mumbai",
        "image": "https://images.pexels.com/photos/29222614/pexels-photo-29222614.jpeg",
        "hero_image": "https://images.pexels.com/photos/29222614/pexels-photo-29222614.jpeg",
        "base_wait_min": 45,
        "capacity": 50,
        "distance_km": 4.1,
        "lat": 19.0080, "lng": 72.8270,
    },
    {
        "name": "Madras Filter Cafe",
        "cuisine": "Cafe",
        "cuisines": ["Cafe", "Breakfast"],
        "rating": 4.2,
        "price_level": "₹",
        "address": "Anna Salai, Teynampet",
        "area": "Teynampet",
        "city": "Chennai",
        "image": "https://images.pexels.com/photos/38201891/pexels-photo-38201891.png",
        "hero_image": "https://images.pexels.com/photos/38201891/pexels-photo-38201891.png",
        "base_wait_min": 5,
        "capacity": 24,
        "distance_km": 0.8,
        "lat": 13.0412, "lng": 80.2480,
    },
    {
        "name": "Punjab Grill",
        "cuisine": "North Indian",
        "cuisines": ["North Indian", "Tandoor"],
        "rating": 4.4,
        "price_level": "₹₹₹",
        "address": "DLF Cyber Hub",
        "area": "Cyber Hub",
        "city": "Gurgaon",
        "image": "https://images.pexels.com/photos/17497626/pexels-photo-17497626.jpeg",
        "hero_image": "https://images.pexels.com/photos/29222614/pexels-photo-29222614.jpeg",
        "base_wait_min": 20,
        "capacity": 70,
        "distance_km": 5.6,
        "lat": 28.4954, "lng": 77.0892,
    },
]


MENU_TEMPLATES = {
    "South Indian": [
        ("Recommended", "Ghee Podi Idli", "Soft idlis tossed in ghee & podi", 120, True, True,
         "https://images.pexels.com/photos/9619560/pexels-photo-9619560.jpeg"),
        ("Recommended", "Masala Dosa", "Crispy dosa with potato filling", 150, True, True,
         "https://images.pexels.com/photos/9619560/pexels-photo-9619560.jpeg"),
        ("Breakfast", "Pongal", "Slow-cooked rice & lentils with ghee", 110, True, False,
         "https://images.pexels.com/photos/9619560/pexels-photo-9619560.jpeg"),
        ("Breakfast", "Idli Sambar (3 pcs)", "Steamed idlis with hot sambar", 90, True, False,
         "https://images.pexels.com/photos/9619560/pexels-photo-9619560.jpeg"),
        ("Meals", "South Indian Thali", "Rice, sambar, rasam, curd & 2 curries", 220, True, False,
         "https://images.pexels.com/photos/4224314/pexels-photo-4224314.jpeg"),
        ("Meals", "Curd Rice", "Comforting curd rice with tempering", 100, True, False,
         "https://images.pexels.com/photos/4224314/pexels-photo-4224314.jpeg"),
        ("Beverages", "Filter Coffee", "Classic South Indian filter coffee", 60, True, True,
         "https://images.pexels.com/photos/38201891/pexels-photo-38201891.png"),
        ("Beverages", "Masala Chai", "Aromatic spiced milk tea", 50, True, False,
         "https://images.pexels.com/photos/38201891/pexels-photo-38201891.png"),
    ],
    "Hyderabadi": [
        ("Recommended", "Chicken Dum Biryani", "Slow-cooked with aromatic spices", 380, False, True,
         "https://images.pexels.com/photos/17497626/pexels-photo-17497626.jpeg"),
        ("Recommended", "Mutton Biryani", "Tender mutton with saffron rice", 460, False, True,
         "https://images.pexels.com/photos/17497626/pexels-photo-17497626.jpeg"),
        ("Meals", "Veg Biryani", "Mixed veg dum biryani", 280, True, False,
         "https://images.pexels.com/photos/4224314/pexels-photo-4224314.jpeg"),
        ("Meals", "Mirchi Ka Salan", "Tangy chilli curry side", 120, True, False,
         "https://images.pexels.com/photos/4224314/pexels-photo-4224314.jpeg"),
        ("Beverages", "Sweet Lassi", "Chilled yogurt drink", 80, True, False,
         "https://images.pexels.com/photos/38201891/pexels-photo-38201891.png"),
        ("Desserts", "Double Ka Meetha", "Bread pudding in saffron syrup", 140, True, False,
         "https://images.pexels.com/photos/4224314/pexels-photo-4224314.jpeg"),
    ],
    "Modern Indian": [
        ("Recommended", "Eggs Kejriwal", "Bombay-style cheese chilli eggs", 320, False, True,
         "https://images.pexels.com/photos/9619560/pexels-photo-9619560.jpeg"),
        ("Recommended", "Butter Pepper Garlic Crab", "Fresh crab, butter pepper", 850, False, True,
         "https://images.pexels.com/photos/17497626/pexels-photo-17497626.jpeg"),
        ("Meals", "Dal Khichdi", "Comfort khichdi with ghee", 280, True, False,
         "https://images.pexels.com/photos/4224314/pexels-photo-4224314.jpeg"),
        ("Beverages", "Cold Coffee", "Iced coffee, slow-brewed", 220, True, False,
         "https://images.pexels.com/photos/38201891/pexels-photo-38201891.png"),
        ("Desserts", "Bombay Chocolate", "Chocolate fondant", 240, True, False,
         "https://images.pexels.com/photos/4224314/pexels-photo-4224314.jpeg"),
    ],
    "Cafe": [
        ("Recommended", "Filter Coffee", "Authentic South Indian degree coffee", 70, True, True,
         "https://images.pexels.com/photos/38201891/pexels-photo-38201891.png"),
        ("Recommended", "Mysore Bonda", "Crispy fried snack with chutney", 80, True, True,
         "https://images.pexels.com/photos/9619560/pexels-photo-9619560.jpeg"),
        ("Breakfast", "Rava Kesari", "Sweet semolina pudding", 90, True, False,
         "https://images.pexels.com/photos/4224314/pexels-photo-4224314.jpeg"),
        ("Beverages", "Madras Cooler", "Lime & ginger sparkler", 90, True, False,
         "https://images.pexels.com/photos/38201891/pexels-photo-38201891.png"),
    ],
    "North Indian": [
        ("Recommended", "Butter Chicken", "Creamy tomato gravy", 420, False, True,
         "https://images.pexels.com/photos/17497626/pexels-photo-17497626.jpeg"),
        ("Recommended", "Dal Makhani", "Slow-cooked black dal", 280, True, True,
         "https://images.pexels.com/photos/4224314/pexels-photo-4224314.jpeg"),
        ("Meals", "Tandoori Roti", "Whole-wheat tandoor flatbread", 40, True, False,
         "https://images.pexels.com/photos/4224314/pexels-photo-4224314.jpeg"),
        ("Meals", "Paneer Tikka", "Char-grilled spiced paneer", 340, True, False,
         "https://images.pexels.com/photos/17497626/pexels-photo-17497626.jpeg"),
        ("Beverages", "Masala Lassi", "Spiced yogurt drink", 90, True, False,
         "https://images.pexels.com/photos/38201891/pexels-photo-38201891.png"),
        ("Desserts", "Gulab Jamun (2 pcs)", "Soft milk dumplings in syrup", 100, True, False,
         "https://images.pexels.com/photos/4224314/pexels-photo-4224314.jpeg"),
    ],
}


async def seed_if_empty():
    if await db.restaurants.count_documents({}) > 0:
        logger.info("DB already seeded")
        return
    logger.info("Seeding DineIQ database...")
    for r in SEED_RESTAURANTS:
        rest = Restaurant(**r)
        await db.restaurants.insert_one(rest.model_dump())
        template = MENU_TEMPLATES.get(rest.cuisine, MENU_TEMPLATES["South Indian"])
        for (cat, name, desc, price, veg, rec, img) in template:
            item = MenuItem(
                restaurant_id=rest.id, category=cat, name=name, description=desc,
                price=price, image=img, is_veg=veg, is_recommended=rec,
            )
            await db.menu_items.insert_one(item.model_dump())
    # demo queue entries on first restaurant (Murugan Idli Shop)
    first = await db.restaurants.find_one({"name": "Murugan Idli Shop"}, PROJECTION)
    demo_names = ["Arjun K.", "Priya S.", "Rahul M.", "Anita V.", "Karan J.", "Divya R.",
                  "Vikram T.", "Meera N.", "Sneha A.", "Rohit P."]
    base = datetime.now(timezone.utc) - timedelta(minutes=25)
    for i, n in enumerate(demo_names):
        e = QueueEntry(
            restaurant_id=first["id"], user_id=f"demo-{i}", user_name=n,
            party_size=random.choice([2, 2, 3, 4]),
        )
        e_dict = e.model_dump()
        e_dict["joined_at"] = (base + timedelta(minutes=i * 2)).isoformat()
        await db.queue.insert_one(e_dict)

    # historical data for analytics (last 24h on Murugan Idli Shop)
    history_names = ["Aditya", "Bhavna", "Chetan", "Deepa", "Eshan", "Farah", "Gaurav",
                     "Hema", "Ishaan", "Jaya", "Kabir", "Latha", "Mohit", "Nisha",
                     "Omkar", "Pallavi", "Quentin", "Rashmi", "Suresh", "Tanya"]
    menu_for_first = await db.menu_items.find({"restaurant_id": first["id"]}, PROJECTION).to_list(100)
    now_t = datetime.now(timezone.utc)
    # ~35 historical parties spread over the last 24h
    for i in range(35):
        hrs_ago = random.uniform(0.5, 23.5)
        joined = now_t - timedelta(hours=hrs_ago)
        wait_min = random.randint(8, 28)
        status_choice = random.choices(
            ["seated", "seated", "seated", "seated", "cancelled", "no_show"],
            weights=[5, 5, 5, 5, 2, 1],
        )[0]
        e = QueueEntry(
            restaurant_id=first["id"],
            user_id=f"hist-{i}",
            user_name=random.choice(history_names) + " " + chr(65 + (i % 26)) + ".",
            party_size=random.choice([1, 2, 2, 2, 3, 3, 4, 4, 5]),
            status=status_choice,
        )
        e_dict = e.model_dump()
        e_dict["joined_at"] = joined.isoformat()
        if status_choice == "seated":
            seated_at = joined + timedelta(minutes=wait_min)
            e_dict["seated_at"] = seated_at.isoformat()
            e_dict["notified_at"] = (joined + timedelta(minutes=wait_min - 2)).isoformat()
            e_dict["table_number"] = random.randint(1, 18)
        await db.queue.insert_one(e_dict)
        # roughly 60% of seated parties pre-ordered
        if status_choice == "seated" and random.random() < 0.6 and menu_for_first:
            n_items = random.randint(1, 4)
            picks = random.sample(menu_for_first, min(n_items, len(menu_for_first)))
            items = []
            total = 0
            for p in picks:
                qty = random.randint(1, 3)
                total += p["price"] * qty
                items.append({"menu_item_id": p["id"], "name": p["name"], "price": p["price"],
                              "qty": qty, "image": p.get("image")})
            o = Order(
                short_id=short_order_id(),
                restaurant_id=first["id"],
                restaurant_name=first["name"],
                user_id=f"hist-{i}",
                queue_id=e.id,
                items=[OrderItem(**it) for it in items],
                total=total,
                status="served",
            )
            o_dict = o.model_dump()
            o_dict["created_at"] = joined.isoformat()
            o_dict["seated_at"] = e_dict.get("seated_at")
            o_dict["table_number"] = e_dict.get("table_number")
            await db.orders.insert_one(o_dict)

    # Weekly bonus: ~50 parties over last 7 days for weekly trend
    for i in range(50):
        days_ago = random.uniform(1.5, 6.5)
        joined = now_t - timedelta(days=days_ago)
        e = QueueEntry(
            restaurant_id=first["id"],
            user_id=f"week-{i}",
            user_name=random.choice(history_names),
            party_size=random.choice([2, 2, 3, 4]),
            status="seated",
        )
        e_dict = e.model_dump()
        e_dict["joined_at"] = joined.isoformat()
        e_dict["seated_at"] = (joined + timedelta(minutes=random.randint(8, 25))).isoformat()
        await db.queue.insert_one(e_dict)

    logger.info("Seed complete: %d restaurants", len(SEED_RESTAURANTS))


@api_router.post("/seed/reset")
async def reset_seed():
    await db.restaurants.delete_many({})
    await db.menu_items.delete_many({})
    await db.queue.delete_many({})
    await db.orders.delete_many({})
    await db.notifications.delete_many({})
    await db.users.delete_many({})
    await seed_if_empty()
    return {"ok": True}


# ---------- App lifecycle ----------
@asynccontextmanager
async def lifespan(_app: FastAPI):
    await seed_if_empty()
    yield
    client.close()


app = FastAPI(lifespan=lifespan)
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
