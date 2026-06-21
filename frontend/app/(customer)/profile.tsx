import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, clearUser, loadUser, User } from "@/src/api";
import { colors, fontSize, radius, spacing } from "@/src/theme";

export default function Profile() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [pass, setPass] = useState<any | null>(null);

  useFocusEffect(useCallback(() => {
    (async () => {
      const u = await loadUser();
      setUser(u);
      if (u?.id) {
        try { setPass(await api.getPass(u.id)); } catch {}
      }
    })();
  }, []));

  const passActive = pass?.active;
  const expiresLabel = pass?.expires_at
    ? new Date(pass.expires_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <View style={styles.header}>
          <Text style={styles.h1}>Profile</Text>
        </View>

        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user?.name?.[0]?.toUpperCase() || "D"}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name || "Diner"}</Text>
            <Text style={styles.phone}>+91 {user?.phone || ""}</Text>
          </View>
        </View>

        {/* Premium teaser / active card */}
        <TouchableOpacity
          style={styles.passCard}
          onPress={() => router.push("/pass")}
          activeOpacity={0.9}
          testID="dineiq-pass-card"
        >
          <View style={styles.passHeader}>
            <View style={styles.passBadge}>
              <Feather name="zap" size={14} color={colors.primary} />
              <Text style={styles.passBadgeText}>{passActive ? "ACTIVE" : "PREMIUM"}</Text>
            </View>
            <Feather name="chevron-right" size={18} color={colors.primary} />
          </View>
          <Text style={styles.passTitle}>DineIQ Pass</Text>
          {passActive ? (
            <Text style={styles.passSub}>
              You're on the {pass.plan === "yearly" ? "Yearly" : "Monthly"} plan · Renews {expiresLabel}
            </Text>
          ) : (
            <Text style={styles.passSub}>
              Skip ahead 1-2 spots in queues, group booking & ETA alerts for favourite spots.
            </Text>
          )}
          <View style={styles.passFeatures}>
            <PassFeature icon="zap" text="Priority Queue Access" />
            <PassFeature icon="users" text="Group Booking" />
            <PassFeature icon="bell" text="Favourite Restaurant Alerts" />
          </View>
          <View style={styles.passBtn} testID="passes-cta">
            <Text style={styles.passBtnText}>
              {passActive ? "Manage Subscription" : "Get DineIQ Pass · ₹99/month"}
            </Text>
          </View>
        </TouchableOpacity>

        <View style={styles.list}>
          <Row icon="bell" label="Notifications" onPress={() => router.push("/notifications")} testID="profile-notifications" />
          <Row icon="map-pin" label="Saved Addresses" onPress={() => {}} testID="profile-addresses" />
          <Row icon="credit-card" label="Payment Methods" onPress={() => {}} testID="profile-payment" />
          <Row icon="help-circle" label="Help & Support" onPress={() => {}} testID="profile-help" />
          <Row icon="repeat" label="Switch to Restaurant Host" onPress={async () => {
            await clearUser();
            router.replace("/login");
          }} testID="switch-role" />
          <Row
            icon="log-out"
            label="Log Out"
            danger
            onPress={async () => {
              await clearUser();
              router.replace("/login");
            }}
            testID="logout-btn"
          />
        </View>

        <Text style={styles.footer}>DineIQ · v1.0 MVP{"\n"}Know before you go. Order before you sit.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function PassFeature({ icon, text }: any) {
  return (
    <View style={styles.feat}>
      <Feather name={icon} size={14} color={colors.primary} />
      <Text style={styles.featText}>{text}</Text>
    </View>
  );
}

function Row({ icon, label, onPress, danger, testID }: any) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} testID={testID}>
      <View style={styles.rowIcon}>
        <Feather name={icon} size={18} color={danger ? colors.error : colors.text} />
      </View>
      <Text style={[styles.rowLabel, danger && { color: colors.error }]}>{label}</Text>
      <Feather name="chevron-right" size={18} color={colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { marginBottom: spacing.lg },
  h1: { color: colors.text, fontSize: 26, fontWeight: "800" },
  userCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.lg,
  },
  avatar: {
    width: 60, height: 60, borderRadius: radius.pill,
    backgroundColor: colors.primaryAlpha10, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.primary,
  },
  avatarText: { color: colors.primary, fontSize: 24, fontWeight: "800" },
  name: { color: colors.text, fontSize: fontSize.xl, fontWeight: "700" },
  phone: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  passCard: {
    marginTop: spacing.lg, backgroundColor: "#0E2C26", borderRadius: radius.xl,
    padding: spacing.lg, borderWidth: 1, borderColor: colors.primary,
  },
  passHeader: { flexDirection: "row", alignItems: "center" },
  passBadge: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.primaryAlpha20, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: radius.pill,
  },
  passBadgeText: { color: colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  passTitle: { color: colors.text, fontSize: 26, fontWeight: "800", marginTop: spacing.md },
  passSub: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 22, marginTop: spacing.sm },
  passFeatures: { marginTop: spacing.lg, gap: spacing.sm },
  feat: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  featText: { color: colors.text, fontSize: fontSize.sm },
  passBtn: {
    marginTop: spacing.lg, backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 14, alignItems: "center", justifyContent: "center",
  },
  passBtnText: { color: colors.primaryContrast, fontWeight: "800", fontSize: fontSize.md },
  list: { marginTop: spacing.lg, backgroundColor: colors.bgCard, borderRadius: radius.lg, overflow: "hidden" },
  row: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    paddingHorizontal: spacing.md, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.bgElevated,
    alignItems: "center", justifyContent: "center",
  },
  rowLabel: { flex: 1, color: colors.text, fontSize: fontSize.md, fontWeight: "600" },
  footer: { textAlign: "center", color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.xl, lineHeight: 18 },
});
