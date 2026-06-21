import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { colors, fontSize, radius, spacing } from "@/src/theme";

export default function HostSetup() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.wrap}>
        <View style={styles.brandRow}>
          <View style={styles.logo}><Text style={styles.logoQ}>Q</Text></View>
          <Text style={styles.brand}>DineIQ</Text>
        </View>

        <Text style={styles.h1}>Set up your restaurant</Text>
        <Text style={styles.sub}>
          Choose how you'd like to start managing your restaurant on DineIQ.
        </Text>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => router.push("/host/create-restaurant")}
          activeOpacity={0.9}
          testID="setup-create-btn"
        >
          <View style={styles.optionIcon}>
            <Feather name="plus-circle" size={26} color={colors.primary} />
          </View>
          <Text style={styles.optionTitle}>Add a new restaurant</Text>
          <Text style={styles.optionDesc}>
            Not yet on DineIQ? Create your restaurant profile in under 60 seconds.
          </Text>
          <View style={styles.optionCta}>
            <Text style={styles.optionCtaText}>Get started</Text>
            <Feather name="arrow-right" size={16} color={colors.primary} />
          </View>
        </TouchableOpacity>

        <Text style={styles.divider}>OR</Text>

        <TouchableOpacity
          style={styles.optionCard}
          onPress={() => router.push("/host/claim-restaurant")}
          activeOpacity={0.9}
          testID="setup-claim-btn"
        >
          <View style={styles.optionIcon}>
            <Feather name="award" size={26} color={colors.primary} />
          </View>
          <Text style={styles.optionTitle}>Claim an existing restaurant</Text>
          <Text style={styles.optionDesc}>
            Restaurant already listed? Claim it and start managing your queue & menu.
          </Text>
          <View style={styles.optionCta}>
            <Text style={styles.optionCtaText}>Browse listings</Text>
            <Feather name="arrow-right" size={16} color={colors.primary} />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { flex: 1, padding: spacing.xl, gap: spacing.lg },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, marginBottom: spacing.md },
  logo: {
    width: 40, height: 40, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  logoQ: { color: colors.primary, fontSize: 22, fontWeight: "300", marginTop: -3 },
  brand: { color: colors.text, fontSize: 24, fontWeight: "800" },
  h1: { color: colors.text, fontSize: 30, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: fontSize.md, lineHeight: 22, marginBottom: spacing.md },
  optionCard: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: spacing.xl,
    borderWidth: 1, borderColor: colors.borderSoft, gap: spacing.sm,
  },
  optionIcon: {
    width: 56, height: 56, borderRadius: radius.pill,
    backgroundColor: colors.primaryAlpha10, alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: colors.primary, marginBottom: spacing.sm,
  },
  optionTitle: { color: colors.text, fontSize: fontSize.xl, fontWeight: "800" },
  optionDesc: { color: colors.textSecondary, fontSize: fontSize.sm, lineHeight: 20 },
  optionCta: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: spacing.md },
  optionCtaText: { color: colors.primary, fontWeight: "800", fontSize: fontSize.sm },
  divider: { color: colors.textMuted, fontWeight: "700", textAlign: "center", fontSize: 12, letterSpacing: 1 },
});
