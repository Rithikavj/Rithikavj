import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/src/theme";

export default function HostLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginTop: 2 },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgPaper,
          borderTopColor: colors.borderSoft,
          borderTopWidth: 1,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 6,
          paddingTop: 8,
          ...Platform.select({ android: { elevation: 0 } }),
        },
        tabBarIcon: ({ color, focused }) => {
          const map: Record<string, any> = {
            dashboard: "grid",
            queue: "users",
            kitchen: "clipboard",
            profile: "user",
          };
          return (
            <View style={focused ? styles.iconActive : null}>
              <Feather name={map[route.name] || "circle"} size={20} color={color} />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Dashboard" }} />
      <Tabs.Screen name="queue" options={{ title: "Queue" }} />
      <Tabs.Screen name="kitchen" options={{ title: "Kitchen" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconActive: {
    backgroundColor: "rgba(25, 224, 183, 0.12)",
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999,
  },
});
