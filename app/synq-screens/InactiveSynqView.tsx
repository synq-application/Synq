import {
  ACCENT,
  BG,
  MUTED2,
  MUTED3,
  SPACE_2,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  TAB_BAR_SCROLL_INSET,
  TEXT,
  fonts,
} from "@/constants/Variables";
import SynqAudienceSheet from "@/app/synq-screens/SynqAudienceSheet";
import type { FriendGroup } from "@/src/lib/friendGroups";
import { formatAudienceSelectionLabel, type SynqAudienceSelection } from "@/src/lib/synqBroadcast";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import React, { useEffect, useState } from "react";
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  memo: string;
  setMemo: (text: string) => void;
  onStartSynq: () => void;
  isStartingSynq?: boolean;
  friendGroups: FriendGroup[];
  audienceSelection: SynqAudienceSelection;
  onAudienceSelectionChange: (next: SynqAudienceSelection) => void;
};

const PULSE_SIZE = 238;
const ORB_STAGE = 312;
const CONTENT_W = 322;
const IDLE_RING_COUNT = 2;
const IDLE_RING_CYCLE_MS = 4000;
const IDLE_RING_STAGGER_MS = 1400;

const MOOD_HINTS = [
  "What are you down for?",
  "Drinks tonight?",
  "What's the move?",
  "Who's out?",
];
const MOOD_HINT_INTERVAL_MS = 9000;

const FIELD_BG_FOCUS = "rgba(255,255,255,0.05)";
const ICON_WELL_BG = "rgba(0,255,133,0.07)";
const ICON_MUTED = "rgba(0,255,133,0.88)";

// ——— Mood hints ———

function SlowMoodPlaceholder({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!active || reduced) return;
    const advance = () => setIndex((i) => (i + 1) % MOOD_HINTS.length);
    const id = setInterval(() => {
      opacity.value = withTiming(0, { duration: 600 }, (finished) => {
        if (finished) {
          runOnJS(advance)();
          opacity.value = withTiming(1, { duration: 720 });
        }
      });
    }, MOOD_HINT_INTERVAL_MS);
    return () => clearInterval(id);
  }, [active, reduced, opacity]);

  const ghostStyle = useAnimatedStyle(() => ({ opacity: opacity.value * 0.92 }));

  if (!active) {
    if (reduced) {
      return (
        <Text style={styles.moodGhost} numberOfLines={1}>
          {MOOD_HINTS[0]}
        </Text>
      );
    }
    return null;
  }

  return (
    <Animated.Text pointerEvents="none" style={[styles.moodGhost, ghostStyle]} numberOfLines={1}>
      {MOOD_HINTS[index]}
    </Animated.Text>
  );
}

// ——— Orb effects ———

function IdleSonarRing({ index, disabled }: { index: number; disabled: boolean }) {
  const scale = useSharedValue(0.84);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (disabled) return;
    const delay = index * IDLE_RING_STAGGER_MS;
    const loopMs = IDLE_RING_CYCLE_MS + (IDLE_RING_COUNT - 1) * IDLE_RING_STAGGER_MS;

    const runCycle = () => {
      scale.value = 0.84;
      opacity.value = 0.14;
      scale.value = withDelay(
        delay,
        withTiming(1.52, { duration: IDLE_RING_CYCLE_MS, easing: Easing.out(Easing.cubic) })
      );
      opacity.value = withDelay(
        delay,
        withTiming(0, { duration: IDLE_RING_CYCLE_MS, easing: Easing.out(Easing.quad) })
      );
    };

    runCycle();
    const id = setInterval(runCycle, loopMs);
    return () => clearInterval(id);
  }, [disabled, index, opacity, scale]);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.idleRing, ringStyle]} pointerEvents="none" />;
}

function OrbEdgeShimmer({ disabled }: { disabled: boolean }) {
  const shimmer = useSharedValue(0.14);

  useEffect(() => {
    if (disabled) return;
    shimmer.value = withRepeat(
      withSequence(
        withTiming(0.34, { duration: 3200, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.12, { duration: 3200, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [disabled, shimmer]);

  const style = useAnimatedStyle(() => ({ opacity: shimmer.value }));
  return <Animated.View style={[styles.orbRingShimmer, style]} pointerEvents="none" />;
}

function ActivationOrb({
  disabled,
  pressStyle,
  onPress,
  onPressIn,
  onPressOut,
  isStartingSynq,
}: {
  disabled: boolean;
  pressStyle: ReturnType<typeof useAnimatedStyle>;
  onPress: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
  isStartingSynq: boolean;
}) {
  const reduced = useReducedMotion();
  const breathe = useSharedValue(1);
  const glow = useSharedValue(0.28);

  useEffect(() => {
    if (reduced || isStartingSynq) return;
    breathe.value = withRepeat(
      withSequence(
        withTiming(1.035, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    glow.value = withRepeat(
      withSequence(
        withTiming(0.4, { duration: 3000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.24, { duration: 3000, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [breathe, glow, isStartingSynq, reduced]);

  const haloFar = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value * 1.08 }],
    opacity: glow.value * 0.45,
  }));
  const haloNear = useAnimatedStyle(() => ({
    transform: [{ scale: 0.97 + (breathe.value - 1) * 2 }],
    opacity: 0.12 + glow.value * 0.35,
  }));

  return (
    <AnimatedPressable
      onPress={onPress}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      disabled={disabled}
      style={[styles.orbHit, pressStyle, isStartingSynq && styles.orbStarting]}
      accessibilityRole="button"
      accessibilityLabel={isStartingSynq ? "Activating Synq" : "Tap to activate Synq"}
    >
      {Array.from({ length: IDLE_RING_COUNT }, (_, i) => (
        <IdleSonarRing key={i} index={i} disabled={reduced || isStartingSynq} />
      ))}
      <Animated.View style={[styles.orbHaloFar, haloFar]} pointerEvents="none" />
      <Animated.View style={[styles.orbHaloNear, haloNear]} pointerEvents="none" />
      <View style={styles.orbHaloCore} pointerEvents="none" />
      <View style={styles.orbRingOuter} pointerEvents="none" />
      <OrbEdgeShimmer disabled={reduced || isStartingSynq} />
      <View style={styles.orbRingInner} pointerEvents="none" />
      <ExpoImage
        source={require("../../assets/pulse.gif")}
        style={styles.orbLogo}
        contentFit="contain"
        transition={0}
        cachePolicy="memory-disk"
      />
    </AnimatedPressable>
  );
}

// ——— Screen ———

export default function InactiveSynqView({
  memo,
  setMemo,
  onStartSynq,
  isStartingSynq = false,
  friendGroups,
  audienceSelection,
  onAudienceSelectionChange,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const pressScale = useSharedValue(1);
  const [audienceSheetOpen, setAudienceSheetOpen] = useState(false);
  const [memoFocused, setMemoFocused] = useState(false);
  const ctaGlow = useSharedValue(0.88);
  const panelFocus = useSharedValue(0);

  const audienceLabel = formatAudienceSelectionLabel(audienceSelection, friendGroups);
  const memoEmpty = memo.trim().length === 0;
  const showMoodHints = memoEmpty && !memoFocused;
  const panelActive = memoFocused || !memoEmpty;

  const bottomPad =
    TAB_BAR_SCROLL_INSET + SPACE_6 + (Platform.OS === "android" ? insets.bottom : 0);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const ctaStyle = useAnimatedStyle(() => ({
    opacity: ctaGlow.value,
  }));

  const moodRowStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(
      panelFocus.value,
      [0, 1],
      ["rgba(255,255,255,0)", FIELD_BG_FOCUS]
    ),
  }));

  useEffect(() => {
    if (reduced || isStartingSynq) return;
    ctaGlow.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2800, easing: Easing.inOut(Easing.sin) }),
        withTiming(0.8, { duration: 2800, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
  }, [ctaGlow, isStartingSynq, reduced]);

  useEffect(() => {
    panelFocus.value = withTiming(panelActive ? 1 : 0, {
      duration: panelActive ? 300 : 450,
      easing: Easing.out(Easing.cubic),
    });
  }, [panelActive, panelFocus]);

  const handlePressIn = () => {
    if (isStartingSynq) return;
    pressScale.value = withSpring(0.95, { damping: 20, stiffness: 340 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 18, stiffness: 300 });
  };

  const handlePress = () => {
    if (isStartingSynq) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onStartSynq();
  };

  const openAudienceSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAudienceSheetOpen(true);
  };

  const enter = (delay: number) =>
    reduced
      ? FadeIn.duration(1)
      : FadeInDown.delay(delay).duration(520).springify().damping(18);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + SPACE_6 + SPACE_5,
            paddingBottom: bottomPad,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <View style={styles.stack}>
          <Animated.View entering={enter(0)} style={styles.hero}>
            <Text style={styles.headline}>
              Let&apos;s <Text style={styles.headlineAccent}>Synq.</Text>
            </Text>
          </Animated.View>

          <Animated.View entering={enter(60)} style={styles.intentWrap}>
            <View style={styles.intentPanel}>
              <Animated.View style={[styles.intentRow, moodRowStyle]}>
                <View style={styles.iconWell}>
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={18}
                    color={ICON_MUTED}
                  />
                </View>
                <View style={styles.fieldBody}>
                  <SlowMoodPlaceholder active={showMoodHints} />
                  <TextInput
                    style={[styles.moodInput, showMoodHints && styles.moodInputGhost]}
                    value={memo}
                    onChangeText={setMemo}
                    onFocus={() => setMemoFocused(true)}
                    onBlur={() => setMemoFocused(false)}
                    placeholder=""
                    blurOnSubmit
                    returnKeyType="done"
                    accessibilityLabel="Mood or intention"
                    accessibilityHint="Optional. Friends see this while you're active."
                  />
                </View>
              </Animated.View>

              <View style={styles.intentRowDivider} />

              <Pressable
                onPress={openAudienceSheet}
                style={({ pressed }) => [
                  styles.intentRow,
                  pressed && styles.intentRowPressed,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Visible to ${audienceLabel}`}
                accessibilityHint="Opens audience picker"
              >
                <View style={styles.iconWell}>
                  <Ionicons name="eye-outline" size={18} color={ICON_MUTED} />
                </View>
                <Text style={styles.audienceLabel}>Visible to</Text>
                <View style={styles.audienceValueWrap}>
                  <Text style={styles.audienceValue} numberOfLines={1}>
                    {audienceLabel}
                  </Text>
                  <Ionicons name="chevron-down" size={14} color={MUTED3} />
                </View>
              </Pressable>
            </View>
          </Animated.View>

          <Animated.View entering={enter(120)} style={styles.activationBlock}>
            <View style={styles.stage}>
              <ActivationOrb
                disabled={isStartingSynq}
                pressStyle={pressStyle}
                onPress={handlePress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                isStartingSynq={isStartingSynq}
              />
            </View>
            <Pressable
              onPress={handlePress}
              disabled={isStartingSynq}
              hitSlop={{ top: 10, bottom: 14, left: 28, right: 28 }}
              style={styles.ctaBlock}
              accessibilityRole="button"
              accessibilityLabel={isStartingSynq ? "Activating Synq" : "Tap to activate Synq"}
            >
              <Animated.Text style={[styles.ctaText, ctaStyle]}>
                {isStartingSynq ? "ACTIVATING" : "TAP TO ACTIVATE"}
              </Animated.Text>
            </Pressable>
          </Animated.View>
        </View>
      </ScrollView>

      <SynqAudienceSheet
        visible={audienceSheetOpen}
        groups={friendGroups}
        selection={audienceSelection}
        onChangeSelection={onAudienceSelectionChange}
        onClose={() => setAudienceSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
    backgroundColor: "transparent",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACE_5,
  },
  stack: {
    flexGrow: 1,
    width: "100%",
    maxWidth: CONTENT_W + 48,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    paddingTop: SPACE_6,
    paddingBottom: SPACE_2,
  },
  hero: {
    alignItems: "center",
    marginBottom: SPACE_5,
  },
  headline: {
    color: TEXT,
    fontSize: 34,
    lineHeight: 40,
    fontFamily: fonts.heavy,
    letterSpacing: -0.6,
    textAlign: "center",
  },
  headlineAccent: {
    color: ACCENT,
    fontFamily: fonts.heavy,
  },
  intentWrap: {
    width: CONTENT_W,
    marginBottom: SPACE_6,
  },
  intentPanel: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.09)",
    backgroundColor: "rgba(255,255,255,0.025)",
    overflow: "hidden",
  },
  intentRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingHorizontal: SPACE_4,
    gap: SPACE_3,
  },
  intentRowPressed: {
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  intentRowDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginLeft: SPACE_4 + 32 + SPACE_3,
  },
  iconWell: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: ICON_WELL_BG,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  fieldBody: {
    flex: 1,
    minHeight: 24,
    justifyContent: "center",
  },
  moodGhost: {
    position: "absolute",
    left: 0,
    right: 0,
    color: MUTED3,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.book,
    letterSpacing: 0.1,
  },
  moodInput: {
    flex: 1,
    color: TEXT,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.book,
    padding: 0,
    margin: 0,
    minHeight: 24,
    backgroundColor: "transparent",
  },
  moodInputGhost: {
    color: "transparent",
  },
  audienceLabel: {
    color: MUTED3,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.book,
    letterSpacing: 0.08,
    flexShrink: 0,
  },
  audienceValueWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 6,
    minWidth: 0,
    marginLeft: SPACE_3,
  },
  audienceValue: {
    flexShrink: 1,
    color: MUTED2,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: fonts.medium,
    letterSpacing: 0.02,
    textAlign: "right",
  },
  activationBlock: {
    alignItems: "center",
    width: "100%",
    marginTop: -SPACE_2,
  },
  stage: {
    width: ORB_STAGE,
    height: ORB_STAGE,
    alignItems: "center",
    justifyContent: "center",
  },
  orbHit: {
    width: ORB_STAGE,
    height: ORB_STAGE,
    alignItems: "center",
    justifyContent: "center",
  },
  idleRing: {
    position: "absolute",
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.2)",
  },
  orbHaloFar: {
    position: "absolute",
    width: PULSE_SIZE + 36,
    height: PULSE_SIZE + 36,
    borderRadius: (PULSE_SIZE + 36) / 2,
    backgroundColor: "rgba(0,255,133,0.03)",
  },
  orbHaloNear: {
    position: "absolute",
    width: PULSE_SIZE + 16,
    height: PULSE_SIZE + 16,
    borderRadius: (PULSE_SIZE + 16) / 2,
    backgroundColor: "rgba(0,255,133,0.05)",
  },
  orbHaloCore: {
    position: "absolute",
    width: PULSE_SIZE + 4,
    height: PULSE_SIZE + 4,
    borderRadius: (PULSE_SIZE + 4) / 2,
    backgroundColor: "rgba(0,255,133,0.02)",
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 2,
  },
  orbRingOuter: {
    position: "absolute",
    width: PULSE_SIZE + 8,
    height: PULSE_SIZE + 8,
    borderRadius: (PULSE_SIZE + 8) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.1)",
  },
  orbRingShimmer: {
    position: "absolute",
    width: PULSE_SIZE + 2,
    height: PULSE_SIZE + 2,
    borderRadius: (PULSE_SIZE + 2) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.32)",
  },
  orbRingInner: {
    position: "absolute",
    width: PULSE_SIZE,
    height: PULSE_SIZE,
    borderRadius: PULSE_SIZE / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.16)",
  },
  orbLogo: {
    width: PULSE_SIZE,
    height: PULSE_SIZE,
  },
  orbStarting: {
    opacity: 0.9,
  },
  ctaBlock: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
    paddingHorizontal: SPACE_3,
    marginTop: -14,
  },
  ctaText: {
    color: MUTED2,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: fonts.medium,
    letterSpacing: 1.4,
    textTransform: "uppercase",
    textAlign: "center",
  },
});
