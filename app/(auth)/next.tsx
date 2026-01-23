import { ACCENT, BG, TEXT, fonts, synqSvg } from "@/constants/Variables";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import {
  Animated,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";

type Props = {
  onNext?: () => void;
  onSkip?: () => void;
  step?: number;
  totalSteps?: number;
};

export default function SeeWhenFriendsAvailable({
  onNext,
  onSkip,
  step = 3,
  totalSteps = 4,
}: Props) {
  const topFade = useRef(new Animated.Value(0)).current;
  const pulseFade = useRef(new Animated.Value(0)).current;
  const bottomFade = useRef(new Animated.Value(0)).current;

  // subtle visual vibration + a gentle “breath”
  const jitter = useRef(new Animated.Value(0)).current;
  const breathe = useRef(new Animated.Value(0)).current;

  // stop haptics immediately on navigate/unmount
  const hapticsActiveRef = useRef(true);

  useEffect(() => {
    // enter animations
    Animated.stagger(120, [
      Animated.timing(topFade, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.timing(pulseFade, { toValue: 1, duration: 480, useNativeDriver: true }),
      Animated.timing(bottomFade, { toValue: 1, duration: 520, useNativeDriver: true }),
    ]).start();

    // tiny jitter loop (energy)
    const jitterLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(jitter, { toValue: 1, duration: 90, useNativeDriver: true }),
        Animated.timing(jitter, { toValue: -1, duration: 90, useNativeDriver: true }),
        Animated.timing(jitter, { toValue: 0, duration: 140, useNativeDriver: true }),
      ])
    );
    jitterLoop.start();

    // gentle “breathing” scale (premium, not gimmicky)
    const breatheLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 900, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 900, useNativeDriver: true }),
      ])
    );
    breatheLoop.start();

    // REAL haptics loop: tap…tap…pause (feels like a pulse)
    hapticsActiveRef.current = true;

    const runHaptics = async () => {
      const beat = async () => {
        try {
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        } catch {}
      };

      while (hapticsActiveRef.current) {
        await beat();
        await sleep(140);
        if (!hapticsActiveRef.current) break;

        await beat();
        await sleep(900);
      }
    };

    runHaptics();

    return () => {
      hapticsActiveRef.current = false;
      jitterLoop.stop();
      breatheLoop.stop();
    };
  }, [topFade, pulseFade, bottomFade, jitter, breathe]);

  const handleNext = () => {
    // stop haptics immediately so they don’t bleed into next screen
    hapticsActiveRef.current = false;
    onNext ? onNext() : router.push("/(auth)/getting-started");
  };

  const handleSkip = () => {
    hapticsActiveRef.current = false;
    onSkip ? onSkip() : router.push("/(auth)/getting-started");
  };

  const jitterX = jitter.interpolate({ inputRange: [-1, 1], outputRange: [-1.2, 1.2] });
  const jitterY = jitter.interpolate({ inputRange: [-1, 1], outputRange: [0.8, -0.8] });
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <View pointerEvents="none" style={styles.bgSvgWrap}>
          <SvgXml xml={synqSvg} width="120%" height="120%" />
        </View>

        {/* quiet zone behind copy so text always reads clean */}
        <View pointerEvents="none" style={styles.topOverlay} />

        <TouchableOpacity
          onPress={handleSkip}
          activeOpacity={0.7}
          style={styles.skip}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.topCopy, { opacity: topFade }]}>
          <Text style={styles.title}>Connect in the moment.</Text>
          <View style={styles.divider} />
          <Text style={styles.sub}>Tap when you're free. See who else is. Make it happen.</Text>
        </Animated.View>

        <Animated.View
          pointerEvents="none"
          style={[
            styles.pulseWrap,
            {
              opacity: pulseFade,
              transform: [{ translateX: jitterX }, { translateY: jitterY }, { scale }],
            },
          ]}
        >
          <Image
            source={require("../../assets/pulse.gif")}
            style={styles.pulse}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View style={[styles.bottom, { opacity: bottomFade }]}>
          <TouchableOpacity onPress={handleNext} activeOpacity={0.88} style={styles.nextBtn}>
            <Text style={styles.nextText}>Continue</Text>
          </TouchableOpacity>

          <View style={styles.dots} accessibilityLabel={`Step ${step} of ${totalSteps}`}>
            {Array.from({ length: totalSteps }).map((_, i) => {
              const active = i + 1 === step;
              return (
                <View
                  key={i}
                  style={[styles.dot, active ? styles.dotActive : styles.dotInactive]}
                />
              );
            })}
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { flex: 1, backgroundColor: BG },

  bgSvgWrap: {
    position: "absolute",
    top: -45,
    left: -45,
    right: -45,
    bottom: -45,
    opacity: 0.28,
    transform: [{ rotate: "-10deg" }],
  },

  topOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 260
  },

  skip: { position: "absolute", top: 14, right: 18, zIndex: 10 },
  skipText: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: fonts.book,
    fontSize: 16,
  },

  topCopy: { paddingTop: 86, paddingHorizontal: 22, zIndex: 6 },
  title: {
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: 34,
    letterSpacing: -0.3,
  },
  divider: {
    marginTop: 14,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.10)",
    width: "70%",
  },
  sub: {
    marginTop: 16,
    color: "rgba(255,255,255,0.78)",
    fontFamily: fonts.medium,
    fontSize: 16,
    lineHeight: 24,
  },

  // true hero centering
  pulseWrap: {
    position: "absolute",
    top: "35%",
    left: 0,
    right: 0,
    alignItems: "center",
    marginTop: 10, // tiny optical correction (feels centered with header + CTA)
    zIndex: 2,
  },
  pulse: {
    width: 300,
    height: 300,
    opacity: 0.98,
  },

  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 26,
    alignItems: "center",
    paddingHorizontal: 22,
    zIndex: 10,
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
    letterSpacing: 0.2,
  },

  dots: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  dot: { width: 7, height: 7, borderRadius: 99 },
  dotInactive: { backgroundColor: "rgba(255,255,255,0.18)" },
  dotActive: { backgroundColor: ACCENT },
});
