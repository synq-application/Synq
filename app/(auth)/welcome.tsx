import { ACCENT, BG, fonts, MUTED, synqSvg, TEXT } from "@/constants/Variables";
import { router } from "expo-router";
import React from "react";
import {
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from "react-native";
import { SvgXml } from "react-native-svg";

type Props = {
  onNext?: () => void;
  onSkip?: () => void;
  step?: number;
  totalSteps?: number;
};

export default function SpontaneousHangouts({
  onNext,
  onSkip,
  step = 2,
  totalSteps = 4,
}: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <View pointerEvents="none" style={styles.bgSvgWrap}>
          <SvgXml xml={synqSvg} width="120%" height="120%" />
        </View>

        <TouchableOpacity
          onPress={() => (onNext ? onNext() : router.push("/(auth)/getting-started"))}
          activeOpacity={0.7}
          style={styles.skip}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        <View style={styles.topCopy}>
          <Text style={styles.title}>Spontaneous hangouts start here.</Text>
          <View style={styles.divider} />
          <Text style={styles.sub}>
            Synq shows when friends are free to meet up —
            {"\n"}so plans actually happen.
          </Text>
        </View>

        <View style={styles.graphicWrap}>
          <Image
            source={require("./synq-network.png")}
            style={styles.network}
            resizeMode="contain"
          />
        </View>

        <View style={styles.bottom}>
          <TouchableOpacity
            onPress={() => (onNext ? onNext() : router.push("/(auth)/next"))}
            activeOpacity={0.85}
            style={styles.nextBtn}
          >
            <Text style={styles.nextText}>Continue</Text>
          </TouchableOpacity>

          <View style={styles.dots}>
            {Array.from({ length: totalSteps }).map((_, i) => {
              const active = i + 1 === step;
              return (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    active ? styles.dotActive : styles.dotInactive,
                  ]}
                />
              );
            })}
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { flex: 1, backgroundColor: BG, paddingHorizontal: 22 },

  bgSvgWrap: {
    position: "absolute",
    top: -40,
    left: -40,
    right: -40,
    bottom: -40,
    opacity: 0.3,
    transform: [{ rotate: "-8deg" }],
  },
  skip: { position: "absolute", top: 14, right: 18, zIndex: 10 },
  skipText: {
    color: MUTED,
    fontFamily: fonts.book,
    fontSize: 16,
  },
  topCopy: { paddingTop: 86 },
  title: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: 32,
    letterSpacing: 0.2,
  },
  divider: {
    marginTop: 14,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    width: "78%",
  },
  sub: {
    marginTop: 16,
    color: MUTED,
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 22,
  },

  graphicWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  network: {
    width: 300,
    height: 800,
  },

  bottom: {
    paddingBottom: 26,
    alignItems: "center",
  },
  nextBtn: {
    width: "88%",
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    justifyContent: "center",
    alignItems: "center",
  },
  nextText: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: 18,
  },

  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
  },
  dot: { width: 7, height: 7, borderRadius: 99 },
  dotInactive: { backgroundColor: "rgba(255,255,255,0.18)" },
  dotActive: { backgroundColor: ACCENT },
});
