// Web fallback for real-map. Renders the illustrated map (react-native-maps
// requires a native dev build and is not available on Expo Go web preview).
import React from "react";
import { Feather } from "@expo/vector-icons";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { colors, radius, waitColor } from "@/src/theme";

interface Props {
  restaurants: any[];
  onMarkerPress: (id: string) => void;
}

const POSITIONS = [
  { top: 30, left: "12%" },
  { top: 70, right: "18%" },
  { top: "45%", left: "30%" },
  { bottom: 60, left: "15%" },
  { bottom: 90, right: "20%" },
  { bottom: 30, right: "35%" },
];

export default function RealMap({ restaurants, onMarkerPress }: Props) {
  return (
    <View style={styles.wrap} testID="real-map-web-fallback">
      <View style={styles.grid} pointerEvents="none">
        {Array.from({ length: 8 }).map((_, r) => (
          <View key={`h${r}`} style={[styles.gridLineH, { top: r * 50 }]} />
        ))}
        {Array.from({ length: 6 }).map((_, c) => (
          <View key={`v${c}`} style={[styles.gridLineV, { left: c * 70 }]} />
        ))}
      </View>
      {restaurants.slice(0, 6).map((r, i) => {
        const w = r.wait_time_min ?? r.base_wait_min;
        const c = waitColor(w);
        const pos = POSITIONS[i % POSITIONS.length];
        return (
          <TouchableOpacity
            key={r.id}
            onPress={() => onMarkerPress(r.id)}
            style={[styles.pin, { backgroundColor: c }, pos as any]}
            testID={`map-marker-${r.id}`}
            activeOpacity={0.8}
          >
            <Text style={styles.pinText}>{w}m</Text>
          </TouchableOpacity>
        );
      })}
      <View style={styles.banner}>
        <Feather name="info" size={12} color={colors.primary} />
        <Text style={styles.bannerText}>
          Illustrated map · real Google/Apple Maps available on the iOS/Android build
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1, backgroundColor: colors.bgPaper, borderRadius: radius.lg,
    overflow: "hidden", borderWidth: 1, borderColor: colors.borderSoft,
  },
  grid: { ...StyleSheet.absoluteFillObject },
  gridLineH: {
    position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "rgba(148, 163, 184, 0.08)",
  },
  gridLineV: {
    position: "absolute", top: 0, bottom: 0, width: 1, backgroundColor: "rgba(148, 163, 184, 0.08)",
  },
  pin: {
    position: "absolute", paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.pill, alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  pinText: { color: "#0B0F19", fontWeight: "800", fontSize: 11 },
  banner: {
    position: "absolute", bottom: 10, left: 10, right: 10,
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: colors.bg + "EE",
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.borderSoft,
  },
  bannerText: { color: colors.textSecondary, fontSize: 11, flex: 1 },
});
