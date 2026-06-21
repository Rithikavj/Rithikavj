import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, loadUser } from "@/src/api";
import { useCart } from "@/src/cart";
import { colors, fontSize, radius, spacing } from "@/src/theme";

export default function Cart() {
  const router = useRouter();
  const c = useCart();
  const [busy, setBusy] = useState(false);

  const subtotal = c.total();
  const gst = Math.round(subtotal * 0.05);
  const total = subtotal + gst;

  const confirm = async () => {
    const u = await loadUser();
    if (!u) return router.replace("/login");
    const { restaurantId, queueId, items } = c.get();
    if (!restaurantId || items.length === 0) return;
    setBusy(true);
    try {
      const order = await api.createOrder(u.id, {
        restaurant_id: restaurantId,
        queue_id: queueId,
        items: items.map((it) => ({
          menu_item_id: it.menu_item_id, name: it.name, price: it.price,
          qty: it.qty, image: it.image,
        })),
      });
      c.clear();
      router.replace(`/order/${order.id}`);
    } finally {
      setBusy(false);
    }
  };

  if (c.count() === 0) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <Header onBack={() => router.back()} />
        <View style={styles.empty}>
          <Feather name="shopping-bag" size={40} color={colors.textMuted} />
          <Text style={styles.emptyText}>Your cart is empty.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.back()} testID="continue-browsing">
            <Text style={styles.primaryBtnText}>Continue Browsing</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <Header onBack={() => router.back()} restaurantName={c.get().restaurantName ?? "Cart"} />

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 200 }}>
        <Text style={styles.section}>Your Order</Text>
        <View style={styles.list}>
          {c.get().items.map((it) => (
            <View style={styles.row} key={it.menu_item_id} testID={`cart-item-${it.menu_item_id}`}>
              {it.image ? <Image source={{ uri: it.image }} style={styles.thumb} contentFit="cover" /> : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.name}</Text>
                <Text style={styles.itemPrice}>₹{it.price}</Text>
              </View>
              <View style={styles.stepper}>
                <TouchableOpacity onPress={() => c.decrement(it.menu_item_id)} testID={`cart-dec-${it.menu_item_id}`}>
                  <Feather name="minus" size={16} color={colors.primaryContrast} />
                </TouchableOpacity>
                <Text style={styles.stepperQty}>{it.qty}</Text>
                <TouchableOpacity
                  onPress={() => c.add({ menu_item_id: it.menu_item_id, name: it.name, price: it.price, image: it.image })}
                  testID={`cart-inc-${it.menu_item_id}`}
                >
                  <Feather name="plus" size={16} color={colors.primaryContrast} />
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.summary}>
          <Row label="Subtotal" value={`₹${subtotal}`} />
          <Row label="GST (5%)" value={`₹${gst}`} />
          <View style={styles.divider} />
          <Row label="Total" value={`₹${total}`} bold />
        </View>

        {c.get().queueId ? (
          <View style={styles.info}>
            <Feather name="info" size={16} color={colors.primary} />
            <Text style={styles.infoText}>
              Your order will be prepared once your table is ready. Pay nothing now — this is a demo flow.
            </Text>
          </View>
        ) : (
          <View style={styles.info}>
            <Feather name="info" size={16} color={colors.warning} />
            <Text style={styles.infoText}>
              You haven't joined a queue yet. We'll create your order — but join the queue to know when to arrive.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bottomLabel}>Total · ₹{total}</Text>
          <Text style={styles.bottomSub}>Mock payment · No money charged</Text>
        </View>
        <TouchableOpacity
          style={[styles.payBtn, busy && { opacity: 0.6 }]}
          onPress={confirm}
          disabled={busy}
          testID="confirm-order-btn"
        >
          {busy ? <ActivityIndicator color={colors.primaryContrast} /> : (
            <>
              <Text style={styles.payBtnText}>Pay & Confirm</Text>
              <Feather name="check" size={18} color={colors.primaryContrast} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function Header({ onBack, restaurantName }: { onBack: () => void; restaurantName?: string }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={onBack} style={styles.iconBtn} testID="back-btn">
        <Feather name="arrow-left" size={20} color={colors.text} />
      </TouchableOpacity>
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text style={styles.headerTitle}>Cart</Text>
        {restaurantName && <Text style={styles.headerSub}>{restaurantName}</Text>}
      </View>
      <View style={{ width: 40 }} />
    </View>
  );
}

function Row({ label, value, bold }: any) {
  return (
    <View style={styles.sumRow}>
      <Text style={[styles.sumLabel, bold && { color: colors.text, fontWeight: "800", fontSize: fontSize.lg }]}>{label}</Text>
      <Text style={[styles.sumValue, bold && { color: colors.text, fontWeight: "800", fontSize: fontSize.lg }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", padding: spacing.lg, gap: spacing.sm,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bgCard,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: colors.text, fontWeight: "800", fontSize: fontSize.lg },
  headerSub: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
  section: { color: colors.textSecondary, fontWeight: "700", fontSize: fontSize.sm, letterSpacing: 0.5, marginBottom: spacing.md },
  list: { backgroundColor: colors.bgCard, borderRadius: radius.lg, overflow: "hidden" },
  row: {
    flexDirection: "row", gap: spacing.md, alignItems: "center", padding: spacing.md,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  thumb: { width: 50, height: 50, borderRadius: radius.md },
  itemName: { color: colors.text, fontWeight: "700", fontSize: fontSize.md },
  itemPrice: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  stepper: {
    flexDirection: "row", gap: 12, alignItems: "center",
    backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill,
  },
  stepperQty: { color: colors.primaryContrast, fontWeight: "800", fontSize: 14 },
  summary: { marginTop: spacing.lg, padding: spacing.lg, backgroundColor: colors.bgCard, borderRadius: radius.lg },
  sumRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  sumLabel: { color: colors.textSecondary, fontSize: fontSize.md },
  sumValue: { color: colors.text, fontSize: fontSize.md, fontWeight: "600" },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: spacing.sm },
  info: {
    marginTop: spacing.md, flexDirection: "row", gap: spacing.sm, alignItems: "flex-start",
    backgroundColor: colors.primaryAlpha10, padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.primaryAlpha20,
  },
  infoText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20, flex: 1 },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row",
    alignItems: "center", padding: spacing.lg, gap: spacing.md,
    backgroundColor: colors.bgPaper, borderTopWidth: 1, borderTopColor: colors.borderSoft,
  },
  bottomLabel: { color: colors.text, fontWeight: "800", fontSize: fontSize.lg },
  bottomSub: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
  payBtn: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 14, paddingHorizontal: 22, flexDirection: "row", gap: 8, alignItems: "center",
  },
  payBtnText: { color: colors.primaryContrast, fontWeight: "800", fontSize: fontSize.md },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.md },
  emptyText: { color: colors.textSecondary, fontSize: fontSize.md },
  primaryBtn: {
    backgroundColor: colors.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: radius.pill, marginTop: spacing.md,
  },
  primaryBtnText: { color: colors.primaryContrast, fontWeight: "800" },
});
