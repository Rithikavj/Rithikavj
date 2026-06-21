import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, loadUser, saveUser } from "@/src/api";
import { colors, fontSize, radius, spacing } from "@/src/theme";

export default function ClaimRestaurant() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    const u = await loadUser();
    if (!u) return;
    try {
      const data = await api.hostUnclaimed(u.id);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const claim = async (id: string) => {
    const u = await loadUser();
    if (!u) return;
    setClaiming(id);
    try {
      await api.hostClaimRestaurant(u.id, id);
      await saveUser({ ...u, restaurant_id: id } as any);
      router.replace("/(host)/dashboard");
    } catch (e) {
      setClaiming(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle}>Claim Restaurant</Text>
          <Text style={styles.headerSub}>{items.length} listings available</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(r) => r.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}
          renderItem={({ item }) => (
            <View style={styles.card} testID={`claim-card-${item.id}`}>
              <Image source={{ uri: item.image }} style={styles.image} contentFit="cover" />
              <View style={styles.body}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.cuisine} · {item.price_level} · {item.area}, {item.city}</Text>
                <View style={styles.row}>
                  <View style={styles.tag}>
                    <Feather name="users" size={11} color={colors.textSecondary} />
                    <Text style={styles.tagText}>{item.capacity} tables</Text>
                  </View>
                  <View style={styles.tag}>
                    <Feather name="clock" size={11} color={colors.textSecondary} />
                    <Text style={styles.tagText}>Base {item.base_wait_min} min</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.claimBtn, claiming === item.id && { opacity: 0.6 }]}
                  onPress={() => claim(item.id)}
                  disabled={!!claiming}
                  testID={`claim-${item.id}`}
                >
                  {claiming === item.id ? <ActivityIndicator color={colors.primaryContrast} /> : (
                    <>
                      <Feather name="award" size={14} color={colors.primaryContrast} />
                      <Text style={styles.claimBtnText}>Claim this restaurant</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="award" size={36} color={colors.textMuted} />
              <Text style={styles.emptyText}>No un-claimed restaurants right now.</Text>
              <Text style={styles.emptyDesc}>
                Be the first to list yours — tap below.
              </Text>
              <TouchableOpacity style={styles.altBtn} onPress={() => router.replace("/host/create-restaurant")}>
                <Text style={styles.altBtnText}>Add a new restaurant</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
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
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, overflow: "hidden",
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  image: { width: "100%", height: 130 },
  body: { padding: spacing.md, gap: 6 },
  name: { color: colors.text, fontSize: fontSize.lg, fontWeight: "800" },
  meta: { color: colors.textSecondary, fontSize: fontSize.sm },
  row: { flexDirection: "row", gap: spacing.sm, marginTop: 6 },
  tag: {
    flexDirection: "row", gap: 4, alignItems: "center",
    backgroundColor: colors.bgElevated, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.pill,
  },
  tagText: { color: colors.textSecondary, fontSize: 11, fontWeight: "600" },
  claimBtn: {
    marginTop: spacing.sm, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center",
    backgroundColor: colors.primary, paddingVertical: 12, borderRadius: radius.pill,
  },
  claimBtnText: { color: colors.primaryContrast, fontWeight: "800" },
  empty: { padding: spacing.xxl, alignItems: "center", gap: spacing.md, marginTop: 40 },
  emptyText: { color: colors.text, fontSize: fontSize.lg, fontWeight: "700" },
  emptyDesc: { color: colors.textSecondary, textAlign: "center", lineHeight: 20 },
  altBtn: {
    marginTop: spacing.md, paddingHorizontal: 22, paddingVertical: 12,
    borderRadius: radius.pill, backgroundColor: colors.primary,
  },
  altBtnText: { color: colors.primaryContrast, fontWeight: "800" },
});
