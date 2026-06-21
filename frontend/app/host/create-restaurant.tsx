import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, loadUser, saveUser } from "@/src/api";
import { colors, fontSize, radius, spacing } from "@/src/theme";

const CUISINES = ["South Indian", "North Indian", "Hyderabadi", "Modern Indian", "Cafe", "Bakery", "Chinese", "Italian"];
const PRICES = ["₹", "₹₹", "₹₹₹", "₹₹₹₹"];

export default function CreateRestaurant() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [cuisine, setCuisine] = useState("South Indian");
  const [address, setAddress] = useState("");
  const [area, setArea] = useState("");
  const [city, setCity] = useState("Chennai");
  const [priceLevel, setPriceLevel] = useState("₹₹");
  const [baseWait, setBaseWait] = useState("10");
  const [capacity, setCapacity] = useState("30");
  const [image, setImage] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!name.trim() || !address.trim() || !area.trim()) {
      setErr("Please fill name, address and area.");
      return;
    }
    const u = await loadUser();
    if (!u) return;
    setBusy(true);
    try {
      await api.hostCreateRestaurant(u.id, {
        name: name.trim(), cuisine, address: address.trim(), area: area.trim(), city: city.trim(),
        price_level: priceLevel,
        base_wait_min: parseInt(baseWait) || 10,
        capacity: parseInt(capacity) || 30,
        image: image.trim() || undefined,
      });
      // refresh user (now has restaurant_id)
      await saveUser({ ...u, restaurant_id: "set" } as any);
      router.replace("/(host)/dashboard");
    } catch (e: any) {
      setErr(e.message || "Could not create restaurant");
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Add Restaurant</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }} keyboardShouldPersistTaps="handled">
          <Field label="Restaurant Name *">
            <TextInput style={styles.input} value={name} onChangeText={setName}
              placeholder="e.g. Madras Mess" placeholderTextColor={colors.textMuted} testID="rest-name" />
          </Field>

          <Field label="Cuisine">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {CUISINES.map((c) => (
                <TouchableOpacity key={c}
                  onPress={() => setCuisine(c)}
                  style={[styles.chip, cuisine === c && styles.chipActive]}
                  testID={`cuisine-${c.toLowerCase().replace(/\s/g, "-")}`}
                >
                  <Text style={[styles.chipText, cuisine === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Field>

          <Field label="Address *">
            <TextInput style={styles.input} value={address} onChangeText={setAddress}
              placeholder="e.g. 18, N Usman Road" placeholderTextColor={colors.textMuted} testID="rest-address" />
          </Field>

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Field label="Area *">
                <TextInput style={styles.input} value={area} onChangeText={setArea}
                  placeholder="T. Nagar" placeholderTextColor={colors.textMuted} testID="rest-area" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="City">
                <TextInput style={styles.input} value={city} onChangeText={setCity}
                  placeholder="Chennai" placeholderTextColor={colors.textMuted} testID="rest-city" />
              </Field>
            </View>
          </View>

          <Field label="Price Level">
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              {PRICES.map((p) => (
                <TouchableOpacity key={p}
                  onPress={() => setPriceLevel(p)}
                  style={[styles.priceBtn, priceLevel === p && styles.priceBtnActive]}
                  testID={`price-${p.length}`}
                >
                  <Text style={[styles.priceText, priceLevel === p && styles.priceTextActive]}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <View style={{ flexDirection: "row", gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Field label="Base wait (min)">
                <TextInput style={styles.input} value={baseWait} onChangeText={setBaseWait}
                  keyboardType="number-pad" testID="rest-wait" />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Capacity (tables)">
                <TextInput style={styles.input} value={capacity} onChangeText={setCapacity}
                  keyboardType="number-pad" testID="rest-capacity" />
              </Field>
            </View>
          </View>

          <Field label="Cover Image URL (optional)">
            <TextInput style={styles.input} value={image} onChangeText={setImage}
              placeholder="https://..." placeholderTextColor={colors.textMuted}
              autoCapitalize="none" testID="rest-image" />
          </Field>

          {err && <Text style={styles.err}>{err}</Text>}
        </ScrollView>

        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[styles.primaryBtn, busy && { opacity: 0.6 }]}
            onPress={submit}
            disabled={busy}
            testID="create-rest-submit"
          >
            {busy ? <ActivityIndicator color={colors.primaryContrast} /> : (
              <>
                <Text style={styles.primaryBtnText}>Create Restaurant</Text>
                <Feather name="arrow-right" size={18} color={colors.primaryContrast} />
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: any) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Text style={styles.label}>{label}</Text>
      {children}
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
  headerTitle: { flex: 1, textAlign: "center", color: colors.text, fontWeight: "800", fontSize: fontSize.lg },
  label: { color: colors.textSecondary, fontSize: fontSize.sm, marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12,
    color: colors.text, fontSize: fontSize.md,
  },
  chips: { gap: spacing.sm },
  chip: {
    height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  chipActive: { backgroundColor: colors.primaryAlpha10, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: "700" },
  chipTextActive: { color: colors.primary },
  priceBtn: {
    flex: 1, paddingVertical: 12, borderRadius: radius.md,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: "center",
  },
  priceBtnActive: { backgroundColor: colors.primaryAlpha10, borderColor: colors.primary },
  priceText: { color: colors.textSecondary, fontWeight: "800" },
  priceTextActive: { color: colors.primary },
  err: { color: colors.error, marginTop: spacing.sm, fontSize: fontSize.sm },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0, padding: spacing.lg,
    backgroundColor: colors.bgPaper, borderTopWidth: 1, borderTopColor: colors.borderSoft,
  },
  primaryBtn: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 16, flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center",
  },
  primaryBtnText: { color: colors.primaryContrast, fontWeight: "800", fontSize: fontSize.md },
});
