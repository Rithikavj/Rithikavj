import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

import { colors, fontSize, radius, spacing } from "@/src/theme";
import { loadUser } from "@/src/api";

export default function Splash() {
  const router = useRouter();
  const fade = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.8)).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 6, useNativeDriver: true }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.15, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    ).start();

    const t = setTimeout(async () => {
      const u = await loadUser();
      if (u) {
        if (u.role === "host") router.replace("/(host)/dashboard");
        else router.replace("/(customer)/discover");
      } else {
        router.replace("/login");
      }
    }, 1400);
    return () => clearTimeout(t);
  }, [router, fade, scale, pulse]);

  return (
    <View style={styles.container} testID="splash-screen">
      <Animated.View style={[styles.logoWrap, { opacity: fade, transform: [{ scale }] }]}>
        <Animated.View style={[styles.logoRing, { transform: [{ scale: pulse }] }]} />
        <View style={styles.logoCircle}>
          <Text style={styles.logoQ}>Q</Text>
          <View style={styles.logoTail} />
        </View>
        <Text style={styles.brand}>DineIQ</Text>
        <Text style={styles.tag}>Smarter dining starts here.</Text>
      </Animated.View>
      <Text style={styles.footer}>Know before you go.{"\n"}Order before you sit.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1, backgroundColor: colors.bg,
    alignItems: "center", justifyContent: "center", padding: spacing.xl,
  },
  logoWrap: { alignItems: "center", gap: spacing.lg },
  logoRing: {
    position: "absolute", top: 0, width: 160, height: 160, borderRadius: radius.pill,
    borderWidth: 1.5, borderColor: colors.primaryAlpha20,
  },
  logoCircle: {
    width: 110, height: 110, borderRadius: radius.pill, borderWidth: 3,
    borderColor: colors.primary, alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent",
  },
  logoQ: { color: colors.primary, fontSize: 64, fontWeight: "300", marginTop: -6 },
  logoTail: {
    position: "absolute", bottom: 6, right: 10, width: 22, height: 4,
    borderRadius: 2, backgroundColor: colors.primary, transform: [{ rotate: "40deg" }],
  },
  brand: { color: colors.text, fontSize: 36, fontWeight: "800", letterSpacing: 0.5 },
  tag: { color: colors.textSecondary, fontSize: fontSize.md },
  footer: {
    position: "absolute", bottom: spacing.xxl + 16,
    color: colors.textMuted, textAlign: "center", fontSize: fontSize.sm, lineHeight: 20,
  },
});
