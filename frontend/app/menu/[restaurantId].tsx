import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, ScrollView, StyleSheet,
  Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api } from "@/src/api";
import { useCart } from "@/src/cart";
import { colors, fontSize, radius, spacing } from "@/src/theme";

export default function Menu() {
  const { restaurantId, queueId } = useLocalSearchParams<{ restaurantId: string; queueId?: string }>();
  const router = useRouter();
  const c = useCart();
  const [data, setData] = useState<any | null>(null);
  const [restaurant, setRestaurant] = useState<any | null>(null);
  const [activeCat, setActiveCat] = useState<string>("");

  useEffect(() => {
    if (!restaurantId) return;
    (async () => {
      const [m, r] = await Promise.all([
        api.getMenu(restaurantId),
        api.getRestaurant(restaurantId),
      ]);
      setData(m);
      setRestaurant(r);
      c.setRestaurant(r.id, r.name, queueId ?? null);
      if (m.categories[0]) setActiveCat(m.categories[0].name);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId]);

  const flat = useMemo(() => {
    if (!data) return [];
    const out: any[] = [];
    data.categories.forEach((cat: any) => {
      out.push({ type: "header", name: cat.name });
      cat.items.forEach((it: any) => out.push({ type: "item", ...it }));
    });
    return out;
  }, [data]);

  const listRef = useRef<FlatList>(null);
  const jumpTo = (cat: string) => {
    setActiveCat(cat);
    const idx = flat.findIndex((x) => x.type === "header" && x.name === cat);
    if (idx >= 0 && listRef.current) {
      listRef.current.scrollToIndex({ index: idx, animated: true, viewOffset: 0 });
    }
  };

  if (!data || !restaurant) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      {/* Sticky header */}
      <View style={styles.header} testID="menu-header">
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
            <Feather name="arrow-left" size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.headerTitle} numberOfLines={1}>Menu</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{restaurant.name}</Text>
          </View>
          <TouchableOpacity style={styles.iconBtn}>
            <Feather name="search" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
          style={{ marginTop: spacing.sm }}
        >
          {data.categories.map((cat: any) => {
            const active = activeCat === cat.name;
            return (
              <TouchableOpacity
                key={cat.name}
                onPress={() => jumpTo(cat.name)}
                style={[styles.chip, active && styles.chipActive]}
                testID={`menu-cat-${cat.name.toLowerCase()}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <FlatList
        ref={listRef}
        data={flat}
        keyExtractor={(it: any, i) => (it.type === "header" ? `h-${it.name}` : `i-${it.id}-${i}`)}
        contentContainerStyle={{ paddingTop: spacing.md, paddingBottom: c.count() > 0 ? 100 : 24, paddingHorizontal: spacing.lg }}
        renderItem={({ item }) => {
          if (item.type === "header") {
            return <Text style={styles.catHeader}>{item.name}</Text>;
          }
          const qty = c.get().items.find((x) => x.menu_item_id === item.id)?.qty ?? 0;
          return (
            <View style={styles.itemCard} testID={`menu-item-${item.id}`}>
              <View style={{ flex: 1 }}>
                <View style={styles.itemTopRow}>
                  <View style={[styles.vegDot, { borderColor: item.is_veg ? colors.success : colors.error }]}>
                    <View style={[styles.vegInner, { backgroundColor: item.is_veg ? colors.success : colors.error }]} />
                  </View>
                  {item.is_recommended && (
                    <View style={styles.recPill}>
                      <Feather name="star" size={10} color={colors.warning} />
                      <Text style={styles.recText}>Recommended</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemDesc} numberOfLines={2}>{item.description}</Text>
                <Text style={styles.itemPrice}>₹{item.price}</Text>
              </View>
              <View style={styles.itemRight}>
                <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" />
                {qty === 0 ? (
                  <TouchableOpacity
                    style={styles.addBtn}
                    onPress={() => c.add({ menu_item_id: item.id, name: item.name, price: item.price, image: item.image })}
                    testID={`add-${item.id}`}
                  >
                    <Feather name="plus" size={16} color={colors.primaryContrast} />
                    <Text style={styles.addBtnText}>Add</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.stepper} testID={`stepper-${item.id}`}>
                    <TouchableOpacity onPress={() => c.decrement(item.id)} testID={`dec-${item.id}`}>
                      <Feather name="minus" size={16} color={colors.primaryContrast} />
                    </TouchableOpacity>
                    <Text style={styles.stepperQty}>{qty}</Text>
                    <TouchableOpacity
                      onPress={() => c.add({ menu_item_id: item.id, name: item.name, price: item.price, image: item.image })}
                      testID={`inc-${item.id}`}
                    >
                      <Feather name="plus" size={16} color={colors.primaryContrast} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          );
        }}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        onScrollToIndexFailed={(info) => {
          setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: true }), 100);
        }}
      />

      {c.count() > 0 && (
        <TouchableOpacity
          style={styles.cartBar}
          onPress={() => router.push("/cart")}
          activeOpacity={0.9}
          testID="view-cart-btn"
        >
          <View>
            <Text style={styles.cartLabel}>Your Order</Text>
            <Text style={styles.cartSub}>{c.count()} item{c.count() > 1 ? "s" : ""} · ₹{c.total()}</Text>
          </View>
          <View style={styles.cartCta}>
            <Text style={styles.cartCtaText}>View Cart</Text>
            <Feather name="shopping-bag" size={16} color={colors.primaryContrast} />
          </View>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.sm,
    backgroundColor: colors.bg, borderBottomWidth: 1, borderBottomColor: colors.borderSoft,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  headerTitle: { color: colors.text, fontWeight: "800", fontSize: fontSize.lg },
  headerSub: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.bgCard,
    alignItems: "center", justifyContent: "center",
  },
  chipRow: { gap: spacing.sm, paddingRight: spacing.lg },
  chip: {
    flexShrink: 0, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: "center", justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.primaryAlpha10, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: fontSize.sm, fontWeight: "600" },
  chipTextActive: { color: colors.primary },
  catHeader: { color: colors.text, fontWeight: "700", fontSize: fontSize.lg, marginVertical: spacing.sm },
  itemCard: {
    flexDirection: "row", gap: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  itemTopRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 6 },
  vegDot: { width: 16, height: 16, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  vegInner: { width: 8, height: 8, borderRadius: 4 },
  recPill: {
    flexDirection: "row", gap: 4, alignItems: "center",
    backgroundColor: "rgba(245, 158, 11, 0.12)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.pill,
  },
  recText: { color: colors.warning, fontSize: 10, fontWeight: "700" },
  itemName: { color: colors.text, fontWeight: "700", fontSize: fontSize.md },
  itemDesc: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 4, lineHeight: 18 },
  itemPrice: { color: colors.text, fontWeight: "800", fontSize: fontSize.md, marginTop: 8 },
  itemRight: { alignItems: "center", gap: -16, width: 100 },
  itemImage: { width: 100, height: 90, borderRadius: radius.md },
  addBtn: {
    marginTop: -18, paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: colors.primary, borderRadius: radius.pill, flexDirection: "row", gap: 4,
    alignItems: "center", borderWidth: 2, borderColor: colors.bgCard,
  },
  addBtnText: { color: colors.primaryContrast, fontWeight: "800", fontSize: 13 },
  stepper: {
    marginTop: -18, paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: colors.primary, borderRadius: radius.pill, flexDirection: "row", gap: 10,
    alignItems: "center", borderWidth: 2, borderColor: colors.bgCard,
  },
  stepperQty: { color: colors.primaryContrast, fontWeight: "800", fontSize: 13 },
  cartBar: {
    position: "absolute", bottom: spacing.lg, left: spacing.lg, right: spacing.lg,
    flexDirection: "row", alignItems: "center", padding: spacing.md,
    backgroundColor: colors.bgElevated, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.primary,
  },
  cartLabel: { color: colors.text, fontWeight: "700", fontSize: fontSize.md },
  cartSub: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
  cartCta: {
    marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: radius.pill,
  },
  cartCtaText: { color: colors.primaryContrast, fontWeight: "800", fontSize: 13 },
});
