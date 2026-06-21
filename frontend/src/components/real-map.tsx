// Real interactive map for iOS / Android using react-native-maps
// Works in dev/production builds. In Expo Go iOS it uses Apple Maps.
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";

import { colors, radius, waitColor } from "@/src/theme";

interface Props {
  restaurants: any[];
  onMarkerPress: (id: string) => void;
}

export default function RealMap({ restaurants, onMarkerPress }: Props) {
  // Center on the first restaurant or a fallback (Chennai)
  const first = restaurants[0];
  const region = {
    latitude: first?.lat ?? 13.0418,
    longitude: first?.lng ?? 80.2341,
    latitudeDelta: 0.4,
    longitudeDelta: 0.4,
  };

  return (
    <View style={styles.wrap} testID="real-map">
      <MapView
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        initialRegion={region}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {restaurants.map((r) => {
          const w = r.wait_time_min ?? r.base_wait_min;
          const c = waitColor(w);
          return (
            <Marker
              key={r.id}
              coordinate={{ latitude: r.lat, longitude: r.lng }}
              onPress={() => onMarkerPress(r.id)}
              testID={`map-marker-${r.id}`}
            >
              <View style={[styles.pin, { backgroundColor: c }]}>
                <Text style={styles.pinText}>{w}m</Text>
              </View>
              <View style={[styles.pinTail, { backgroundColor: c }]} />
            </Marker>
          );
        })}
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, borderRadius: radius.lg, overflow: "hidden", backgroundColor: colors.bgPaper },
  pin: {
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.pill,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: colors.bg,
    shadowColor: "#000", shadowOpacity: 0.4, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  pinText: { color: "#0B0F19", fontWeight: "800", fontSize: 11 },
  pinTail: {
    width: 4, height: 8, alignSelf: "center", marginTop: -2,
  },
});
