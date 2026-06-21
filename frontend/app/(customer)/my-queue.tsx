import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, ScrollView,
  StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, loadUser } from "@/src/api";
import { colors, fontSize, radius, spacing } from "@/src/theme";

export default function MyQueue() {
  const router = useRouter();
  const [entries, setEntries] = useState<any[]>([]);
  const [active, setActive] = useState<any | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const u = await loadUser();
    if (!u) return;
    setUserId(u.id);
    try {
      const list = await api.myQueue(u.id);
      const visible = list.filter((e: any) => e.status !== "cancelled");
      setEntries(visible);
      // Active = first waiting/notified
      const first = visible.find((e: any) => e.status === "waiting" || e.status === "notified");
      if (first) {
        const detail = await api.getQueueEntry(first.id);
        setActive(detail);
      } else {
        setActive(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      </SafeAreaView>
    );
  }

  if (!active) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.header}>
          <Text style={styles.h1}>My Queue</Text>
        </View>
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Feather name="users" size={40} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>You're not in any queue yet</Text>
          <Text style={styles.emptyDesc}>
            Discover restaurants nearby and join a virtual queue to skip the wait.
          </Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/(customer)/discover")}
            testID="discover-cta"
          >
            <Text style={styles.primaryBtnText}>Discover Restaurants</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isNotified = active.status === "notified";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.h1}>My Queue</Text>
        <TouchableOpacity
          onPress={() => router.push("/notifications")}
          style={styles.bell}
          testID="notifications-btn"
        >
          <Feather name="bell" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        {/* Position card */}
        <View style={[styles.statusCard, isNotified && styles.statusCardReady]} testID="queue-status-card">
          <View style={styles.statusTop}>
            <Text style={styles.statusLabel}>Your Status</Text>
            <View style={styles.pulseDot}>
              <View style={styles.pulseDotInner} />
            </View>
          </View>
          <View style={styles.statusRow}>
            <View>
              <Text style={styles.bigNumber}>{active.position}</Text>
              <Text style={styles.bigLabel}>You are number</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={[styles.bigNumber, { fontSize: 40 }]}>{active.eta_min}</Text>
              <Text style={styles.bigLabel}>min · Est. wait</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.restRow}>
            {active.restaurant_image ? (
              <Image source={{ uri: active.restaurant_image }} style={styles.restThumb} contentFit="cover" />
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.restName}>{active.restaurant_name}</Text>
              <Text style={styles.restMeta}>
                {active.party_size} {active.party_size === 1 ? "Person" : "People"} · Joined at{" "}
                {new Date(active.joined_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          </View>

          {isNotified && (
            <View style={styles.readyBanner}>
              <Feather name="check-circle" size={18} color={colors.primary} />
              <Text style={styles.readyText}>
                Table {active.table_number} is ready! Tap "I'm Seated" once you arrive.
              </Text>
            </View>
          )}

          <View style={styles.actions}>
            {isNotified ? (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={async () => {
                  if (!userId) return;
                  await api.markSelfSeated(userId, active.id);
                  load();
                }}
                testID="im-seated-btn"
              >
                <Feather name="check" size={18} color={colors.primaryContrast} />
                <Text style={styles.primaryBtnText}>I'm Seated</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => router.push(`/menu/${active.restaurant_id}?queueId=${active.id}`)}
                testID="preorder-from-queue-btn"
              >
                <Feather name="shopping-bag" size={16} color={colors.primary} />
                <Text style={styles.secondaryBtnText}>Pre-order Food</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={async () => {
                if (!userId) return;
                await api.cancelQueue(userId, active.id);
                load();
              }}
              testID="leave-queue-btn"
            >
              <Text style={styles.dangerBtnText}>Leave Queue</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Live Queue list */}
        <Text style={styles.sectionTitle}>Live Queue</Text>
        <View style={styles.queueList}>
          {(active.live_queue || []).map((q: any) => (
            <View
              key={q.id}
              style={[styles.queueRow, q.is_you && styles.queueRowYou]}
              testID={q.is_you ? "queue-row-you" : `queue-row-${q.position}`}
            >
              <View style={[styles.qPos, q.is_you && { backgroundColor: colors.primary }]}>
                <Text style={[styles.qPosText, q.is_you && { color: colors.primaryContrast }]}>{q.position}</Text>
              </View>
              <Text style={[styles.qName, q.is_you && { color: colors.primary, fontWeight: "800" }]}>
                {q.is_you ? "You" : q.user_name} · Party of {q.party_size}
              </Text>
              {q.status === "notified" ? (
                <View style={styles.notifiedPill}>
                  <Text style={styles.notifiedPillText}>Table ready</Text>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  h1: { color: colors.text, fontSize: 26, fontWeight: "800" },
  bell: {
    width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bgCard,
    alignItems: "center", justifyContent: "center",
  },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xl, gap: spacing.md },
  emptyIcon: {
    width: 96, height: 96, borderRadius: radius.pill,
    backgroundColor: colors.primaryAlpha10, alignItems: "center", justifyContent: "center",
  },
  emptyTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: "700" },
  emptyDesc: { color: colors.textSecondary, textAlign: "center", fontSize: fontSize.md, lineHeight: 22, maxWidth: 280 },
  statusCard: {
    backgroundColor: "#0E2C26", borderRadius: radius.xl, padding: spacing.lg,
    borderWidth: 1, borderColor: "#1f5a4d",
  },
  statusCardReady: { borderColor: colors.primary, backgroundColor: "#0F3A30" },
  statusTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  statusLabel: { color: colors.primary, fontSize: fontSize.sm, fontWeight: "700", letterSpacing: 0.5 },
  pulseDot: {
    width: 22, height: 22, borderRadius: radius.pill,
    backgroundColor: colors.primaryAlpha20, alignItems: "center", justifyContent: "center",
  },
  pulseDotInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  statusRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: spacing.lg },
  bigNumber: { color: colors.text, fontSize: 52, fontWeight: "800", letterSpacing: -1 },
  bigLabel: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  divider: { height: 1, backgroundColor: colors.borderSoft, marginVertical: spacing.lg },
  restRow: { flexDirection: "row", gap: spacing.md, alignItems: "center" },
  restThumb: { width: 50, height: 50, borderRadius: radius.md },
  restName: { color: colors.text, fontSize: fontSize.md, fontWeight: "700" },
  restMeta: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  readyBanner: {
    flexDirection: "row", gap: spacing.sm, alignItems: "flex-start",
    backgroundColor: colors.primaryAlpha10, padding: spacing.md, borderRadius: radius.md, marginTop: spacing.md,
    borderWidth: 1, borderColor: colors.primaryAlpha20,
  },
  readyText: { color: colors.text, fontSize: fontSize.sm, flex: 1, lineHeight: 20 },
  actions: { marginTop: spacing.lg, gap: spacing.sm },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 14,
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.sm,
  },
  primaryBtnText: { color: colors.primaryContrast, fontWeight: "800", fontSize: fontSize.md },
  secondaryBtn: {
    borderWidth: 1, borderColor: colors.primary, borderRadius: radius.pill, paddingVertical: 13,
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: spacing.sm,
  },
  secondaryBtnText: { color: colors.primary, fontWeight: "700", fontSize: fontSize.md },
  dangerBtn: { paddingVertical: 10, alignItems: "center", justifyContent: "center" },
  dangerBtnText: { color: colors.textSecondary, fontWeight: "600", fontSize: fontSize.sm },
  sectionTitle: { color: colors.text, fontWeight: "700", fontSize: fontSize.lg, marginTop: spacing.xl, marginBottom: spacing.md },
  queueList: { backgroundColor: colors.bgCard, borderRadius: radius.lg, overflow: "hidden" },
  queueRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  queueRowYou: { backgroundColor: colors.primaryAlpha10 },
  qPos: {
    width: 30, height: 30, borderRadius: radius.pill, backgroundColor: colors.bgElevated,
    alignItems: "center", justifyContent: "center",
  },
  qPosText: { color: colors.textSecondary, fontWeight: "700" },
  qName: { color: colors.text, flex: 1, fontSize: fontSize.sm },
  notifiedPill: {
    backgroundColor: colors.primaryAlpha20, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
  },
  notifiedPillText: { color: colors.primary, fontSize: 10, fontWeight: "800" },
});
