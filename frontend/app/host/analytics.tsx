import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, loadUser } from "@/src/api";
import { colors, fontSize, radius, spacing } from "@/src/theme";

export default function Analytics() {
  const router = useRouter();
  const [d, setD] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const u = await loadUser();
    if (!u) return;
    try {
      const data = await api.hostAnalytics(u.id);
      setD(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading || !d) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const s = d.summary;
  const maxHour = Math.max(...d.hourly, 1);
  const maxWeek = Math.max(...d.weekly, 1);
  const change = s.pct_change;
  const isUp = change >= 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle}>Analytics</Text>
          <Text style={styles.headerSub}>{d.restaurant.name} · Last 24h</Text>
        </View>
        <View style={styles.live}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>Live</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg }}>
        {/* Headline KPIs */}
        <View style={styles.kpiHero} testID="headline-kpis">
          <View style={{ flex: 1 }}>
            <Text style={styles.kpiHeroLabel}>Parties Today</Text>
            <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8 }}>
              <Text style={styles.kpiHeroValue}>{s.parties_today}</Text>
              <View style={[styles.changePill, { backgroundColor: (isUp ? colors.primary : colors.error) + "22" }]}>
                <Feather name={isUp ? "trending-up" : "trending-down"} size={11} color={isUp ? colors.primary : colors.error} />
                <Text style={[styles.changeText, { color: isUp ? colors.primary : colors.error }]}>
                  {isUp ? "+" : ""}{change}%
                </Text>
              </View>
            </View>
            <Text style={styles.kpiHeroFoot}>vs {s.parties_yesterday} yesterday</Text>
          </View>
          <View style={styles.kpiDivider} />
          <View style={{ flex: 1 }}>
            <Text style={styles.kpiHeroLabel}>Revenue</Text>
            <Text style={styles.kpiHeroValue}>₹{s.revenue_today.toLocaleString("en-IN")}</Text>
            <Text style={styles.kpiHeroFoot}>{s.orders_today} pre-orders</Text>
          </View>
        </View>

        {/* Hourly traffic */}
        <View style={styles.card} testID="hourly-chart">
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Hourly Traffic</Text>
            {s.peak_hour && (
              <View style={styles.peakPill}>
                <Feather name="trending-up" size={11} color={colors.warning} />
                <Text style={styles.peakText}>Peak {s.peak_hour}</Text>
              </View>
            )}
          </View>
          <View style={styles.bars} testID="hourly-bars">
            {d.hourly.map((v: number, i: number) => {
              const h = (v / maxHour) * 100;
              return (
                <View key={i} style={styles.barWrap}>
                  <View
                    style={[
                      styles.bar,
                      { height: Math.max(2, h) + "%", backgroundColor: v === maxHour && v > 0 ? colors.warning : colors.primary },
                    ]}
                  />
                </View>
              );
            })}
          </View>
          <View style={styles.axisRow}>
            <Text style={styles.axisText}>24h ago</Text>
            <Text style={styles.axisText}>12h</Text>
            <Text style={styles.axisText}>Now</Text>
          </View>
        </View>

        {/* KPI grid */}
        <View style={styles.grid}>
          <KPI label="Avg Wait" value={`${s.avg_wait_min}`} unit="min" color={colors.primary} icon="clock" testID="kpi-wait" />
          <KPI label="Seated" value={`${s.seated_today}`} unit="parties" color={colors.success} icon="check-circle" testID="kpi-seated" />
          <KPI
            label="Walk-away"
            value={`${s.walk_away_rate}`}
            unit="%"
            color={s.walk_away_rate > 10 ? colors.error : colors.warning}
            icon="user-x"
            testID="kpi-walkaway"
          />
          <KPI
            label="No-shows"
            value={`${s.no_show_rate}`}
            unit="%"
            color={s.no_show_rate > 10 ? colors.error : colors.warning}
            icon="x-circle"
            testID="kpi-noshow"
          />
        </View>

        {/* Weekly trend */}
        <View style={styles.card} testID="weekly-chart">
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Last 7 Days</Text>
            <Text style={styles.cardSub}>{d.weekly.reduce((a: number, b: number) => a + b, 0)} parties</Text>
          </View>
          <View style={styles.weekRow}>
            {d.weekly.map((v: number, i: number) => (
              <View key={i} style={styles.weekCol}>
                <View style={styles.weekBarWrap}>
                  <View style={[styles.weekBar, { height: Math.max(4, (v / maxWeek) * 90) + "%" }]} />
                </View>
                <Text style={styles.weekValue}>{v}</Text>
                <Text style={styles.weekLabel}>
                  {["6d", "5d", "4d", "3d", "2d", "1d", "Today"][i]}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Top items */}
        <View style={styles.card} testID="top-items">
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Top Selling Items</Text>
            <Text style={styles.cardSub}>Today</Text>
          </View>
          {d.top_items.length === 0 ? (
            <Text style={styles.empty}>No pre-orders today yet.</Text>
          ) : d.top_items.map((it: any, idx: number) => (
            <View key={it.id} style={styles.itemRow} testID={`top-item-${idx}`}>
              <View style={styles.itemRank}>
                <Text style={styles.itemRankText}>{idx + 1}</Text>
              </View>
              {it.image && <Image source={{ uri: it.image }} style={styles.itemImage} contentFit="cover" />}
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{it.name}</Text>
                <Text style={styles.itemMeta}>{it.qty} sold · ₹{it.revenue.toLocaleString("en-IN")}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Insight */}
        <View style={styles.insight}>
          <Text style={styles.insightTitle}>📊 Snapshot</Text>
          <Text style={styles.insightText}>
            • <Text style={{ color: colors.text }}>{s.seated_rate}%</Text> conversion (seated vs joined){"\n"}
            • <Text style={{ color: colors.text }}>{s.walk_away_rate}%</Text> walk-away rate{"\n"}
            • <Text style={{ color: colors.text }}>{s.waiting_now}</Text> parties waiting right now{"\n"}
            {s.peak_hour ? <>• Peak hour: <Text style={{ color: colors.text }}>{s.peak_hour}</Text>{"\n"}</> : null}
            • Data refreshes every visit to this screen
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
        <Feather name={icon} size={14} color={color} />
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
  live: {
    flexDirection: "row", gap: 6, alignItems: "center",
    backgroundColor: colors.primaryAlpha10, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.primary,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.primary },
  liveText: { color: colors.primary, fontWeight: "700", fontSize: 11 },

  kpiHero: {
    flexDirection: "row", backgroundColor: "#0E2C26", padding: spacing.lg,
    borderRadius: radius.xl, borderWidth: 1, borderColor: "#1f5a4d",
  },
  kpiDivider: { width: 1, backgroundColor: colors.border, marginHorizontal: spacing.md },
  kpiHeroLabel: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: "600", letterSpacing: 0.4 },
  kpiHeroValue: { color: colors.text, fontSize: 36, fontWeight: "800", marginTop: 4 },
  kpiHeroFoot: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 4 },
  changePill: { flexDirection: "row", gap: 3, alignItems: "center", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill },
  changeText: { fontSize: 11, fontWeight: "800" },

  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.md },
  cardTitle: { color: colors.text, fontWeight: "800", fontSize: fontSize.md },
  cardSub: { color: colors.textSecondary, fontSize: fontSize.xs },
  peakPill: {
    flexDirection: "row", gap: 4, alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.12)", paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
  },
  peakText: { color: colors.warning, fontSize: 11, fontWeight: "700" },

  bars: {
    flexDirection: "row", alignItems: "flex-end", height: 100, gap: 2,
  },
  barWrap: { flex: 1, height: "100%", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 3, minHeight: 2 },
  axisRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  axisText: { color: colors.textMuted, fontSize: 10 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  kpi: {
    flex: 1, minWidth: "45%", backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.borderSoft, gap: 8,
  },
  kpiIcon: { width: 32, height: 32, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  kpiLabel: { color: colors.textSecondary, fontSize: fontSize.xs, fontWeight: "600", letterSpacing: 0.4 },
  kpiRow: { flexDirection: "row", alignItems: "baseline", gap: 4 },
  kpiValue: { fontSize: 26, fontWeight: "800" },
  kpiUnit: { color: colors.textSecondary, fontSize: fontSize.sm },

  weekRow: { flexDirection: "row", justifyContent: "space-between", height: 110, gap: 6 },
  weekCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  weekBarWrap: { width: "100%", height: 70, justifyContent: "flex-end" },
  weekBar: { width: "100%", borderRadius: 4, backgroundColor: colors.primary, minHeight: 4 },
  weekValue: { color: colors.text, fontSize: 11, fontWeight: "700", marginTop: 4 },
  weekLabel: { color: colors.textMuted, fontSize: 10, marginTop: 2 },

  itemRow: {
    flexDirection: "row", gap: spacing.md, alignItems: "center", paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: colors.borderSoft,
  },
  itemRank: {
    width: 26, height: 26, borderRadius: radius.pill,
    backgroundColor: colors.primaryAlpha10, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.primary,
  },
  itemRankText: { color: colors.primary, fontWeight: "800", fontSize: 12 },
  itemImage: { width: 40, height: 40, borderRadius: radius.sm },
  itemName: { color: colors.text, fontWeight: "700" },
  itemMeta: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
  empty: { color: colors.textMuted, fontSize: fontSize.sm, textAlign: "center", padding: spacing.md },

  insight: {
    backgroundColor: "#0E2C26", borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: 1, borderColor: "#1f5a4d",
  },
  insightTitle: { color: colors.primary, fontWeight: "800", fontSize: fontSize.md, marginBottom: spacing.sm },
  insightText: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 24 },
});
