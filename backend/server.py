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
    """1-indexed position among waiting entries for this restaurant."""
    waiting = await db.queue.find(
        {"restaurant_id": restaurant_id, "status": {"$in": ["waiting", "notified"]}},
        PROJECTION,
    ).sort("joined_at", 1).to_list(500)
    for i, q in enumerate(waiting):
        if q["id"] == entry_id:
            return i + 1
    return len(waiting) + 1


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
    )
    await db.queue.insert_one(entry.model_dump())
    pos = await queue_position(entry.id, req.restaurant_id)
    eta = await compute_wait(req.restaurant_id, r["base_wait_min"])
    await push_notification(
        x_user_id,
        f"Queue at {r['name']} confirmed",
        f"You are number {pos}. Estimated wait: {eta} min. We'll alert you when your table is ready.",
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
    # live queue around this entry
    live = await db.queue.find(
        {"restaurant_id": e["restaurant_id"], "status": {"$in": ["waiting", "notified"]}},
        PROJECTION,
    ).sort("joined_at", 1).to_list(200)
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
    ).sort("joined_at", 1).to_list(500)
    for i, e in enumerate(entries):
        e["position"] = i + 1
    return entries


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
