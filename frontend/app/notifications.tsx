import { Feather } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, loadUser } from "@/src/api";
import { colors, fontSize, radius, spacing } from "@/src/theme";

export default function NotificationsScreen() {
  const router = useRouter();
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const u = await loadUser();
    if (!u) return;
    try {
      const list = await api.myNotifications(u.id);
      setNotes(list);
      await api.readAllNotifications(u.id);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.brand}>
          <View style={styles.brandLogo}><Text style={styles.brandQ}>Q</Text></View>
          <View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Text style={styles.brandText}>DineIQ</Text>
              <Feather name="check-circle" size={14} color={colors.primary} />
            </View>
            <Text style={styles.brandSub}>Inbox</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      ) : (
        <FlatList
          data={notes}
          keyExtractor={(n) => n.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}
          renderItem={({ item }) => (
            <View style={styles.bubble} testID={`note-${item.id}`}>
              <Text style={styles.noteTitle}>{item.title}</Text>
              <Text style={styles.noteBody}>{item.body}</Text>
              <Text style={styles.noteTime}>
                {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="bell-off" size={36} color={colors.textMuted} />
              <Text style={styles.emptyText}>No notifications yet.</Text>
              <Text style={styles.emptyDesc}>
                Join a queue or pre-order to get live updates here.
              </Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#FAF7F2" },
  header: {
    flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.md,
    backgroundColor: "#0B6049", borderBottomWidth: 1, borderBottomColor: "#0a4d3b",
  },
  iconBtn: {
    width: 40, height: 40, borderRadius: radius.pill, backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center", justifyContent: "center",
  },
  brand: { flex: 1, flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  brandLogo: {
    width: 36, height: 36, borderRadius: radius.pill, borderWidth: 2,
    borderColor: colors.primary, alignItems: "center", justifyContent: "center",
    backgroundColor: "#0B0F19",
  },
  brandQ: { color: colors.primary, fontSize: 18, fontWeight: "300", marginTop: -2 },
  brandText: { color: "#fff", fontWeight: "800", fontSize: fontSize.md },
  brandSub: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
  bubble: {
    backgroundColor: "#fff", borderRadius: 14, padding: spacing.md, gap: 4,
    alignSelf: "flex-start", maxWidth: "85%",
    shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 1 },
  },
  noteTitle: { color: "#0B6049", fontWeight: "800", fontSize: fontSize.sm },
  noteBody: { color: "#1F2937", fontSize: fontSize.sm, lineHeight: 20 },
  noteTime: { color: "#9CA3AF", fontSize: 10, alignSelf: "flex-end", marginTop: 4 },
  empty: { alignItems: "center", gap: spacing.md, marginTop: 100 },
  emptyText: { color: "#1F2937", fontSize: fontSize.lg, fontWeight: "700" },
  emptyDesc: { color: "#6B7280", fontSize: fontSize.sm, textAlign: "center", maxWidth: 260, lineHeight: 20 },
});
