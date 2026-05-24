import { ACCENT, BG, synqSvg } from "@/constants/Variables";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import React, { useEffect, useRef } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SvgXml } from "react-native-svg";

const LAUNCH_MS = 2600;
const RING_COUNT = 4;
const RING_STAGGER_MS = 420;
const RING_DURATION_MS = 1180;

type Props = {
  onComplete: () => void;
};

function SonarRing({
  index,
  disabled,
}: {
  index: number;
  disabled: boolean;
}) {
  const scale = useSharedValue(0.55);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (disabled) return;
    const delay = index * RING_STAGGER_MS;
    scale.value = 0.55;
    opacity.value = 0.44;
    scale.value = withDelay(
      delay,
      withTiming(2.7, {
        duration: RING_DURATION_MS,
        easing: Easing.out(Easing.cubic),
      })
    );
    opacity.value = withDelay(
      delay,
      withTiming(0, {
        duration: RING_DURATION_MS,
        easing: Easing.out(Easing.quad),
      })
    );
  }, [disabled, index, opacity, scale]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.ring, ringStyle]} pointerEvents="none" />;
}

export default function SynqActivatingView({ onComplete }: Props) {
  const reduced = useReducedMotion();
  const finished = useRef(false);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const bloom = useSharedValue(0);
  const bgReveal = useSharedValue(0);
  const pulseScale = useSharedValue(1);

  const finishLaunch = () => {
    if (finished.current) return;
    finished.current = true;
    onCompleteRef.current();
  };

  useEffect(() => {
    const duration = reduced ? 480 : LAUNCH_MS;

    if (!reduced) {
      bloom.value = withTiming(1, {
        duration: LAUNCH_MS - 180,
        easing: Easing.inOut(Easing.cubic),
      });
      bgReveal.value = withTiming(1, {
        duration: LAUNCH_MS,
        easing: Easing.out(Easing.cubic),
      });
      pulseScale.value = withSequence(
        withTiming(1.06, { duration: 360, easing: Easing.out(Easing.cubic) }),
        withTiming(1, {
          duration: LAUNCH_MS - 360,
          easing: Easing.inOut(Easing.cubic),
        })
      );

      const hapticAt = [0, RING_STAGGER_MS, RING_STAGGER_MS * 2, RING_STAGGER_MS * 3];
      const hapticStyles = [
        Haptics.ImpactFeedbackStyle.Light,
        Haptics.ImpactFeedbackStyle.Light,
        Haptics.ImpactFeedbackStyle.Medium,
        Haptics.ImpactFeedbackStyle.Heavy,
      ] as const;
      const hapticTimers = hapticAt.map((ms, i) =>
        setTimeout(() => {
          Haptics.impactAsync(hapticStyles[i]).catch(() => {});
        }, ms)
      );

      const completeTimer = setTimeout(() => {
        Haptics.notificationAsync(
          Haptics.NotificationFeedbackType.Success
        ).catch(() => {});
        finishLaunch();
      }, duration);

      return () => {
        hapticTimers.forEach(clearTimeout);
        clearTimeout(completeTimer);
      };
    }

    const completeTimer = setTimeout(finishLaunch, duration);
    return () => clearTimeout(completeTimer);
  }, [reduced, bloom, bgReveal, pulseScale]);

  const bloomStyle = useAnimatedStyle(() => ({
    opacity: 0.12 + bloom.value * 0.38,
    transform: [{ scale: 0.85 + bloom.value * 0.35 }],
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: 0.06 + bgReveal.value * 0.2,
    transform: [{ scale: 0.9 + bgReveal.value * 0.14 }],
  }));

  const bgTintStyle = useAnimatedStyle(() => ({
    opacity: bgReveal.value * 0.12,
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const screenEnter = reduced ? FadeIn.duration(1) : FadeIn.duration(380);
  const screenExit = reduced ? FadeOut.duration(1) : FadeOut.duration(320);

  return (
    <Animated.View
      entering={screenEnter}
      exiting={screenExit}
      style={styles.container}
    >
      <Animated.View style={[styles.bgWrap, bgStyle]} pointerEvents="none">
        <SvgXml xml={synqSvg} width="115%" height="115%" />
      </Animated.View>
      <Animated.View
        style={[styles.bgTint, bgTintStyle]}
        pointerEvents="none"
      />

      <View style={styles.stage}>
        <View style={styles.pulseArea}>
          {Array.from({ length: RING_COUNT }, (_, i) => (
            <SonarRing key={i} index={i} disabled={reduced} />
          ))}
          <Animated.View style={[styles.pulseGlow, bloomStyle]} pointerEvents="none" />
          <Animated.View style={pulseStyle}>
            <ExpoImage
              source={require("../../assets/pulse.gif")}
              style={styles.pulseGif}
              contentFit="contain"
              transition={0}
              cachePolicy="memory-disk"
            />
          </Animated.View>
        </View>
      </View>

    </Animated.View>
  );
}

const PULSE_SIZE = 252;
const STAGE = 300;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  bgWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  bgTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: ACCENT,
  },
  stage: {
    alignItems: "center",
    justifyContent: "center",
  },
  pulseArea: {
    width: STAGE,
    height: STAGE,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    borderWidth: 2,
    borderColor: "rgba(0,255,133,0.42)",
  },
  pulseGlow: {
    position: "absolute",
    width: PULSE_SIZE + 28,
    height: PULSE_SIZE + 28,
    borderRadius: (PULSE_SIZE + 28) / 2,
    backgroundColor: "rgba(0,255,133,0.32)",
  },
  pulseGif: {
    width: PULSE_SIZE,
    height: PULSE_SIZE,
  },
});
