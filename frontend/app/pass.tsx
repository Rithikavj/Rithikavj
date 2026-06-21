import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, loadUser, saveUser } from "@/src/api";
import { colors, fontSize, radius, spacing } from "@/src/theme";

const BENEFITS = [
  { icon: "zap", title: "Priority Queue Access", desc: "Skip 1–2 spots ahead in every virtual queue, instantly." },
  { icon: "users", title: "Group Booking", desc: "Reserve for parties up to 12 — no more split-table chaos." },
  { icon: "bell", title: "Favourite Restaurant Alerts", desc: "Get pinged the moment your favourite spot opens up." },
  { icon: "gift", title: "Member-only Offers", desc: "Exclusive deals at top restaurants, every week." },
  { icon: "headphones", title: "Priority Support", desc: "Chat with our concierge team for last-minute changes." },
];

type Plan = "monthly" | "yearly";

export default function PassScreen() {
  const router = useRouter();
  const [plan, setPlan] = useState<Plan>("yearly");
  const [data, setData] = useState<any | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const u = await loadUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setUserId(u.id);
    try {
      const d = await api.getPass(u.id);
      setData(d);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const subscribe = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      const res = await api.subscribePass(userId, plan);
      if (res.user) await saveUser(res.user);
      await load();
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!userId) return;
    setBusy(true);
    try {
      await api.cancelPass(userId);
      await load();
    } finally {
      setBusy(false);
    }
  };

  if (loading || !data) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const isActive = data.active;
  const expiresLabel = data.expires_at
    ? new Date(data.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";
  const monthly = data.plans.monthly;
  const yearly = data.plans.yearly;
  const yearlySavings = monthly.price * 12 - yearly.price;
  const yearlyPerMonth = Math.round(yearly.price / 12);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>DineIQ Pass</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroBadge}>
            <Feather name="zap" size={14} color={colors.primary} />
            <Text style={styles.heroBadgeText}>PREMIUM MEMBERSHIP</Text>
          </View>
          <Text style={styles.heroTitle}>Dine smarter.{"\n"}Wait less.</Text>
          <Text style={styles.heroSub}>
            Skip ahead in queues, unlock member-only perks and book bigger parties — at India's best restaurants.
          </Text>

          {isActive && (
            <View style={styles.activeBanner} testID="active-pass-banner">
              <View style={styles.activeDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.activeTitle}>Pass Active · {data.plan === "yearly" ? "Yearly" : "Monthly"}</Text>
                <Text style={styles.activeSub}>Renews on {expiresLabel}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Benefits */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>What you'll unlock</Text>
          {BENEFITS.map((b) => (
            <View key={b.title} style={styles.benefit}>
              <View style={styles.benefitIcon}>
                <Feather name={b.icon as any} size={18} color={colors.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.benefitTitle}>{b.title}</Text>
                <Text style={styles.benefitDesc}>{b.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Plans */}
        {!isActive && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Choose your plan</Text>

            <TouchableOpacity
              onPress={() => setPlan("yearly")}
              activeOpacity={0.85}
              style={[styles.plan, plan === "yearly" && styles.planActive]}
              testID="plan-yearly"
            >
              <View style={styles.bestPill}>
                <Text style={styles.bestPillText}>BEST VALUE · Save ₹{yearlySavings}</Text>
              </View>
              <View style={styles.planRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planLabel}>Yearly</Text>
                  <Text style={styles.planPrice}>
                    ₹{yearly.price}
                    <Text style={styles.planPeriod}> / year</Text>
                  </Text>
                  <Text style={styles.planPerMo}>That's just ₹{yearlyPerMonth}/month</Text>
                </View>
                <View style={[styles.radio, plan === "yearly" && styles.radioActive]}>
                  {plan === "yearly" && <View style={styles.radioDot} />}
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setPlan("monthly")}
              activeOpacity={0.85}
              style={[styles.plan, plan === "monthly" && styles.planActive, { marginTop: spacing.md }]}
              testID="plan-monthly"
            >
              <View style={styles.planRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.planLabel}>Monthly</Text>
                  <Text style={styles.planPrice}>
                    ₹{monthly.price}
                    <Text style={styles.planPeriod}> / month</Text>
                  </Text>
                  <Text style={styles.planPerMo}>Cancel anytime</Text>
                </View>
                <View style={[styles.radio, plan === "monthly" && styles.radioActive]}>
                  {plan === "monthly" && <View style={styles.radioDot} />}
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* Mock-payment note */}
        <View style={styles.mockNote}>
          <Feather name="info" size={14} color={colors.warning} />
          <Text style={styles.mockNoteText}>
            Mock payment — no money charged. Razorpay/Stripe wired up post-MVP.
          </Text>
        </View>
      </ScrollView>

      {/* Sticky CTA */}
      <View style={styles.bottomBar}>
        {isActive ? (
          <>
            <View style={{ flex: 1 }}>
              <Text style={styles.bottomLabel}>You're a DineIQ Pass member 🎉</Text>
              <Text style={styles.bottomSub}>Skip ahead, save more.</Text>
            </View>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={cancel}
              disabled={busy}
              testID="cancel-pass-btn"
            >
              {busy ? <ActivityIndicator color={colors.error} /> : (
                <Text style={styles.cancelBtnText}>Cancel</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={{ flex: 1 }}>
              <Text style={styles.bottomLabel}>
                ₹{plan === "yearly" ? yearly.price : monthly.price}
              </Text>
              <Text style={styles.bottomSub}>
                Billed {plan === "yearly" ? "annually" : "monthly"} · Cancel anytime
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.subBtn, busy && { opacity: 0.6 }]}
              onPress={subscribe}
              disabled={busy}
              testID="subscribe-btn"
            >
              {busy ? <ActivityIndicator color={colors.primaryContrast} /> : (
                <>
                  <Text style={styles.subBtnText}>Subscribe</Text>
                  <Feather name="arrow-right" size={18} color={colors.primaryContrast} />
                </>
              )}
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", alignItems: "center", padding: spacing.lg, gap: spacing.sm,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bgCard,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { flex: 1, textAlign: "center", color: colors.text, fontWeight: "800", fontSize: fontSize.lg },
  hero: {
    marginHorizontal: spacing.lg, padding: spacing.xl, borderRadius: radius.xl,
    backgroundColor: "#0E2C26", borderWidth: 1, borderColor: colors.primary,
  },
  heroBadge: {
    flexDirection: "row", gap: 6, alignItems: "center", alignSelf: "flex-start",
    backgroundColor: colors.primaryAlpha20, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
  },
  heroBadgeText: { color: colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  heroTitle: { color: colors.text, fontSize: 34, fontWeight: "800", marginTop: spacing.md, lineHeight: 40 },
  heroSub: { color: colors.textSecondary, fontSize: fontSize.md, marginTop: spacing.md, lineHeight: 22 },
  activeBanner: {
    marginTop: spacing.lg, flexDirection: "row", gap: spacing.md, alignItems: "center",
    backgroundColor: colors.primaryAlpha20, padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.primary,
  },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  activeTitle: { color: colors.text, fontWeight: "800", fontSize: fontSize.md },
  activeSub: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionTitle: { color: colors.text, fontWeight: "800", fontSize: fontSize.lg, marginBottom: spacing.md },
  benefit: {
    flexDirection: "row", gap: spacing.md, alignItems: "flex-start",
    backgroundColor: colors.bgCard, padding: spacing.md, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.borderSoft, marginBottom: spacing.sm,
  },
  benefitIcon: {
    width: 40, height: 40, borderRadius: radius.pill,
    backgroundColor: colors.primaryAlpha10, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.primary,
  },
  benefitTitle: { color: colors.text, fontWeight: "700", fontSize: fontSize.md },
  benefitDesc: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 4, lineHeight: 20 },
  plan: {
    backgroundColor: colors.bgCard, padding: spacing.lg, borderRadius: radius.lg,
    borderWidth: 1.5, borderColor: colors.borderSoft, position: "relative",
  },
  planActive: { borderColor: colors.primary, backgroundColor: colors.primaryAlpha10 },
  bestPill: {
    position: "absolute", top: -12, left: spacing.md,
    backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill,
  },
  bestPillText: { color: colors.primaryContrast, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  planRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  planLabel: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: "700", letterSpacing: 0.5 },
  planPrice: { color: colors.text, fontSize: 32, fontWeight: "800", marginTop: 4 },
  planPeriod: { color: colors.textSecondary, fontSize: fontSize.md, fontWeight: "600" },
  planPerMo: { color: colors.primary, fontSize: fontSize.sm, fontWeight: "700", marginTop: 4 },
  radio: {
    width: 24, height: 24, borderRadius: radius.pill, borderWidth: 2,
    borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  mockNote: {
    marginHorizontal: spacing.lg, marginTop: spacing.lg, padding: spacing.sm,
    flexDirection: "row", gap: 6, alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.1)", borderRadius: radius.sm,
  },
  mockNoteText: { color: colors.textSecondary, fontSize: fontSize.xs, flex: 1 },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row",
    alignItems: "center", padding: spacing.lg, gap: spacing.md,
    backgroundColor: colors.bgPaper, borderTopWidth: 1, borderTopColor: colors.borderSoft,
  },
  bottomLabel: { color: colors.text, fontWeight: "800", fontSize: fontSize.lg },
  bottomSub: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
  subBtn: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 14, paddingHorizontal: 22, flexDirection: "row", gap: 8, alignItems: "center",
  },
  subBtnText: { color: colors.primaryContrast, fontWeight: "800", fontSize: fontSize.md },
  cancelBtn: {
    paddingHorizontal: 18, paddingVertical: 12, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.error,
  },
  cancelBtnText: { color: colors.error, fontWeight: "700" },
});
