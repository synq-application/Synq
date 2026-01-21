import { ACCENT, BG, MUTED, TEXT, fonts, synqSvg } from "@/constants/Variables";
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
  View
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
  const phoneFade = useRef(new Animated.Value(0)).current;
  const bottomFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(120, [
      Animated.timing(topFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(phoneFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(bottomFade, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" />
      <View style={styles.container}>
        <View pointerEvents="none" style={styles.bgSvgWrap}>
          <SvgXml xml={synqSvg} width="120%" height="120%" />
        </View>

        <TouchableOpacity
          onPress={() => (onSkip ? onSkip() : router.push("/(auth)/getting-started"))}
          activeOpacity={0.7}
          style={styles.skip}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>

        <Animated.View style={[styles.topCopy, { opacity: topFade }]}>
          <Text style={styles.title}>See when friends{"\n"}are available.</Text>
          <View style={styles.divider} />
          <Text style={styles.sub}>
            Tap the Synq button to see{"\n"}who’s free to hang out.
          </Text>
        </Animated.View>

        {/* Phone graphic */}
        <Animated.View pointerEvents="none" style={[styles.phoneWrap, { opacity: phoneFade }]}>
          <Image
            //source={require("./chat.png")}
            style={styles.phone}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.View style={[styles.bottom, { opacity: bottomFade }]}>
          <TouchableOpacity
            onPress={() => (onNext ? onNext() : router.push("/(auth)/getting-started"))}
            activeOpacity={0.85}
            style={styles.nextBtn}
          >
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

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: BG },
  container: { flex: 1, backgroundColor: BG },

  bgSvgWrap: {
    position: "absolute",
    top: -40,
    left: -40,
    right: -40,
    bottom: -40,
    opacity: 0.35,
    transform: [{ rotate: "-8deg" }],
  },

  skip: { position: "absolute", top: 14, right: 18, zIndex: 10 },
  skipText: {
    color: "rgba(255,255,255,0.55)", // matches your other screens
    fontFamily: fonts.book,
    fontSize: 16,
  },

  topCopy: {
    paddingTop: 86,
    paddingHorizontal: 22,
    zIndex: 3,
  },
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

  phoneWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: -200,
    alignItems: "center",
    zIndex: 0,
  },
  phone: {
    width: 490,
    height: 660,
  },

  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 26,
    alignItems: "center",
    paddingHorizontal: 22,
    zIndex: 6,
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
    zIndex: 5,
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
