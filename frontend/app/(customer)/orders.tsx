import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, loadUser } from "@/src/api";
import { colors, fontSize, radius, spacing } from "@/src/theme";

const STATUS_META: Record<string, { label: string; color: string }> = {
  confirmed: { label: "Order Confirmed", color: colors.info },
  table_ready: { label: "Table Ready", color: colors.warning },
  preparing: { label: "Preparing", color: colors.primary },
  ready_to_serve: { label: "Ready to Serve", color: colors.primary },
  served: { label: "Served", color: colors.textSecondary },
  cancelled: { label: "Cancelled", color: colors.error },
};

export default function OrdersScreen() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const u = await loadUser();
    if (!u) return;
    try {
      const list = await api.myOrders(u.id);
      setOrders(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.h1}>Orders</Text>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}
        renderItem={({ item }) => {
          const meta = STATUS_META[item.status] || { label: item.status, color: colors.textSecondary };
          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/order/${item.id}`)}
              testID={`order-${item.short_id}`}
              activeOpacity={0.9}
            >
              <View style={styles.cardTop}>
                <Image
                  source={{ uri: item.items[0]?.image || "https://images.pexels.com/photos/9619560/pexels-photo-9619560.jpeg" }}
                  style={styles.thumb}
                  contentFit="cover"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.restName}>{item.restaurant_name}</Text>
                  <Text style={styles.sub}>
                    Order #{item.short_id} · {item.items.length} item{item.items.length > 1 ? "s" : ""} · ₹{item.total}
                  </Text>
                  <Text style={styles.time}>
                    {new Date(item.created_at).toLocaleString([], { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" })}
                  </Text>
                </View>
              </View>
              <View style={styles.cardBottom}>
                <View style={[styles.statusPill, { backgroundColor: meta.color + "22", borderColor: meta.color }]}>
                  <View style={[styles.dot, { backgroundColor: meta.color }]} />
                  <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                </View>
                <View style={styles.viewRow}>
                  <Text style={styles.viewText}>Track</Text>
                  <Feather name="chevron-right" size={16} color={colors.primary} />
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="clipboard" size={36} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No orders yet</Text>
            <Text style={styles.emptyDesc}>
              Pre-order food while you wait and skip the kitchen queue.
            </Text>
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => router.push("/(customer)/discover")}
              testID="discover-cta"
            >
              <Text style={styles.primaryBtnText}>Browse Restaurants</Text>
            </TouchableOpacity>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  h1: { color: colors.text, fontSize: 26, fontWeight: "800" },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  cardTop: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  thumb: { width: 60, height: 60, borderRadius: radius.md },
  restName: { color: colors.text, fontSize: fontSize.md, fontWeight: "700" },
  sub: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  time: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
  cardBottom: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.borderSoft,
  },
  statusPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  viewRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewText: { color: colors.primary, fontSize: fontSize.sm, fontWeight: "700" },
  empty: { padding: spacing.xxl, alignItems: "center", gap: spacing.md, marginTop: 40 },
  emptyIcon: {
    width: 96, height: 96, borderRadius: radius.pill,
    backgroundColor: colors.primaryAlpha10, alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: "700" },
  emptyDesc: { color: colors.textSecondary, textAlign: "center", maxWidth: 280, lineHeight: 22 },
  primaryBtn: {
    marginTop: spacing.md, backgroundColor: colors.primary,
    borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 28,
  },
  primaryBtnText: { color: colors.primaryContrast, fontWeight: "800", fontSize: fontSize.md },
});
