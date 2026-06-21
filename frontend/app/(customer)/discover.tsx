import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, FlatList, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, loadUser } from "@/src/api";
import RealMap from "@/src/components/real-map";
import { colors, fontSize, radius, spacing, waitColor, waitLabel } from "@/src/theme";

const CUISINES = ["All", "South Indian", "Hyderabadi", "North Indian", "Cafe", "Modern Indian"];
type ViewMode = "list" | "map";

export default function Discover() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [cuisine, setCuisine] = useState("All");
  const [view, setView] = useState<ViewMode>("list");
  const [rests, setRests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userName, setUserName] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [u, data] = await Promise.all([
        loadUser(),
        api.listRestaurants(q || undefined, cuisine === "All" ? undefined : cuisine),
      ]);
      setUserName(u?.name?.split(" ")[0] || "Diner");
      setRests(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [q, cuisine]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* Sticky header */}
      <View style={styles.header} testID="discover-header">
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greet}>Hello, {userName} 👋</Text>
            <View style={styles.locRow}>
              <Feather name="map-pin" size={13} color={colors.primary} />
              <Text style={styles.loc}>T. Nagar, Chennai</Text>
              <Feather name="chevron-down" size={14} color={colors.textSecondary} />
            </View>
          </View>
          <TouchableOpacity
            style={styles.bell}
            onPress={() => router.push("/notifications")}
            testID="notifications-btn"
          >
            <Feather name="bell" size={20} color={colors.text} />
            <View style={styles.bellDot} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchRow}>
          <Feather name="search" size={18} color={colors.textMuted} />
          <TextInput
            placeholder="Search restaurants, cuisines..."
            placeholderTextColor={colors.textMuted}
            value={q}
            onChangeText={setQ}
            onSubmitEditing={load}
            style={styles.searchInput}
            returnKeyType="search"
            testID="search-input"
          />
          {q ? (
            <TouchableOpacity onPress={() => { setQ(""); }}>
              <Feather name="x" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={{ marginTop: spacing.md }}
        >
          {CUISINES.map((c) => {
            const active = cuisine === c;
            return (
              <TouchableOpacity
                key={c}
                onPress={() => setCuisine(c)}
                style={[styles.chip, active && styles.chipActive]}
                testID={`cuisine-${c.toLowerCase().replace(/\s/g, "-")}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* List / Map toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, view === "list" && styles.toggleBtnActive]}
            onPress={() => setView("list")}
            testID="view-list-btn"
          >
            <Feather name="list" size={14} color={view === "list" ? colors.primary : colors.textSecondary} />
            <Text style={[styles.toggleText, view === "list" && styles.toggleTextActive]}>List</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, view === "map" && styles.toggleBtnActive]}
            onPress={() => setView("map")}
            testID="view-map-btn"
          >
            <Feather name="map" size={14} color={view === "map" ? colors.primary : colors.textSecondary} />
            <Text style={[styles.toggleText, view === "map" && styles.toggleTextActive]}>Map</Text>
          </TouchableOpacity>
          <Text style={styles.resultsCount}>{rests.length} nearby</Text>
        </View>
      </View>

      {view === "map" ? (
        <View style={styles.mapFullWrap}>
          <RealMap
            restaurants={rests}
            onMarkerPress={(id) => router.push(`/restaurant/${id}`)}
          />
        </View>
      ) : (
        <FlatList
        data={rests}
        keyExtractor={(r) => r.id}
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl
            tintColor={colors.primary}
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); load(); }}
          />
        }
        ListHeaderComponent={
          <View style={styles.mapHero} testID="map-hero">
            <View style={styles.mapGrid} pointerEvents="none">
              {Array.from({ length: 6 }).map((_, r) => (
                <View key={`h${r}`} style={[styles.gridLineH, { top: r * 38 }]} />
              ))}
              {Array.from({ length: 5 }).map((_, c) => (
                <View key={`v${c}`} style={[styles.gridLineV, { left: c * 70 }]} />
              ))}
            </View>
            <Pin style={{ top: 20, left: 30 }} m={10} />
            <Pin style={{ top: 60, right: 50 }} m={30} />
            <Pin style={{ bottom: 30, left: 70 }} m={20} />
            <Pin style={{ bottom: 50, right: 30 }} m={45} />
            <Pin style={{ top: 90, left: "45%" }} m={5} />
            <TouchableOpacity style={styles.mapBadge} onPress={() => setView("map")} testID="open-map-from-hero">
              <Feather name="navigation" size={14} color={colors.primary} />
              <Text style={styles.mapBadgeText}>Tap to open full map</Text>
            </TouchableOpacity>
          </View>
        }
        renderItem={({ item }) => <RestaurantCard item={item} onPress={() => router.push(`/restaurant/${item.id}`)} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListEmptyComponent={
          loading ? (
            <View style={{ padding: spacing.xxl, alignItems: "center" }}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : (
            <View style={styles.empty}>
              <Feather name="map-pin" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>No restaurants match your filters.</Text>
            </View>
          )
        }
      />
      )}
    </SafeAreaView>
  );
}

function Pin({ style, m }: { style: any; m: number }) {
  const c = waitColor(m);
  return (
    <View style={[styles.pin, { backgroundColor: c }, style]}>
      <Text style={styles.pinText}>{m}m</Text>
    </View>
  );
}

function RestaurantCard({ item, onPress }: { item: any; onPress: () => void }) {
  const w = item.wait_time_min ?? item.base_wait_min;
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={styles.card}
      testID={`restaurant-card-${item.id}`}
    >
      <Image source={{ uri: item.image }} style={styles.cardImage} contentFit="cover" transition={200} />
      <View style={styles.cardBody}>
        <View style={{ flex: 1 }}>
          <View style={styles.cardTopRow}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.name}</Text>
            <View style={styles.rating}>
              <Feather name="star" size={11} color={colors.warning} />
              <Text style={styles.ratingText}>{item.rating}</Text>
            </View>
          </View>
          <Text style={styles.cardSub} numberOfLines={1}>
            {item.cuisine} · {item.price_level} · {item.area}
          </Text>
          <View style={styles.cardMetaRow}>
            <View style={[styles.waitPill, { backgroundColor: waitColor(w) + "22", borderColor: waitColor(w) }]}>
              <View style={[styles.dot, { backgroundColor: waitColor(w) }]} />
              <Text style={[styles.waitPillText, { color: waitColor(w) }]}>{w} min · {waitLabel(w)}</Text>
            </View>
            <Text style={styles.dist}>{item.distance_km} km</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
    backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  greet: { color: colors.text, fontSize: fontSize.xl, fontWeight: "800" },
  locRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  loc: { color: colors.textSecondary, fontSize: fontSize.sm },
  bell: {
    width: 42, height: 42, borderRadius: radius.pill, backgroundColor: colors.bgCard,
    alignItems: "center", justifyContent: "center",
  },
  bellDot: {
    position: "absolute", top: 10, right: 10, width: 8, height: 8,
    borderRadius: 4, backgroundColor: colors.primary,
  },
  searchRow: {
    flexDirection: "row", alignItems: "center", gap: spacing.sm,
    backgroundColor: colors.bgInput, borderRadius: radius.md,
    paddingHorizontal: spacing.md, marginTop: spacing.md,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  searchInput: { flex: 1, color: colors.text, paddingVertical: 12, fontSize: fontSize.md },
  chipRow: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    flexShrink: 0, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: "center", justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.primaryAlpha10, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: "600" },
  chipTextActive: { color: colors.primary },
  mapHero: {
    height: 200, backgroundColor: colors.bgPaper, borderRadius: radius.lg,
    marginBottom: spacing.lg, overflow: "hidden", borderWidth: 1, borderColor: colors.borderSoft,
  },
  mapGrid: { ...StyleSheet.absoluteFillObject },
  gridLineH: {
    position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(148, 163, 184, 0.08)",
  },
  gridLineV: {
    position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(148, 163, 184, 0.08)",
  },
  pin: {
    position: "absolute", paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  pinText: { color: "#0B0F19", fontWeight: "800", fontSize: 11 },
  mapBadge: {
    position: "absolute", bottom: 12, left: 12, flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.bg + "EE", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.pill, borderWidth: 1, borderColor: colors.borderSoft,
  },
  mapBadgeText: { color: colors.text, fontSize: 12, fontWeight: "600" },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, overflow: "hidden",
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  cardImage: { width: "100%", height: 140 },
  cardBody: { padding: spacing.md, gap: 6 },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { color: colors.text, fontSize: fontSize.lg, fontWeight: "700", flex: 1, marginRight: spacing.sm },
  cardSub: { color: colors.textSecondary, fontSize: fontSize.sm },
  cardMetaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  waitPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, borderWidth: 1,
  },
  dot: { width: 7, height: 7, borderRadius: 4 },
  waitPillText: { fontSize: 12, fontWeight: "700" },
  dist: { color: colors.textMuted, fontSize: fontSize.sm },
  rating: {
    flexDirection: "row", gap: 4, alignItems: "center",
    backgroundColor: colors.bgElevated, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.pill,
  },
  ratingText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  empty: { paddingVertical: spacing.xxl, alignItems: "center", gap: spacing.md },
  emptyText: { color: colors.textSecondary, fontSize: fontSize.md },
  toggleRow: {
    flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, alignItems: "center",
  },
  toggleBtn: {
    flexDirection: "row", gap: 6, alignItems: "center",
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: radius.pill,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderSoft,
  },
  toggleBtnActive: { backgroundColor: colors.primaryAlpha10, borderColor: colors.primary },
  toggleText: { color: colors.textSecondary, fontWeight: "700", fontSize: 12 },
  toggleTextActive: { color: colors.primary },
  resultsCount: { color: colors.textMuted, fontSize: 12, marginLeft: "auto" },
  mapFullWrap: { flex: 1, padding: spacing.lg },
});
