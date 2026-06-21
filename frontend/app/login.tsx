import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, Role, saveUser } from "@/src/api";
import { colors, fontSize, radius, spacing } from "@/src/theme";

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState<"role" | "phone" | "otp">("role");
  const [role, setRole] = useState<Role>("customer");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const sendOtp = async () => {
    setErr(null);
    if (phone.replace(/\D/g, "").length < 10) {
      setErr("Enter a 10-digit phone number");
      return;
    }
    setLoading(true);
    try {
      await api.requestOtp(phone, role);
      setStep("otp");
      setOtp("123456");
    } catch (e: any) {
      setErr(e.message ?? "Could not send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verify = async () => {
    setErr(null);
    if (!/^\d{6}$/.test(otp)) {
      setErr("Enter the 6-digit OTP");
      return;
    }
    setLoading(true);
    try {
      const { user } = await api.verifyOtp(phone, otp, role, name || undefined);
      await saveUser(user);
      if (user.role === "host") router.replace("/(host)/dashboard");
      else router.replace("/(customer)/discover");
    } catch (e: any) {
      setErr(e.message ?? "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brandRow}>
            <View style={styles.logoSmall}>
              <Text style={styles.logoSmallQ}>Q</Text>
            </View>
            <Text style={styles.brand}>DineIQ</Text>
          </View>

          {step === "role" && (
            <View style={styles.block} testID="role-step">
              <Text style={styles.h1}>Welcome</Text>
              <Text style={styles.sub}>Choose how you'll use DineIQ today.</Text>

              <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
                <RoleCard
                  active={role === "customer"}
                  onPress={() => setRole("customer")}
                  icon="user"
                  title="I'm a Diner"
                  desc="Discover restaurants, skip the wait, pre-order food."
                  testID="role-customer"
                />
                <RoleCard
                  active={role === "host"}
                  onPress={() => setRole("host")}
                  icon="briefcase"
                  title="I'm a Restaurant Host"
                  desc="Manage your live queue and incoming pre-orders."
                  testID="role-host"
                />
              </View>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => setStep("phone")}
                testID="role-continue-btn"
              >
                <Text style={styles.primaryBtnText}>Continue</Text>
                <Feather name="arrow-right" size={18} color={colors.primaryContrast} />
              </TouchableOpacity>
            </View>
          )}

          {step === "phone" && (
            <View style={styles.block} testID="phone-step">
              <TouchableOpacity onPress={() => setStep("role")} style={styles.backBtn} testID="back-to-role">
                <Feather name="arrow-left" size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.h1}>Sign in</Text>
              <Text style={styles.sub}>
                We'll send you a 6-digit OTP. {role === "host" ? "Host login" : "Diner login"}.
              </Text>

              <Text style={styles.label}>Your name</Text>
              <TextInput
                placeholder={role === "host" ? "e.g. Murugan Host" : "e.g. Arjun"}
                placeholderTextColor={colors.textMuted}
                value={name}
                onChangeText={setName}
                style={styles.input}
                testID="name-input"
              />

              <Text style={styles.label}>Phone number</Text>
              <View style={styles.phoneRow}>
                <View style={styles.cc}><Text style={styles.ccText}>+91</Text></View>
                <TextInput
                  placeholder="98765 43210"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  style={[styles.input, { flex: 1 }]}
                  maxLength={10}
                  testID="phone-input"
                />
              </View>

              {err && <Text style={styles.err} testID="login-error">{err}</Text>}

              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
                onPress={sendOtp}
                disabled={loading}
                testID="send-otp-btn"
              >
                {loading ? <ActivityIndicator color={colors.primaryContrast} /> : (
                  <>
                    <Text style={styles.primaryBtnText}>Send OTP</Text>
                    <Feather name="arrow-right" size={18} color={colors.primaryContrast} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}

          {step === "otp" && (
            <View style={styles.block} testID="otp-step">
              <TouchableOpacity onPress={() => setStep("phone")} style={styles.backBtn} testID="back-to-phone">
                <Feather name="arrow-left" size={20} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.h1}>Verify OTP</Text>
              <Text style={styles.sub}>
                We sent a 6-digit OTP to +91 {phone}.{"\n"}
                <Text style={{ color: colors.primary }}>Use 123456 for demo</Text>.
              </Text>

              <TextInput
                value={otp}
                onChangeText={setOtp}
                placeholder="• • • • • •"
                placeholderTextColor={colors.textMuted}
                keyboardType="number-pad"
                maxLength={6}
                style={[styles.input, styles.otpInput]}
                testID="otp-input"
              />

              {err && <Text style={styles.err} testID="otp-error">{err}</Text>}

              <TouchableOpacity
                style={[styles.primaryBtn, loading && { opacity: 0.6 }]}
                onPress={verify}
                disabled={loading}
                testID="verify-otp-btn"
              >
                {loading ? <ActivityIndicator color={colors.primaryContrast} /> : (
                  <>
                    <Text style={styles.primaryBtnText}>Verify & Continue</Text>
                    <Feather name="arrow-right" size={18} color={colors.primaryContrast} />
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function RoleCard({ active, onPress, icon, title, desc, testID }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.roleCard, active && styles.roleCardActive]}
      testID={testID}
    >
      <View style={[styles.roleIcon, active && { backgroundColor: colors.primaryAlpha20 }]}>
        <Feather name={icon} size={20} color={active ? colors.primary : colors.textSecondary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.roleTitle, active && { color: colors.primary }]}>{title}</Text>
        <Text style={styles.roleDesc}>{desc}</Text>
      </View>
      <View style={[styles.radio, active && styles.radioActive]}>
        {active && <View style={styles.radioDot} />}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: spacing.xl, paddingBottom: spacing.xxl, flexGrow: 1 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, marginBottom: spacing.xl },
  logoSmall: {
    width: 40, height: 40, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  logoSmallQ: { color: colors.primary, fontSize: 22, fontWeight: "300", marginTop: -3 },
  brand: { color: colors.text, fontSize: 24, fontWeight: "800" },
  block: { flex: 1 },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.pill,
    backgroundColor: colors.bgCard, alignItems: "center", justifyContent: "center",
    marginBottom: spacing.lg,
  },
  h1: { color: colors.text, fontSize: 30, fontWeight: "800", marginBottom: spacing.sm },
  sub: { color: colors.textSecondary, fontSize: fontSize.md, lineHeight: 22 },
  label: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing.lg, marginBottom: spacing.sm },
  input: {
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 14,
    color: colors.text, fontSize: fontSize.md,
  },
  phoneRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  cc: {
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.lg, paddingVertical: 14,
  },
  ccText: { color: colors.text, fontSize: fontSize.md, fontWeight: "600" },
  otpInput: { letterSpacing: 8, textAlign: "center", fontSize: 24, fontWeight: "700", marginTop: spacing.lg },
  err: { color: colors.error, marginTop: spacing.md, fontSize: fontSize.sm },
  primaryBtn: {
    marginTop: spacing.xl, backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 16, alignItems: "center", justifyContent: "center",
    flexDirection: "row", gap: spacing.sm,
  },
  primaryBtnText: { color: colors.primaryContrast, fontWeight: "800", fontSize: fontSize.md },
  roleCard: {
    flexDirection: "row", alignItems: "center", gap: spacing.md,
    padding: spacing.lg, backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  roleCardActive: { borderColor: colors.primary, backgroundColor: colors.primaryAlpha10 },
  roleIcon: {
    width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.bgElevated,
    alignItems: "center", justifyContent: "center",
  },
  roleTitle: { color: colors.text, fontWeight: "700", fontSize: fontSize.md },
  roleDesc: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  radio: {
    width: 22, height: 22, borderRadius: radius.pill, borderWidth: 2,
    borderColor: colors.border, alignItems: "center", justifyContent: "center",
  },
  radioActive: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
});
