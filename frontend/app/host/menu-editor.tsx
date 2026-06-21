import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { api, loadUser } from "@/src/api";
import { colors, fontSize, radius, spacing } from "@/src/theme";

const CATS = ["Recommended", "Breakfast", "Meals", "Beverages", "Desserts"];

export default function MenuEditor() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const u = await loadUser();
    if (!u) return;
    setUserId(u.id);
    try {
      const data = await api.hostListMenu(u.id);
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openAdd = () => { setEditing(null); setOpen(true); };
  const openEdit = (it: any) => { setEditing(it); setOpen(true); };

  const remove = async (id: string) => {
    if (!userId) return;
    await api.hostDeleteMenu(userId, id);
    await load();
  };

  const byCat: Record<string, any[]> = {};
  items.forEach((it) => {
    byCat[it.category] = byCat[it.category] || [];
    byCat[it.category].push(it);
  });
  const order = [...CATS, ...Object.keys(byCat).filter((c) => !CATS.includes(c))];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.iconBtn} testID="back-btn">
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={styles.headerTitle}>Menu Editor</Text>
          <Text style={styles.headerSub}>{items.length} items · Live</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} testID="add-menu-btn">
          <Feather name="plus" size={18} color={colors.primaryContrast} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 80 }} />
      ) : items.length === 0 ? (
        <View style={styles.empty}>
          <Feather name="book-open" size={36} color={colors.textMuted} />
          <Text style={styles.emptyText}>No menu items yet.</Text>
          <Text style={styles.emptyDesc}>Add your first dish — diners can pre-order it instantly.</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={openAdd} testID="empty-add-btn">
            <Feather name="plus" size={16} color={colors.primaryContrast} />
            <Text style={styles.primaryBtnText}>Add menu item</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={order.filter((c) => byCat[c]?.length)}
          keyExtractor={(c) => c}
          contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.lg }}
          renderItem={({ item: cat }) => (
            <View>
              <Text style={styles.catHeader}>{cat}</Text>
              <View style={{ gap: spacing.sm }}>
                {byCat[cat].map((it: any) => (
                  <View key={it.id} style={styles.itemCard} testID={`menu-row-${it.id}`}>
                    <Image source={{ uri: it.image }} style={styles.thumb} contentFit="cover" />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                        <View style={[styles.vegDot, { borderColor: it.is_veg ? colors.success : colors.error }]}>
                          <View style={[styles.vegInner, { backgroundColor: it.is_veg ? colors.success : colors.error }]} />
                        </View>
                        <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
                      </View>
                      <Text style={styles.itemDesc} numberOfLines={2}>{it.description || "—"}</Text>
                      <Text style={styles.itemPrice}>₹{it.price}{it.is_recommended ? " · ⭐ Recommended" : ""}</Text>
                    </View>
                    <View style={{ gap: 6 }}>
                      <TouchableOpacity style={styles.iconSmall} onPress={() => openEdit(it)} testID={`edit-${it.id}`}>
                        <Feather name="edit-2" size={14} color={colors.text} />
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.iconSmall, { borderColor: colors.error }]} onPress={() => remove(it.id)} testID={`delete-${it.id}`}>
                        <Feather name="trash-2" size={14} color={colors.error} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        />
      )}

      <MenuItemModal
        visible={open}
        editing={editing}
        onClose={() => setOpen(false)}
        onSaved={() => { setOpen(false); load(); }}
        userId={userId}
      />
    </SafeAreaView>
  );
}

function MenuItemModal({ visible, editing, onClose, onSaved, userId }: any) {
  const [category, setCategory] = useState("Recommended");
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [price, setPrice] = useState("");
  const [image, setImage] = useState("");
  const [isVeg, setIsVeg] = useState(true);
  const [isRec, setIsRec] = useState(false);
  const [busy, setBusy] = useState(false);

  useFocusEffect(useCallback(() => {
    if (editing) {
      setCategory(editing.category);
      setName(editing.name);
      setDesc(editing.description || "");
      setPrice(String(editing.price));
      setImage(editing.image || "");
      setIsVeg(editing.is_veg);
      setIsRec(editing.is_recommended);
    } else {
      setCategory("Recommended"); setName(""); setDesc(""); setPrice(""); setImage(""); setIsVeg(true); setIsRec(false);
    }
  }, [editing]));

  const save = async () => {
    if (!userId || !name.trim() || !price) return;
    setBusy(true);
    try {
      const body = {
        category, name: name.trim(), description: desc.trim(),
        price: parseInt(price) || 0, image: image.trim() || undefined,
        is_veg: isVeg, is_recommended: isRec,
      };
      if (editing) await api.hostUpdateMenu(userId, editing.id, body);
      else await api.hostAddMenu(userId, body);
      onSaved();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.scrim}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? "Edit Item" : "Add Menu Item"}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Feather name="x" size={20} color={colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 500 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
                {CATS.map((c) => (
                  <TouchableOpacity key={c} onPress={() => setCategory(c)}
                    style={[styles.chip, category === c && styles.chipActive]}
                    testID={`cat-${c.toLowerCase()}`}
                  >
                    <Text style={[styles.chipText, category === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.label}>Item Name *</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName}
                placeholder="e.g. Masala Dosa" placeholderTextColor={colors.textMuted} testID="modal-name" />

              <Text style={styles.label}>Description</Text>
              <TextInput style={[styles.input, { height: 70 }]} value={desc} onChangeText={setDesc}
                placeholder="Crispy dosa with potato filling"
                placeholderTextColor={colors.textMuted} multiline testID="modal-desc" />

              <Text style={styles.label}>Price (₹) *</Text>
              <TextInput style={styles.input} value={price} onChangeText={setPrice}
                keyboardType="number-pad" placeholder="150"
                placeholderTextColor={colors.textMuted} testID="modal-price" />

              <Text style={styles.label}>Image URL (optional)</Text>
              <TextInput style={styles.input} value={image} onChangeText={setImage}
                autoCapitalize="none" placeholder="https://..."
                placeholderTextColor={colors.textMuted} testID="modal-image" />

              <View style={styles.toggles}>
                <TouchableOpacity style={styles.toggleRow} onPress={() => setIsVeg(!isVeg)} testID="toggle-veg">
                  <View style={[styles.checkbox, isVeg && styles.checkboxOn]}>
                    {isVeg && <Feather name="check" size={12} color={colors.primaryContrast} />}
                  </View>
                  <Text style={styles.toggleText}>Vegetarian</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.toggleRow} onPress={() => setIsRec(!isRec)} testID="toggle-rec">
                  <View style={[styles.checkbox, isRec && styles.checkboxOn]}>
                    {isRec && <Feather name="check" size={12} color={colors.primaryContrast} />}
                  </View>
                  <Text style={styles.toggleText}>Mark as Recommended ⭐</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <TouchableOpacity
              style={[styles.saveBtn, busy && { opacity: 0.6 }]}
              onPress={save}
              disabled={busy}
              testID="modal-save"
            >
              {busy ? <ActivityIndicator color={colors.primaryContrast} /> : (
                <Text style={styles.saveBtnText}>{editing ? "Save Changes" : "Add to Menu"}</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
  addBtn: {
    width: 40, height: 40, borderRadius: radius.pill, backgroundColor: colors.primary,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { color: colors.text, fontWeight: "800", fontSize: fontSize.lg },
  headerSub: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2 },
  catHeader: { color: colors.primary, fontWeight: "800", fontSize: fontSize.md, marginBottom: spacing.sm },
  itemCard: {
    flexDirection: "row", gap: spacing.md, padding: spacing.md,
    backgroundColor: colors.bgCard, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderSoft, alignItems: "center",
  },
  thumb: { width: 64, height: 64, borderRadius: radius.md },
  vegDot: { width: 14, height: 14, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  vegInner: { width: 7, height: 7, borderRadius: 4 },
  itemName: { color: colors.text, fontWeight: "700", fontSize: fontSize.md, flex: 1 },
  itemDesc: { color: colors.textSecondary, fontSize: fontSize.xs, marginTop: 2, lineHeight: 16 },
  itemPrice: { color: colors.text, fontWeight: "700", fontSize: fontSize.sm, marginTop: 4 },
  iconSmall: {
    width: 30, height: 30, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: "center", justifyContent: "center", backgroundColor: colors.bgElevated,
  },
  empty: { padding: spacing.xxl, alignItems: "center", gap: spacing.md, marginTop: 40 },
  emptyText: { color: colors.text, fontWeight: "700", fontSize: fontSize.lg },
  emptyDesc: { color: colors.textSecondary, textAlign: "center", maxWidth: 280, lineHeight: 20 },
  primaryBtn: {
    flexDirection: "row", gap: 6, alignItems: "center",
    backgroundColor: colors.primary, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: radius.pill, marginTop: spacing.md,
  },
  primaryBtnText: { color: colors.primaryContrast, fontWeight: "800" },
  scrim: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" },
  modal: {
    backgroundColor: colors.bgPaper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing.lg, gap: spacing.sm,
  },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { color: colors.text, fontWeight: "800", fontSize: fontSize.xl },
  closeBtn: { width: 36, height: 36, borderRadius: radius.pill, backgroundColor: colors.bgCard, alignItems: "center", justifyContent: "center" },
  label: { color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing.md, marginBottom: 6, fontWeight: "600" },
  input: {
    backgroundColor: colors.bgInput, borderWidth: 1, borderColor: colors.border,
    borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 12,
    color: colors.text,
  },
  chip: {
    height: 32, paddingHorizontal: 12, borderRadius: radius.pill,
    backgroundColor: colors.bgCard, borderWidth: 1, borderColor: colors.borderSoft,
    alignItems: "center", justifyContent: "center",
  },
  chipActive: { backgroundColor: colors.primaryAlpha10, borderColor: colors.primary },
  chipText: { color: colors.textSecondary, fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: colors.primary },
  toggles: { marginTop: spacing.md, gap: spacing.md },
  toggleRow: { flexDirection: "row", gap: spacing.sm, alignItems: "center" },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.border,
    alignItems: "center", justifyContent: "center",
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  toggleText: { color: colors.text, fontSize: fontSize.md },
  saveBtn: {
    marginTop: spacing.lg, backgroundColor: colors.primary, paddingVertical: 16,
    borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
  },
  saveBtnText: { color: colors.primaryContrast, fontWeight: "800", fontSize: fontSize.md },
});
