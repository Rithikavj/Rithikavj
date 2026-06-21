import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, loadUser } from "@/src/api";
import { colors, fontSize, radius, spacing, waitColor } from "@/src/theme";

export default function Dashboard() {
  const [d, setD] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [user, setUser] = useState<any | null>(null);

  const load = useCallback(async () => {
    const u = await loadUser();
    if (!u) return;
    setUser(u);
    try {
      const data = await api.hostDashboard(u.id);
      setD(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    const t = setInterval(load, 6000);
    return () => clearInterval(t);
  }, [load]);

  if (loading || !d) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const w = d.current_wait_min;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
          />
        }
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greet}>Welcome back,</Text>
            <Text style={styles.host}>{user?.name}</Text>
          </View>
          <View style={styles.live}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>Live</Text>
          </View>
        </View>

        {/* Restaurant card */}
        <View style={styles.restCard}>
          <Image source={{ uri: d.restaurant.image }} style={styles.restImage} contentFit="cover" />
          <View style={{ flex: 1 }}>
            <Text style={styles.restName}>{d.restaurant.name}</Text>
            <Text style={styles.restSub}>{d.restaurant.area}, {d.restaurant.city}</Text>
          </View>
        </View>

        {/* KPI grid */}
        <View style={styles.grid}>
          <KPI
            label="Current Wait"
            value={`${w}`}
            unit="min"
            color={waitColor(w)}
            icon="clock"
            testID="kpi-wait"
          />
          <KPI
            label="In Queue"
            value={`${d.waiting + d.notified}`}
            unit={d.waiting + d.notified === 1 ? "party" : "parties"}
            color={colors.primary}
            icon="users"
            testID="kpi-queue"
          />
          <KPI
            label="Seated Today"
            value={`${d.seated_today}`}
            unit="parties"
            color={colors.info}
            icon="check-circle"
            testID="kpi-seated"
          />
          <KPI
            label="Pending Orders"
            value={`${d.pending_orders}`}
            unit="orders"
            color={colors.warning}
            icon="clipboard"
            testID="kpi-orders"
          />
        </View>

        {/* Insights card */}
        <View style={styles.insight}>
          <Text style={styles.insightTitle}>Today's Snapshot</Text>
          <Text style={styles.insightText}>
            • {d.waiting} {d.waiting === 1 ? "party is" : "parties are"} waiting · {d.notified} notified to come in{"\n"}
            • Capacity: {d.restaurant.capacity} tables · Base wait: {d.restaurant.base_wait_min} min{"\n"}
            • Recalculating ETA every 5 seconds — diners get live updates.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function KPI({ label, value, unit, color, icon, testID }: any) {
  return (
    <View style={styles.kpi} testID={testID}>
      <View style={[styles.kpiIcon, { backgroundColor: color + "22", borderColor: color }]}>
        <Feather name={icon} size={16} color={color} />
      </View>
      <Text style={styles.kpiLabel}>{label}</Text>
      <View style={styles.kpiRow}>
        <Text style={[styles.kpiValue, { color }]}>{value}</Text>
        <Text style={styles.kpiUnit}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.lg },
  greet: { color: colors.textSecondary, fontSize: fontSize.sm },
  host: { color: colors.text, fontSize: 22, fontWeight: "800" },
  live: {
    flexDirection: "row", gap: 6, alignItems: "center",
    backgroundColor: colors.primaryAlpha10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.primary,
  },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  liveText: { color: colors.primary, fontWeight: "700", fontSize: 11 },
  restCard: {
    flexDirection: "row", gap: spacing.md, alignItems: "center",
    backgroundColor: colors.bgCard, padding: spacing.md, borderRadius: radius.lg,
  },
  restImage: { width: 60, height: 60, borderRadius: radius.md },
  restName: { color: colors.text, fontWeight: "700", fontSize: fontSize.md },
  restSub: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, marginTop: spacing.lg },
  kpi: {
    width: "47%", backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.borderSoft, gap: 8,
  },
  kpiIcon: { width: 32, height: 32, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  kpiLabel: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: "600", letterSpacing: 0.4 },
  kpiRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
  kpiValue: { fontSize: 30, fontWeight: "800" },
  kpiUnit: { color: colors.textSecondary, fontSize: fontSize.sm },
  insight: {
    marginTop: spacing.lg, backgroundColor: "#0E2C26", borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: "#1f5a4d",
  },
  insightTitle: { color: colors.primary, fontWeight: "800", fontSize: fontSize.md, marginBottom: spacing.sm },
  insightText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 22 },
});
