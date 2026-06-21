import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, clearUser, loadUser, User } from "@/src/api";
import { colors, fontSize, radius, spacing } from "@/src/theme";

export default function HostProfile() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [restaurantName, setRestaurantName] = useState("");

  useFocusEffect(useCallback(() => {
    (async () => {
      const u = await loadUser();
      setUser(u);
      if (u?.id) {
        try {
          const d = await api.hostDashboard(u.id);
          setRestaurantName(d.restaurant.name);
        } catch {}
      }
    })();
  }, []));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}>
        <Text style={styles.h1}>Profile</Text>

        <View style={styles.userCard}>
          <View style={styles.avatar}>
            <Feather name="briefcase" size={24} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{user?.name}</Text>
            <Text style={styles.phone}>{restaurantName ? `Host · ${restaurantName}` : "Host"}</Text>
            <Text style={styles.phone}>+91 {user?.phone}</Text>
          </View>
        </View>

        <View style={styles.list}>
          <Row icon="book-open" label="Menu Editor" onPress={() => router.push("/host/menu-editor")} testID="host-menu" />
          <Row icon="settings" label="Restaurant Settings" onPress={() => router.push("/host/edit-restaurant")} testID="host-settings" />
          <Row icon="bar-chart-2" label="Analytics" onPress={() => router.push("/host/analytics")} testID="host-analytics" />
          <Row icon="users" label="Staff & Roles" testID="host-staff" />
          <Row icon="help-circle" label="Help & Support" testID="host-help" />
          <Row
            icon="repeat"
            label="Switch to Diner"
            onPress={async () => {
              await clearUser();
              router.replace("/login");
            }}
            testID="switch-role"
          />
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

        <Text style={styles.footer}>DineIQ Host · v1.0 MVP</Text>
      </ScrollView>
    </SafeAreaView>
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
  h1: { color: colors.text, fontSize: 26, fontWeight: "800", marginBottom: spacing.lg },
  userCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.lg,
  },
  avatar: {
    width: 60, height: 60, borderRadius: radius.pill,
    backgroundColor: colors.primaryAlpha10, alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.primary,
  },
  name: { color: colors.text, fontSize: fontSize.xl, fontWeight: "700" },
  phone: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
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
  footer: { textAlign: "center", color: colors.textMuted, fontSize: fontSize.xs, marginTop: spacing.xl },
});
