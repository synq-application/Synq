import { ACCENT, BG, TEXT, fonts } from "@/constants/Variables";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import type { SynqStatus } from "../helpers";

type ActivatingStatus = Extract<SynqStatus, "activating" | "finding">;

const FADE_OUT_MS = 420;
const FADE_IN_MS = 560;

type Props = {
  status: ActivatingStatus;
};

function StatusLine({ phase }: { phase: ActivatingStatus }) {
  if (phase === "finding") {
    return (
      <Text style={styles.title}>
        Seeing who's <Text style={styles.accent}>free</Text>
      </Text>
    );
  }

  return <Text style={styles.title}>Activating Synq</Text>;
}

export default function SynqActivatingView({ status }: Props) {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState<ActivatingStatus>(status);
  const textOpacity = useSharedValue(1);
  const glowStrength = useSharedValue(0);
  const isFirstLine = useRef(true);

  useEffect(() => {
    if (reduced) {
      setPhase(status);
      glowStrength.value = status === "finding" ? 1 : 0;
      return;
    }

    if (isFirstLine.current) {
      isFirstLine.current = false;
      setPhase(status);
      glowStrength.value = status === "finding" ? 1 : 0;
      return;
    }

    if (phase === status) return;

    const nextPhase = status;

    textOpacity.value = withTiming(
      0,
      { duration: FADE_OUT_MS, easing: Easing.out(Easing.cubic) },
      (finished) => {
        if (!finished) return;
        runOnJS(setPhase)(nextPhase);
        glowStrength.value = withTiming(nextPhase === "finding" ? 1 : 0, {
          duration: FADE_IN_MS,
          easing: Easing.inOut(Easing.cubic),
        });
        textOpacity.value = withTiming(1, {
          duration: FADE_IN_MS,
          easing: Easing.inOut(Easing.cubic),
        });
      }
    );

    if (nextPhase === "finding") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  }, [status, phase, textOpacity, glowStrength, reduced]);

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.14 + glowStrength.value * 0.16,
  }));

  const screenEnter = reduced ? FadeIn.duration(1) : FadeIn.duration(650);
  const screenExit = reduced ? FadeOut.duration(1) : FadeOut.duration(480);

  return (
    <Animated.View
      entering={screenEnter}
      exiting={screenExit}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.copyBlock}>
          <Animated.View style={[styles.lineWrap, textStyle]}>
            <StatusLine phase={phase} />
          </Animated.View>
        </View>

        <View style={styles.pulseArea}>
          <Animated.View style={[styles.pulseGlow, glowStyle]} pointerEvents="none" />
          <ExpoImage
            source={require("../../assets/pulse.gif")}
            style={styles.pulseGif}
            contentFit="contain"
            transition={0}
            cachePolicy="memory-disk"
          />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  content: {
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  copyBlock: {
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    marginBottom: 36,
  },
  lineWrap: {
    width: "100%",
    alignItems: "center",
  },
  title: {
    color: TEXT,
    fontSize: 32,
    lineHeight: 38,
    fontFamily: fonts.heavy,
    textAlign: "center",
    letterSpacing: -0.3,
    paddingHorizontal: 12,
  },
  accent: {
    color: ACCENT,
    fontFamily: fonts.heavy,
  },
  pulseArea: {
    width: 268,
    height: 268,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseGlow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 134,
    backgroundColor: "rgba(0,255,133,0.28)",
  },
  pulseGif: {
    width: 252,
    height: 252,
  },
});
