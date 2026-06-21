import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator, FlatList, Modal, StyleSheet, Text,
  TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, loadUser } from "@/src/api";
import { colors, fontSize, radius, spacing } from "@/src/theme";

export default function HostQueue() {
  const [entries, setEntries] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [waName, setWaName] = useState("");
  const [waSize, setWaSize] = useState("2");

  const load = useCallback(async () => {
    const u = await loadUser();
    if (!u) return;
    setUserId(u.id);
    try {
      const list = await api.hostQueue(u.id);
      setEntries(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const act = async (kind: "notify" | "seat" | "no-show", id: string) => {
    if (!userId) return;
    if (kind === "notify") await api.hostNotify(userId, id);
    if (kind === "seat") await api.hostSeat(userId, id);
    if (kind === "no-show") await api.hostNoShow(userId, id);
    await load();
  };

  const addWalkIn = async () => {
    if (!userId || !waName.trim()) return;
    await api.hostWalkIn(userId, waName.trim(), parseInt(waSize) || 2);
    setWaName(""); setWaSize("2"); setShowWalkIn(false);
    await load();
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.h1}>Live Queue</Text>
          <Text style={styles.sub}>{entries.length} parties active</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowWalkIn(true)}
          testID="add-walkin-btn"
        >
          <Feather name="plus" size={16} color={colors.primaryContrast} />
          <Text style={styles.addBtnText}>Walk-in</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => e.id}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.md }}
          renderItem={({ item }) => {
            const isNotified = item.status === "notified";
            return (
              <View style={[styles.card, isNotified && styles.cardNotified]} testID={`host-queue-${item.id}`}>
                <View style={styles.cardTop}>
                  <View style={styles.pos}>
                    <Text style={styles.posText}>{item.position}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.name}>
                      {item.user_name}{" "}
                      {item.is_walk_in ? <Text style={styles.walkInTag}>· Walk-in</Text> : null}
                    </Text>
                    <Text style={styles.meta}>
                      Party of {item.party_size} · Joined{" "}
                      {new Date(item.joined_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </Text>
                  </View>
                  {isNotified && (
                    <View style={styles.tablePill}>
                      <Text style={styles.tablePillText}>T{item.table_number}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.actions}>
                  {!isNotified && (
                    <TouchableOpacity
                      style={styles.actNotify}
                      onPress={() => act("notify", item.id)}
                      testID={`notify-${item.id}`}
                    >
                      <Feather name="bell" size={14} color={colors.primary} />
                      <Text style={styles.actNotifyText}>Notify</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={styles.actSeat}
                    onPress={() => act("seat", item.id)}
                    testID={`seat-${item.id}`}
                  >
                    <Feather name="check" size={14} color={colors.primaryContrast} />
                    <Text style={styles.actSeatText}>Seat Now</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actNo}
                    onPress={() => act("no-show", item.id)}
                    testID={`no-show-${item.id}`}
                  >
                    <Feather name="x" size={14} color={colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="users" size={40} color={colors.textMuted} />
              <Text style={styles.emptyText}>No one in the queue right now.</Text>
              <Text style={styles.emptyDesc}>Diners joining remotely will appear here in real-time.</Text>
            </View>
          }
        />
      )}

      <Modal visible={showWalkIn} transparent animationType="fade" onRequestClose={() => setShowWalkIn(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.modal} testID="walkin-modal">
            <Text style={styles.modalTitle}>Add Walk-In</Text>
            <Text style={styles.modalSub}>Add a party that walked in without joining the virtual queue.</Text>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.input}
              value={waName}
              onChangeText={setWaName}
              placeholder="e.g. Karthik"
              placeholderTextColor={colors.textMuted}
              testID="walkin-name"
            />
            <Text style={styles.label}>Party Size</Text>
            <TextInput
              style={styles.input}
              value={waSize}
              onChangeText={setWaSize}
              placeholder="2"
              keyboardType="number-pad"
              placeholderTextColor={colors.textMuted}
              testID="walkin-size"
            />
            <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg }}>
              <TouchableOpacity
                style={[styles.modalBtn, { backgroundColor: colors.bgElevated }]}
                onPress={() => setShowWalkIn(false)}
              >
                <Text style={styles.modalBtnSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={addWalkIn} testID="confirm-walkin">
                <Text style={styles.modalBtnText}>Add Party</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.md,
  },
  h1: { color: colors.text, fontSize: 26, fontWeight: "800" },
  sub: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  addBtn: {
    flexDirection: "row", gap: 6, alignItems: "center",
    backgroundColor: colors.primary, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: radius.pill,
  },
  addBtnText: { color: colors.primaryContrast, fontWeight: "800", fontSize: 13 },
  card: {
    backgroundColor: colors.bgCard, borderRadius: radius.lg, padding: spacing.md,
    borderWidth: 1, borderColor: colors.borderSoft, gap: spacing.md,
  },
  cardNotified: { borderColor: colors.primary, backgroundColor: "#0E2C26" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  pos: {
    width: 44, height: 44, borderRadius: radius.pill, backgroundColor: colors.bgElevated,
    alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: colors.primary,
  },
  posText: { color: colors.primary, fontWeight: "800", fontSize: fontSize.lg },
  name: { color: colors.text, fontWeight: "700", fontSize: fontSize.md },
  walkInTag: { color: colors.warning, fontSize: 11, fontWeight: "700" },
  meta: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 2 },
  tablePill: {
    backgroundColor: colors.primary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill,
  },
  tablePillText: { color: colors.primaryContrast, fontWeight: "800" },
  actions: { flexDirection: "row", gap: spacing.sm },
  actNotify: {
    flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center",
    paddingVertical: 10, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.primary,
  },
  actNotifyText: { color: colors.primary, fontWeight: "800", fontSize: 13 },
  actSeat: {
    flex: 1, flexDirection: "row", gap: 6, alignItems: "center", justifyContent: "center",
    paddingVertical: 10, borderRadius: radius.pill, backgroundColor: colors.primary,
  },
  actSeatText: { color: colors.primaryContrast, fontWeight: "800", fontSize: 13 },
  actNo: {
    width: 44, alignItems: "center", justifyContent: "center", borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.error,
  },
  empty: { padding: spacing.xxl, alignItems: "center", gap: spacing.md, marginTop: 40 },
  emptyText: { color: colors.text, fontWeight: "700", fontSize: fontSize.md },
  emptyDesc: { color: colors.textSecondary, textAlign: "center", maxWidth: 280, lineHeight: 20, fontSize: fontSize.sm },
  modalScrim: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "center", padding: spacing.xl,
  },
  modal: {
    backgroundColor: colors.bgCard, borderRadius: radius.xl, padding: spacing.lg, gap: 4,
  },
  modalTitle: { color: colors.text, fontWeight: "800", fontSize: fontSize.xl },
  modalSub: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: 4, marginBottom: spacing.md },
  label: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing.md, marginBottom: 6 },
  input: {
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12, color: colors.text,
  },
  modalBtn: {
    flex: 1, backgroundColor: colors.primary, paddingVertical: 14,
    borderRadius: radius.pill, alignItems: "center",
  },
  modalBtnText: { color: colors.primaryContrast, fontWeight: "800" },
  modalBtnSecondaryText: { color: colors.text, fontWeight: "700" },
});
