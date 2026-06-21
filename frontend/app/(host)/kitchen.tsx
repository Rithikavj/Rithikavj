import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, loadUser } from "@/src/api";
import { colors, fontSize, radius, spacing } from "@/src/theme";

const NEXT: Record<string, { label: string; next: string } | null> = {
  confirmed: { label: "Mark as Preparing (when seated)", next: "preparing" },
  table_ready: { label: "Mark as Preparing", next: "preparing" },
  preparing: { label: "Mark as Ready to Serve", next: "ready_to_serve" },
  ready_to_serve: { label: "Mark as Served", next: "served" },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  confirmed: { label: "Confirmed · Awaiting seating", color: colors.info },
  table_ready: { label: "Table Ready", color: colors.warning },
  preparing: { label: "Preparing", color: colors.primary },
  ready_to_serve: { label: "Ready to Serve", color: colors.primary },
};

export default function Kitchen() {
  const [orders, setOrders] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const u = await loadUser();
    if (!u) return;
    setUserId(u.id);
    try {
      const list = await api.hostOrders(u.id);
      setOrders(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.h1}>Kitchen</Text>
        <Text style={styles.sub}>{orders.length} active orders · Live</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}
          renderItem={({ item }) => {
            const meta = STATUS_META[item.status] || { label: item.status, color: colors.textSecondary };
            const advance = NEXT[item.status];
            return (
              <View style={styles.card} testID={`kitchen-order-${item.short_id}`}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.orderId}>#{item.short_id}</Text>
                    <Text style={styles.orderTime}>
                      {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  {item.table_number ? (
                    <View style={styles.tableTag}>
                      <Text style={styles.tableTagText}>Table {item.table_number}</Text>
                    </View>
                  ) : (
                    <View style={[styles.tableTag, { backgroundColor: colors.bgElevated, borderColor: colors.border }]}>
                      <Text style={[styles.tableTagText, { color: colors.textSecondary }]}>No table yet</Text>
                    </View>
                  )}
                </View>

                <View style={styles.itemsBlock}>
                  {item.items.map((it: any) => (
                    <View key={it.menu_item_id} style={styles.lineRow}>
                      <Text style={styles.lineQty}>{it.qty}×</Text>
                      <Text style={styles.lineName}>{it.name}</Text>
                    </View>
                  ))}
                </View>

                <View style={styles.statusRow}>
                  <View style={[styles.statusPill, { backgroundColor: meta.color + "22", borderColor: meta.color }]}>
                    <View style={[styles.dot, { backgroundColor: meta.color }]} />
                    <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                  </View>
                  <Text style={styles.total}>₹{item.total}</Text>
                </View>

                {advance && item.status !== "confirmed" && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={async () => {
                      if (!userId) return;
                      await api.hostUpdateOrderStatus(userId, item.id, advance.next);
                      await load();
                    }}
                    testID={`advance-${item.short_id}`}
                  >
                    <Text style={styles.actionText}>{advance.label}</Text>
                    <Feather name="chevron-right" size={16} color={colors.primaryContrast} />
                  </TouchableOpacity>
                )}
                {item.status === "confirmed" && (
                  <View style={styles.hint}>
                    <Feather name="info" size={14} color={colors.warning} />
                    <Text style={styles.hintText}>Will start cooking when the diner is seated.</Text>
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="clipboard" size={36} color={colors.textMuted} />
              <Text style={styles.emptyText}>No active orders right now.</Text>
              <Text style={styles.emptyDesc}>Pre-orders will appear here in real-time.</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md },
  h1: { color: colors.text, fontSize: 26, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.borderSoft, gap: spacing.md,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderId: { color: colors.text, fontWeight: "800", fontSize: fontSize.lg },
  orderTime: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
  tableTag: {
    backgroundColor: colors.primaryAlpha10, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.primary,
  },
  tableTagText: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  itemsBlock: { gap: 4, paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.borderSoft, borderBottomWidth: 1, borderBottomColor: colors.borderSoft },
  lineRow: { flexDirection: "row", paddingVertical: 4, gap: spacing.sm, alignItems: "center" },
  lineQty: { color: colors.primary, fontWeight: "800", width: 26 },
  lineName: { color: colors.text, flex: 1 },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: "700" },
  total: { color: colors.text, fontWeight: "800", fontSize: fontSize.md },
  actionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: colors.primary, paddingVertical: 12, borderRadius: radius.pill,
  },
  actionText: { color: colors.primaryContrast, fontWeight: "800" },
  hint: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "rgba(245, 158, 11, 0.1)", padding: spacing.sm, borderRadius: radius.sm,
  },
  hintText: { color: colors.textSecondary, fontSize: fontSize.xs },
  empty: { padding: spacing.xxl, alignItems: "center", gap: spacing.md, marginTop: 40 },
  emptyText: { color: colors.text, fontWeight: "700", fontSize: fontSize.md },
  emptyDesc: { color: colors.textSecondary, textAlign: "center", maxWidth: 280, lineHeight: 20, fontSize: fontSize.sm },
});
