import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, loadUser } from "@/src/api";
import { colors, fontSize, radius, spacing } from "@/src/theme";

const STEPS: { key: string; label: string }[] = [
  { key: "confirmed", label: "Order\nConfirmed" },
  { key: "table_ready", label: "Table\nReady" },
  { key: "preparing", label: "Preparing\nOrder" },
  { key: "ready_to_serve", label: "Ready to\nServe" },
];

function stepIndex(status: string) {
  const map: Record<string, number> = {
    confirmed: 0, table_ready: 1, preparing: 2, ready_to_serve: 3, served: 3,
  };
  return map[status] ?? 0;
}

export default function OrderTracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [order, setOrder] = useState<any | null>(null);
  const [queue, setQueue] = useState<any | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const u = await loadUser();
    setUserId(u?.id ?? null);
    const o = await api.getOrder(id);
    setOrder(o);
    if (o.queue_id) {
      try {
        const q = await api.getQueueEntry(o.queue_id);
        setQueue(q);
      } catch {}
    }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  if (!order) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const idx = stepIndex(order.status);
  const tableReady = order.status !== "confirmed";

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Tracking</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 200 }}>
        {/* Status steps */}
        <View style={styles.steps} testID="status-steps">
          {STEPS.map((s, i) => {
            const done = i < idx;
            const current = i === idx;
            return (
              <View key={s.key} style={styles.stepWrap}>
                <View style={[
                  styles.stepDot,
                  (done || current) && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}>
                  {done ? (
                    <Feather name="check" size={14} color={colors.primaryContrast} />
                  ) : current ? (
                    <View style={styles.activeInner} />
                  ) : (
                    <Feather name="circle" size={10} color={colors.textMuted} />
                  )}
                </View>
                <Text style={[styles.stepLabel, (done || current) && { color: colors.primary }]}>{s.label}</Text>
                {i < STEPS.length - 1 && (
                  <View style={[styles.stepLine, done && { backgroundColor: colors.primary }]} />
                )}
              </View>
            );
          })}
        </View>

        {/* Status hero card */}
        <View style={styles.hero} testID="hero-card">
          {tableReady ? (
            <>
              <View style={styles.cloche}>
                <View style={styles.clocheCircle}>
                  <Feather name="check-circle" size={36} color={colors.primary} />
                </View>
              </View>
              <Text style={styles.heroTitle}>
                {order.status === "preparing" ? "Order being prepared"
                  : order.status === "ready_to_serve" ? "Your order is ready!"
                  : order.status === "served" ? "Enjoy your meal!"
                  : "Your table is ready!"}
              </Text>
              <Text style={styles.heroSub}>
                {order.status === "table_ready"
                  ? "Please head to the restaurant."
                  : order.status === "preparing"
                  ? "Your order is being cooked. Sit back & relax."
                  : order.status === "ready_to_serve"
                  ? "Food is on its way to your table."
                  : "Thanks for choosing DineIQ."}
              </Text>
              {order.table_number && (
                <>
                  <Text style={styles.tableLabel}>Table</Text>
                  <Text style={styles.tableNum}>{order.table_number}</Text>
                </>
              )}
            </>
          ) : (
            <>
              <View style={styles.cloche}>
                <View style={styles.clocheCircle}>
                  <Feather name="award" size={36} color={colors.primary} />
                </View>
              </View>
              <Text style={styles.heroTitle}>Order Confirmed!</Text>
              <Text style={styles.heroSub}>
                Your order will be prepared once your table is ready.
              </Text>
            </>
          )}
        </View>

        {/* Order summary card */}
        <View style={styles.summary}>
          <View style={styles.summaryTop}>
            <Image
              source={{ uri: order.items[0]?.image || "https://images.pexels.com/photos/9619560/pexels-photo-9619560.jpeg" }}
              style={styles.thumb}
              contentFit="cover"
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.restName}>{order.restaurant_name}</Text>
              <Text style={styles.subText}>Order ID: #{order.short_id}</Text>
              <Text style={styles.subText}>{order.items.length} items · ₹{order.total}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          {order.items.map((it: any) => (
            <View key={it.menu_item_id} style={styles.lineRow}>
              <Text style={styles.lineQty}>{it.qty}×</Text>
              <Text style={styles.lineName}>{it.name}</Text>
              <Text style={styles.linePrice}>₹{it.price * it.qty}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* CTA — only when table_ready (notified) */}
      {queue && queue.status === "notified" && (
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={async () => {
              if (userId) await api.markSelfSeated(userId, queue.id);
              await load();
            }}
            testID="im-seated-btn"
          >
            <Feather name="check" size={18} color={colors.primaryContrast} />
            <Text style={styles.primaryBtnText}>I'm Seated</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
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
  headerTitle: { flex: 1, textAlign: "center", color: colors.text, fontWeight: "800", fontSize: fontSize.lg },
  steps: {
    flexDirection: "row", justifyContent: "space-between", paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  stepWrap: { flex: 1, alignItems: "center", position: "relative" },
  stepDot: {
    width: 36, height: 36, borderRadius: radius.pill,
    backgroundColor: colors.bgCard, borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center", zIndex: 2,
  },
  activeInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primaryContrast },
  stepLabel: { color: colors.textSecondary, fontSize: 11, fontWeight: "600", marginTop: 6, textAlign: "center", lineHeight: 14 },
  stepLine: {
    position: "absolute", top: 17, left: "60%", right: "-40%", height: 2,
    backgroundColor: colors.border, zIndex: 1,
  },
  hero: {
    backgroundColor: "#0E2C26", borderRadius: radius.xl, padding: spacing.xl,
    alignItems: "center", marginTop: spacing.md, borderWidth: 1, borderColor: "#1f5a4d",
  },
  cloche: { marginBottom: spacing.md },
  clocheCircle: {
    width: 90, height: 90, borderRadius: radius.pill,
    backgroundColor: colors.primaryAlpha20, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.primary,
  },
  heroTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: "800", textAlign: "center", marginTop: spacing.sm },
  heroSub: { color: colors.textSecondary, fontSize: fontSize.sm, textAlign: "center", marginTop: spacing.sm, lineHeight: 22 },
  tableLabel: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing.lg, fontWeight: "600" },
  tableNum: { color: colors.primary, fontSize: 56, fontWeight: "800", letterSpacing: -2 },
  summary: {
    marginTop: spacing.lg, backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
  },
  summaryTop: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  thumb: { width: 60, height: 60, borderRadius: radius.md },
  restName: { color: colors.text, fontWeight: "700", fontSize: fontSize.md },
  subText: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: spacing.md },
  lineRow: { flexDirection: "row", gap: spacing.md, paddingVertical: 6, alignItems: "center" },
  lineQty: { color: colors.primary, fontWeight: "800", width: 26 },
  lineName: { color: colors.text, flex: 1 },
  linePrice: { color: colors.textSecondary, fontWeight: "600" },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg,
    backgroundColor: colors.bgPaper, borderTopWidth: 1, borderTopColor: colors.borderSoft,
  },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 16, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center",
  },
  primaryBtnText: { color: colors.primaryContrast, fontWeight: "800", fontSize: fontSize.md },
});
