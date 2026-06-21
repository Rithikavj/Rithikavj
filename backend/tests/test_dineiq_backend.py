"""
DineIQ backend regression tests.
Covers: auth, restaurants, menu, queue, orders, notifications, host, role auth,
ObjectId serialization, and end-to-end queue+order flow.
"""
import json
import time
import uuid
import pytest
import requests

# ---------- session fixtures ----------

@pytest.fixture(scope="module")
def b(base_url):
    return base_url


@pytest.fixture(scope="module")
def customer(api_client, b):
    """Create / login a unique customer per test session."""
    phone = f"99{int(time.time()) % 100000000:08d}"
    r = api_client.post(f"{b}/api/auth/request-otp",
                        json={"phone": phone, "role": "customer"})
    assert r.status_code == 200, r.text
    r = api_client.post(f"{b}/api/auth/verify-otp",
                        json={"phone": phone, "otp": "123456",
                              "role": "customer", "name": "Test Diner"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert "user" in data and "token" in data
    assert data["user"]["role"] == "customer"
    return data["user"]


@pytest.fixture(scope="module")
def host(api_client, b):
    """Create / login a unique host (auto-linked to first restaurant)."""
    phone = f"88{int(time.time()) % 100000000:08d}"
    api_client.post(f"{b}/api/auth/request-otp",
                    json={"phone": phone, "role": "host"})
    r = api_client.post(f"{b}/api/auth/verify-otp",
                        json={"phone": phone, "otp": "123456",
                              "role": "host", "name": "Test Host"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["user"]["role"] == "host"
    assert data["user"].get("restaurant_id"), "host should be assigned a restaurant"
    return data["user"]


def _h(user):
    return {"X-User-Id": user["id"], "Content-Type": "application/json"}


def _no_objectid(payload):
    """Ensure no Mongo '_id' key (exact) leaked into JSON response."""
    def walk(node):
        if isinstance(node, dict):
            assert "_id" not in node, \
                f"ObjectId/_id leaked into response: {list(node.keys())}"
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)
    walk(payload)


# ---------- Health & restaurants ----------

class TestHealthAndRestaurants:
    def test_root(self, api_client, b):
        r = api_client.get(f"{b}/api/")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_list_restaurants_seeded(self, api_client, b):
        r = api_client.get(f"{b}/api/restaurants")
        assert r.status_code == 200
        data = r.json()
        _no_objectid(data)
        names = [x["name"] for x in data]
        for expected in ["Murugan Idli Shop", "Paradise Biryani",
                         "Saravana Bhavan", "Bombay Canteen",
                         "Madras Filter Cafe", "Punjab Grill"]:
            assert expected in names, f"missing seed: {expected}"
        for x in data:
            assert "wait_time_min" in x and isinstance(x["wait_time_min"], int)
            assert "parties_ahead" in x and isinstance(x["parties_ahead"], int)

    def test_get_restaurant_detail(self, api_client, b):
        rests = api_client.get(f"{b}/api/restaurants").json()
        murugan = next(x for x in rests if x["name"] == "Murugan Idli Shop")
        r = api_client.get(f"{b}/api/restaurants/{murugan['id']}")
        assert r.status_code == 200
        d = r.json()
        _no_objectid(d)
        for f in ("hero_image", "base_wait_min", "capacity",
                  "wait_time_min", "parties_ahead"):
            assert f in d
        # murugan has 10 demo parties seeded
        assert d["parties_ahead"] >= 1

    def test_get_restaurant_404(self, api_client, b):
        r = api_client.get(f"{b}/api/restaurants/does-not-exist")
        assert r.status_code == 404

    def test_get_menu(self, api_client, b):
        rests = api_client.get(f"{b}/api/restaurants").json()
        murugan = next(x for x in rests if x["name"] == "Murugan Idli Shop")
        r = api_client.get(f"{b}/api/restaurants/{murugan['id']}/menu")
        assert r.status_code == 200
        m = r.json()
        _no_objectid(m)
        assert m["restaurant_id"] == murugan["id"]
        assert "categories" in m and len(m["categories"]) > 0
        cat_names = [c["name"] for c in m["categories"]]
        assert "Recommended" in cat_names
        for c in m["categories"]:
            for it in c["items"]:
                for f in ("id", "name", "price", "image",
                          "is_veg", "is_recommended"):
                    assert f in it


# ---------- Auth ----------

class TestAuth:
    def test_request_otp(self, api_client, b):
        r = api_client.post(f"{b}/api/auth/request-otp",
                            json={"phone": "9000000001", "role": "customer"})
        assert r.status_code == 200
        assert r.json()["ok"] is True

    def test_verify_otp_bad_length(self, api_client, b):
        r = api_client.post(f"{b}/api/auth/verify-otp",
                            json={"phone": "9000000001",
                                  "otp": "123", "role": "customer"})
        assert r.status_code == 400

    def test_same_phone_different_role_creates_different_user(
            self, api_client, b):
        phone = f"77{int(time.time()) % 100000000:08d}"
        c = api_client.post(f"{b}/api/auth/verify-otp",
                            json={"phone": phone, "otp": "123456",
                                  "role": "customer"}).json()
        h = api_client.post(f"{b}/api/auth/verify-otp",
                            json={"phone": phone, "otp": "123456",
                                  "role": "host"}).json()
        assert c["user"]["id"] != h["user"]["id"]
        assert c["user"]["role"] == "customer"
        assert h["user"]["role"] == "host"

    def test_auth_me(self, api_client, b, customer):
        r = api_client.get(f"{b}/api/auth/me", headers=_h(customer))
        assert r.status_code == 200
        assert r.json()["id"] == customer["id"]

    def test_auth_me_missing_header(self, api_client, b):
        # FastAPI returns 422 for required header missing
        r = api_client.get(f"{b}/api/auth/me")
        assert r.status_code in (401, 422)


# ---------- Customer queue ----------

@pytest.fixture(scope="module")
def murugan(api_client, b):
    rs = api_client.get(f"{b}/api/restaurants").json()
    return next(x for x in rs if x["name"] == "Murugan Idli Shop")


class TestCustomerQueue:
    def test_join_queue(self, api_client, b, customer, murugan):
        r = api_client.post(f"{b}/api/queue/join",
                            json={"restaurant_id": murugan["id"],
                                  "party_size": 2},
                            headers=_h(customer))
        assert r.status_code == 200, r.text
        d = r.json()
        _no_objectid(d)
        for f in ("id", "position", "eta_min", "restaurant_name"):
            assert f in d
        assert d["restaurant_name"] == "Murugan Idli Shop"
        # store on class for later
        TestCustomerQueue.queue_id = d["id"]

    def test_join_queue_is_idempotent(self, api_client, b, customer, murugan):
        r = api_client.post(f"{b}/api/queue/join",
                            json={"restaurant_id": murugan["id"],
                                  "party_size": 2},
                            headers=_h(customer))
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == TestCustomerQueue.queue_id

    def test_my_queue(self, api_client, b, customer):
        r = api_client.get(f"{b}/api/queue/me", headers=_h(customer))
        assert r.status_code == 200
        entries = r.json()
        assert any(e["id"] == TestCustomerQueue.queue_id for e in entries)
        for e in entries:
            assert "position" in e and "eta_min" in e

    def test_get_queue_entry_with_live(self, api_client, b, customer):
        r = api_client.get(
            f"{b}/api/queue/{TestCustomerQueue.queue_id}")
        assert r.status_code == 200
        d = r.json()
        _no_objectid(d)
        assert "live_queue" in d and isinstance(d["live_queue"], list)
        you = [q for q in d["live_queue"] if q.get("is_you")]
        assert len(you) == 1

    def test_join_queue_unknown_restaurant(self, api_client, b, customer):
        r = api_client.post(f"{b}/api/queue/join",
                            json={"restaurant_id": "nope", "party_size": 2},
                            headers=_h(customer))
        assert r.status_code == 404


# ---------- Notifications ----------

class TestNotifications:
    def test_notifications_after_join(self, api_client, b, customer):
        r = api_client.get(f"{b}/api/notifications/me",
                           headers=_h(customer))
        assert r.status_code == 200
        notes = r.json()
        _no_objectid(notes)
        assert any("Queue at" in n["title"] for n in notes), \
            "expected queue-join notification"


# ---------- Orders ----------

class TestOrders:
    def test_create_order(self, api_client, b, customer, murugan):
        menu = api_client.get(
            f"{b}/api/restaurants/{murugan['id']}/menu").json()
        item = menu["categories"][0]["items"][0]
        payload = {
            "restaurant_id": murugan["id"],
            "queue_id": TestCustomerQueue.queue_id,
            "items": [{"menu_item_id": item["id"],
                       "name": item["name"], "price": item["price"],
                       "qty": 2, "image": item.get("image")}],
        }
        r = api_client.post(f"{b}/api/orders", json=payload,
                            headers=_h(customer))
        assert r.status_code == 200, r.text
        d = r.json()
        _no_objectid(d)
        assert d["short_id"].startswith("DQ") and len(d["short_id"]) == 6
        assert d["status"] == "confirmed"
        assert d["total"] == item["price"] * 2
        TestOrders.order_id = d["id"]

    def test_my_orders(self, api_client, b, customer):
        r = api_client.get(f"{b}/api/orders/me", headers=_h(customer))
        assert r.status_code == 200
        ids = [o["id"] for o in r.json()]
        assert TestOrders.order_id in ids

    def test_order_confirmed_notification(self, api_client, b, customer):
        notes = api_client.get(f"{b}/api/notifications/me",
                               headers=_h(customer)).json()
        assert any(n["title"] == "Order Confirmed" for n in notes)


# ---------- Host ----------

class TestHost:
    def test_dashboard(self, api_client, b, host):
        r = api_client.get(f"{b}/api/host/dashboard", headers=_h(host))
        assert r.status_code == 200
        d = r.json()
        _no_objectid(d)
        for f in ("restaurant", "waiting", "notified", "seated_today",
                  "pending_orders", "current_wait_min"):
            assert f in d

    def test_host_queue_list(self, api_client, b, host):
        r = api_client.get(f"{b}/api/host/queue", headers=_h(host))
        assert r.status_code == 200
        entries = r.json()
        _no_objectid(entries)
        assert any(e["id"] == TestCustomerQueue.queue_id for e in entries), \
            "customer queue entry should appear in host queue"
        for i, e in enumerate(entries):
            assert e["position"] == i + 1

    def test_host_walk_in(self, api_client, b, host):
        r = api_client.post(f"{b}/api/host/walk-in",
                            json={"name": "TEST Walkin", "party_size": 3},
                            headers=_h(host))
        assert r.status_code == 200
        d = r.json()
        assert d["is_walk_in"] is True

    def test_host_orders_lists_active(self, api_client, b, host):
        r = api_client.get(f"{b}/api/host/orders", headers=_h(host))
        assert r.status_code == 200
        orders = r.json()
        assert any(o["id"] == TestOrders.order_id for o in orders)


# ---------- End-to-end flow ----------

class TestE2EFlow:
    """diner joins -> orders -> host notifies -> diner seated -> host marks
    ready_to_serve -> notifications progress."""

    def test_host_notify_marks_table_ready(self, api_client, b, host,
                                           customer):
        r = api_client.post(
            f"{b}/api/host/queue/{TestCustomerQueue.queue_id}/notify",
            headers=_h(host))
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["ok"] is True and "table_number" in d
        # order should be table_ready
        o = api_client.get(f"{b}/api/orders/{TestOrders.order_id}").json()
        assert o["status"] == "table_ready"
        # diner gets 'Your table is ready'
        notes = api_client.get(f"{b}/api/notifications/me",
                               headers=_h(customer)).json()
        assert any(n["title"] == "Your table is ready!" for n in notes)

    def test_customer_marks_self_seated(self, api_client, b, customer):
        r = api_client.post(
            f"{b}/api/queue/{TestCustomerQueue.queue_id}/seated",
            headers=_h(customer))
        assert r.status_code == 200
        d = r.json()
        assert d["ok"] is True and "table_number" in d
        # order should be preparing
        o = api_client.get(f"{b}/api/orders/{TestOrders.order_id}").json()
        assert o["status"] == "preparing"

    def test_host_marks_order_ready_to_serve(self, api_client, b, host,
                                             customer):
        r = api_client.post(
            f"{b}/api/host/orders/{TestOrders.order_id}/status",
            json={"status": "ready_to_serve"}, headers=_h(host))
        assert r.status_code == 200
        o = api_client.get(f"{b}/api/orders/{TestOrders.order_id}").json()
        assert o["status"] == "ready_to_serve"
        notes = api_client.get(f"{b}/api/notifications/me",
                               headers=_h(customer)).json()
        assert any("ready" in n["body"].lower() for n in notes)


# ---------- Role-based authorization ----------

class TestRoleAuthorization:
    def test_customer_cannot_access_host_dashboard(self, api_client, b,
                                                   customer):
        r = api_client.get(f"{b}/api/host/dashboard",
                           headers=_h(customer))
        assert r.status_code == 403

    def test_other_user_cannot_cancel(self, api_client, b):
        # create a second customer
        phone = f"66{int(time.time()) % 100000000:08d}{uuid.uuid4().hex[:2]}"
        u = api_client.post(f"{b}/api/auth/verify-otp",
                            json={"phone": phone, "otp": "123456",
                                  "role": "customer"}).json()["user"]
        r = api_client.post(
            f"{b}/api/queue/{TestCustomerQueue.queue_id}/cancel",
            headers=_h(u))
        assert r.status_code == 403


# ---------- ObjectId / serialization sanity sweep ----------

class TestSerialization:
    def test_no_objectid_in_responses(self, api_client, b, customer, host):
        endpoints = [
            ("GET", "/api/restaurants", None),
            ("GET", "/api/queue/me", _h(customer)),
            ("GET", "/api/orders/me", _h(customer)),
            ("GET", "/api/notifications/me", _h(customer)),
            ("GET", "/api/host/dashboard", _h(host)),
            ("GET", "/api/host/queue", _h(host)),
            ("GET", "/api/host/orders", _h(host)),
        ]
        for method, path, hdrs in endpoints:
            r = api_client.request(method, f"{b}{path}", headers=hdrs)
            assert r.status_code == 200, f"{path} -> {r.status_code}"
            _no_objectid(r.json())



# ---------- DineIQ Pass (subscription mock) ----------

@pytest.fixture(scope="module")
def pass_user(api_client, b):
    """A fresh customer used for pass + priority queue tests."""
    phone = f"55{int(time.time()) % 100000000:08d}{uuid.uuid4().hex[:2]}"
    r = api_client.post(f"{b}/api/auth/verify-otp",
                        json={"phone": phone, "otp": "123456",
                              "role": "customer", "name": "Pass Diner"})
    assert r.status_code == 200, r.text
    return r.json()["user"]


class TestDineIQPass:
    def test_get_pass_initial_inactive(self, api_client, b, pass_user):
        r = api_client.get(f"{b}/api/me/pass", headers=_h(pass_user))
        assert r.status_code == 200, r.text
        d = r.json()
        _no_objectid(d)
        assert d["active"] is False
        assert d["plan"] is None
        assert d["started_at"] is None
        assert d["expires_at"] is None
        # plans payload
        assert "plans" in d
        assert d["plans"]["monthly"]["price"] == 99
        assert d["plans"]["monthly"]["days"] == 30
        assert d["plans"]["monthly"]["label"]
        assert d["plans"]["yearly"]["price"] == 999
        assert d["plans"]["yearly"]["days"] == 365
        assert d["plans"]["yearly"]["label"]

    def test_subscribe_monthly_activates(self, api_client, b, pass_user):
        r = api_client.post(f"{b}/api/me/pass/subscribe",
                            json={"plan": "monthly"}, headers=_h(pass_user))
        assert r.status_code == 200, r.text
        d = r.json()
        _no_objectid(d)
        assert d["ok"] is True
        u = d["user"]
        assert u["pass_active"] is True
        assert u["pass_plan"] == "monthly"
        assert u["pass_started_at"]
        assert u["pass_expires_at"]
        # verify via GET
        from datetime import datetime, timezone, timedelta
        exp = datetime.fromisoformat(u["pass_expires_at"])
        delta_days = (exp - datetime.now(timezone.utc)).days
        # ~30 days (allow some slack)
        assert 28 <= delta_days <= 30, f"expected ~30 days, got {delta_days}"
        TestDineIQPass.first_expiry = u["pass_expires_at"]

        # GET /me/pass now active
        g = api_client.get(f"{b}/api/me/pass", headers=_h(pass_user)).json()
        assert g["active"] is True
        assert g["plan"] == "monthly"

    def test_subscribe_yearly_extends_existing(self, api_client, b, pass_user):
        from datetime import datetime
        r = api_client.post(f"{b}/api/me/pass/subscribe",
                            json={"plan": "yearly"}, headers=_h(pass_user))
        assert r.status_code == 200, r.text
        u = r.json()["user"]
        assert u["pass_plan"] == "yearly"
        new_exp = datetime.fromisoformat(u["pass_expires_at"])
        old_exp = datetime.fromisoformat(TestDineIQPass.first_expiry)
        delta_days = (new_exp - old_exp).days
        # Should extend by ~365 days, NOT reset to now+365
        assert 360 <= delta_days <= 366, \
            f"expected ~365d extension, got {delta_days}"

    def test_cancel_pass_marks_inactive_immediately(self, api_client, b,
                                                    pass_user):
        r = api_client.post(f"{b}/api/me/pass/cancel", headers=_h(pass_user))
        assert r.status_code == 200
        # GET /me/pass should now report inactive (helper checks pass_active AND exp>now)
        g = api_client.get(f"{b}/api/me/pass", headers=_h(pass_user)).json()
        assert g["active"] is False
        assert g["plan"] is None


# ---------- Pass Priority queue jumping ----------

class TestPassPriorityQueue:
    """Pass holder joins after non-pass user but jumps ahead."""

    def test_priority_user_jumps_ahead(self, api_client, b, murugan):
        # Create non-pass user A
        phone_a = f"44{int(time.time()) % 100000000:08d}{uuid.uuid4().hex[:2]}"
        ua = api_client.post(f"{b}/api/auth/verify-otp",
                             json={"phone": phone_a, "otp": "123456",
                                   "role": "customer", "name": "NonPass A"}
                             ).json()["user"]
        # Create user B & activate Pass
        phone_b = f"44{int(time.time()) % 100000000:08d}{uuid.uuid4().hex[:2]}"
        ub = api_client.post(f"{b}/api/auth/verify-otp",
                             json={"phone": phone_b, "otp": "123456",
                                   "role": "customer", "name": "Pass B"}
                             ).json()["user"]
        sub = api_client.post(f"{b}/api/me/pass/subscribe",
                              json={"plan": "monthly"}, headers=_h(ub))
        assert sub.status_code == 200
        assert sub.json()["user"]["pass_active"] is True

        # A joins first
        ra = api_client.post(f"{b}/api/queue/join",
                             json={"restaurant_id": murugan["id"],
                                   "party_size": 2}, headers=_h(ua))
        assert ra.status_code == 200, ra.text
        a_entry = ra.json()
        a_pos = a_entry["position"]
        assert a_entry.get("is_priority") in (False, None)

        # Slight delay so joined_at differs
        time.sleep(0.5)

        # B (pass) joins after
        rb = api_client.post(f"{b}/api/queue/join",
                             json={"restaurant_id": murugan["id"],
                                   "party_size": 2}, headers=_h(ub))
        assert rb.status_code == 200, rb.text
        b_entry = rb.json()
        assert b_entry["is_priority"] is True, \
            "Pass holder's queue entry should be is_priority=true"

        # B should be ahead of A: re-check via /queue/{a_entry['id']}
        live = api_client.get(
            f"{b}/api/queue/{a_entry['id']}").json()["live_queue"]
        # find positions
        a_live = next(q for q in live if q["id"] == a_entry["id"])
        b_live = next(q for q in live if q["id"] == b_entry["id"])
        assert b_live["position"] < a_live["position"], (
            f"Pass B(pos={b_live['position']}) must be ahead of "
            f"A(pos={a_live['position']})"
        )

        # Priority entries listed first in live_queue (sorted by position)
        # ensure live_queue is sorted by position ascending
        positions = [q["position"] for q in live]
        assert positions == sorted(positions), \
            "live_queue should be sorted by position ascending"

        # All priority entries should come before any non-priority entry
        seen_non_priority = False
        for q in live:
            if not q.get("is_priority"):
                seen_non_priority = True
            elif seen_non_priority:
                pytest.fail("priority entry appears after non-priority entry")


# ---------- Host analytics ----------

class TestHostAnalytics:
    def test_analytics_requires_host(self, api_client, b, customer):
        r = api_client.get(f"{b}/api/host/analytics", headers=_h(customer))
        assert r.status_code == 403

    def test_analytics_structure_and_nonempty(self, api_client, b, host):
        # Reset to guarantee historical seed (run once)
        reset = api_client.post(f"{b}/api/seed/reset")
        assert reset.status_code == 200, reset.text
        # After reset, original users are gone; recreate host
        phone = f"33{int(time.time()) % 100000000:08d}"
        api_client.post(f"{b}/api/auth/request-otp",
                        json={"phone": phone, "role": "host"})
        h = api_client.post(f"{b}/api/auth/verify-otp",
                            json={"phone": phone, "otp": "123456",
                                  "role": "host", "name": "Analytics Host"}
                            ).json()["user"]
        assert h.get("restaurant_id")

        r = api_client.get(f"{b}/api/host/analytics", headers=_h(h))
        assert r.status_code == 200, r.text
        d = r.json()
        _no_objectid(d)

        # top-level
        assert "restaurant" in d and d["restaurant"]
        assert "summary" in d
        assert "hourly" in d and isinstance(d["hourly"], list) and len(d["hourly"]) == 24
        assert "weekly" in d and isinstance(d["weekly"], list) and len(d["weekly"]) == 7
        assert "top_items" in d and isinstance(d["top_items"], list)
        assert len(d["top_items"]) <= 5

        # summary fields
        s = d["summary"]
        for f in ("parties_today", "parties_yesterday", "pct_change",
                  "seated_today", "cancelled_today", "no_shows_today",
                  "waiting_now", "avg_wait_min", "walk_away_rate",
                  "no_show_rate", "seated_rate", "revenue_today",
                  "orders_today", "peak_hour"):
            assert f in s, f"missing summary.{f}"

        # non-empty assertions after reset
        assert s["parties_today"] >= 30, (
            f"expected >=30 parties_today after seed, got {s['parties_today']}"
        )
        assert s["revenue_today"] > 0, "revenue_today should be > 0"
        assert len(d["top_items"]) > 0
        assert any(c > 0 for c in d["hourly"]), "hourly buckets should have data"
        assert any(c > 0 for c in d["weekly"]), "weekly buckets should have data"

        # top_items structure
        for it in d["top_items"]:
            for f in ("id", "name", "image", "qty", "revenue"):
                assert f in it
            assert it["qty"] > 0
            assert it["revenue"] > 0
