import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, loadUser } from "@/src/api";
import { cart } from "@/src/cart";
import { colors, fontSize, radius, spacing, waitColor, waitLabel } from "@/src/theme";

export default function RestaurantDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [r, setR] = useState<any | null>(null);
  const [size, setSize] = useState(2);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id) return;
    api.getRestaurant(id).then(setR).catch(() => setR(null));
  }, [id]);

  const join = async () => {
    const u = await loadUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    setBusy(true);
    try {
      const entry = await api.joinQueue(u.id, r.id, size);
      cart.setRestaurant(r.id, r.name, entry.id);
      router.replace("/(customer)/my-queue");
    } finally {
      setBusy(false);
    }
  };

  if (!r) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  const w = r.wait_time_min ?? r.base_wait_min;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 220 }}>
        <View style={styles.heroWrap}>
          <Image source={{ uri: r.hero_image || r.image }} style={styles.hero} contentFit="cover" />
          <View style={styles.heroOverlay} pointerEvents="none" />
          <SafeAreaView edges={["top"]} style={styles.topBar}>
            <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
              <Feather name="arrow-left" size={20} color={colors.text} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.iconBtn} testID="share-btn">
              <Feather name="share-2" size={18} color={colors.text} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} testID="fav-btn">
              <Feather name="heart" size={18} color={colors.text} />
            </TouchableOpacity>
          </SafeAreaView>
        </View>

        <View style={styles.card} testID="restaurant-card">
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
            <Text style={styles.name}>{r.name}</Text>
            <View style={styles.rating}>
              <Feather name="star" size={12} color={colors.warning} />
              <Text style={styles.ratingText}>{r.rating}</Text>
            </View>
          </View>
          <Text style={styles.meta}>{r.cuisine} · {r.price_level} · {r.distance_km} km</Text>
          <View style={styles.addrRow}>
            <Feather name="map-pin" size={14} color={colors.textSecondary} />
            <Text style={styles.addr}>{r.address}, {r.city}</Text>
          </View>

          <View style={styles.waitBox}>
            <View style={[styles.waitIcon, { backgroundColor: waitColor(w) + "22" }]}>
              <Feather name="clock" size={18} color={waitColor(w)} />
            </View>
            <View>
              <Text style={[styles.waitNum, { color: waitColor(w) }]}>{w} min</Text>
              <Text style={styles.waitLabel}>Estimated wait · {waitLabel(w)}</Text>
            </View>
          </View>

          <View style={styles.queueBox}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Feather name="users" size={16} color={colors.primary} />
              <Text style={styles.queueBoxText}>
                Live Queue · {r.parties_ahead} {r.parties_ahead === 1 ? "party" : "parties"} ahead
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Party Size</Text>
          <View style={styles.partyRow}>
            {[1, 2, 3, 4, "5+"].map((s) => {
              const val = typeof s === "string" ? 5 : s;
              const active = size === val;
              return (
                <TouchableOpacity
                  key={s}
                  onPress={() => setSize(val)}
                  style={[styles.party, active && styles.partyActive]}
                  testID={`party-size-${s}`}
                >
                  <Text style={[styles.partyText, active && styles.partyTextActive]}>{s}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={styles.sectionTitle}>About</Text>
          </View>
          <Text style={styles.about}>
            Authentic {r.cuisine.toLowerCase()} cuisine in {r.area}. Skip the wait — pre-order while you queue
            and your food starts cooking the moment you're seated.
          </Text>
        </View>

        <TouchableOpacity
          style={styles.menuBtn}
          onPress={() => router.push(`/menu/${r.id}`)}
          testID="view-menu-btn"
        >
          <Feather name="book-open" size={18} color={colors.primary} />
          <Text style={styles.menuBtnText}>View Full Menu</Text>
          <Feather name="chevron-right" size={18} color={colors.primary} />
        </TouchableOpacity>
      </ScrollView>

      {/* Sticky bottom CTA */}
      <View style={styles.bottomBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bottomLabel}>Join Virtual Queue</Text>
          <Text style={styles.bottomSub}>Get your table in approx. {w} min</Text>
        </View>
        <TouchableOpacity
          style={[styles.joinBtn, busy && { opacity: 0.6 }]}
          onPress={join}
          disabled={busy}
          testID="join-queue-btn"
        >
          {busy ? <ActivityIndicator color={colors.primaryContrast} /> : (
            <>
              <Text style={styles.joinBtnText}>Join Queue</Text>
              <Feather name="users" size={18} color={colors.primaryContrast} />
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  heroWrap: { height: 240, position: "relative" },
  hero: { width: "100%", height: "100%" },
  heroOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(11, 15, 25, 0.4)" },
  topBar: {
    position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row",
    paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.sm,
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.pill, backgroundColor: "rgba(11, 15, 25, 0.6)",
    borderWidth: 1, borderColor: "rgba(148, 163, 184, 0.2)",
    alignItems: "center", justifyContent: "center",
  },
  card: {
    marginHorizontal: spacing.lg, marginTop: -50, padding: spacing.lg,
    backgroundColor: colors.bgCard, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  name: { color: colors.text, fontSize: 24, fontWeight: "800", flex: 1, marginRight: spacing.sm },
  rating: {
    flexDirection: "row", gap: 4, alignItems: "center",
    backgroundColor: colors.bgElevated, paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill,
  },
  ratingText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  meta: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 4 },
  addrRow: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 8 },
  addr: { color: colors.textSecondary, fontSize: fontSize.sm, flex: 1 },
  waitBox: {
    marginTop: spacing.lg, flexDirection: "row", gap: spacing.md, alignItems: "center",
    backgroundColor: colors.bgElevated, padding: spacing.md, borderRadius: radius.md,
  },
  waitIcon: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  waitNum: { fontSize: 22, fontWeight: "800" },
  waitLabel: { color: colors.textSecondary, fontSize: fontSize.sm },
  queueBox: {
    marginTop: spacing.sm, padding: spacing.md, borderRadius: radius.md,
    backgroundColor: colors.primaryAlpha10, borderWidth: 1, borderColor: colors.primaryAlpha20,
  },
  queueBoxText: { color: colors.text, fontSize: fontSize.sm, fontWeight: "600" },
  section: { paddingHorizontal: spacing.lg, marginTop: spacing.xl },
  sectionTitle: { color: colors.text, fontWeight: "700", fontSize: fontSize.lg, marginBottom: spacing.md },
  partyRow: { flexDirection: "row", gap: spacing.sm },
  party: {
    flex: 1, height: 52, borderRadius: radius.md, backgroundColor: colors.bgCard,
    alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.borderSoft,
  },
  partyActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  partyText: { color: colors.text, fontWeight: "700", fontSize: fontSize.lg },
  partyTextActive: { color: colors.primaryContrast },
  about: { color: colors.textSecondary, fontSize: fontSize.md, lineHeight: 22 },
  menuBtn: {
    marginHorizontal: spacing.lg, marginTop: spacing.xl, padding: spacing.md,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.primary,
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
  },
  menuBtnText: { color: colors.primary, fontWeight: "700", flex: 1 },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row",
    alignItems: "center", padding: spacing.lg, gap: spacing.md,
    backgroundColor: colors.bgPaper, borderTopWidth: 1, borderTopColor: colors.borderSoft,
  },
  bottomLabel: { color: colors.text, fontWeight: "700", fontSize: fontSize.md },
  bottomSub: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
  joinBtn: {
    backgroundColor: colors.primary, borderRadius: radius.pill,
    paddingVertical: 14, paddingHorizontal: 22, flexDirection: "row", gap: 8, alignItems: "center",
  },
  joinBtnText: { color: colors.primaryContrast, fontWeight: "800", fontSize: fontSize.md },
});
