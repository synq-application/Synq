import {
  ACCENT,
  BG,
  MUTED2,
  MUTED3,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  TAB_BAR_SCROLL_INSET,
  TEXT,
  TYPE_BODY,
  fonts,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import React from "react";
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
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = {
  memo: string;
  setMemo: (text: string) => void;
  onStartSynq: () => void;
  isStartingSynq?: boolean;
};

const PULSE_SIZE = 252;
/** Narrow column — status area aligns with pulse, not full screen width */
const CONTENT_W = 320;

export default function InactiveSynqView({
  memo,
  setMemo,
  onStartSynq,
  isStartingSynq = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const pressScale = useSharedValue(1);

  const bottomPad =
    TAB_BAR_SCROLL_INSET +
    SPACE_6 +
    (Platform.OS === "android" ? insets.bottom : 0);

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  const handlePressIn = () => {
    if (isStartingSynq) return;
    pressScale.value = withSpring(0.94, { damping: 18, stiffness: 320 });
  };

  const handlePressOut = () => {
    pressScale.value = withSpring(1, { damping: 16, stiffness: 280 });
  };

  const handlePress = () => {
    if (isStartingSynq) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onStartSynq();
  };

  const enter = reduced ? FadeIn.duration(1) : FadeInDown.duration(420).springify();

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + SPACE_5,
            paddingBottom: bottomPad,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        automaticallyAdjustKeyboardInsets
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        <Animated.View entering={enter} style={styles.stack}>
          <Text style={styles.headline}>
            Let&apos;s <Text style={styles.headlineAccent}>Synq.</Text>
          </Text>

          <View style={styles.memoSection}>
            <View style={styles.memoPill}>
              <View style={styles.memoRow}>
              <Ionicons
                name="chatbubble-ellipses-outline"
                size={17}
                color={ACCENT}
                style={styles.memoIcon}
              />
              <TextInput
                style={styles.memoInput}
                value={memo}
                onChangeText={setMemo}
                placeholder="What are you down for?"
                placeholderTextColor={MUTED3}
                blurOnSubmit
                returnKeyType="done"
                accessibilityLabel="Optional memo shown to friends"
              />
            </View>
            <View style={styles.memoOptionalBadgeWrap} pointerEvents="none">
              <View style={styles.memoOptionalBadge}>
                <Text style={styles.memoOptionalBadgeText}>Optional</Text>
              </View>
            </View>
            </View>
          </View>

          <View style={styles.pulseBlock}>
            <AnimatedPressable
              onPress={handlePress}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={isStartingSynq}
              style={[
                styles.pulseHit,
                pressStyle,
                isStartingSynq && styles.pulseStarting,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                isStartingSynq ? "Activating Synq" : "Tap to activate Synq"
              }
            >
              <View style={styles.pulseGlow} pointerEvents="none" />
              <View style={styles.pulseRing} pointerEvents="none" />
              <ExpoImage
                source={require("../../assets/pulse.gif")}
                style={styles.pulseGif}
                contentFit="contain"
                transition={0}
                cachePolicy="memory-disk"
              />
            </AnimatedPressable>
            <Pressable
              onPress={handlePress}
              disabled={isStartingSynq}
              hitSlop={{ top: 8, bottom: 12, left: 24, right: 24 }}
              style={styles.ctaHit}
              accessibilityRole="button"
              accessibilityLabel={
                isStartingSynq ? "Activating Synq" : "Tap to activate Synq"
              }
            >
              <Text style={styles.ctaLabel}>TAP TO ACTIVATE</Text>
            </Pressable>
          </View>
        </Animated.View>
      </ScrollView>
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
    justifyContent: "center",
    paddingHorizontal: SPACE_5,
  },
  stack: {
    width: "100%",
    maxWidth: CONTENT_W + 40,
    alignSelf: "center",
    alignItems: "center",
  },
  headline: {
    color: TEXT,
    fontSize: 32,
    lineHeight: 38,
    fontFamily: fonts.heavy,
    letterSpacing: -0.4,
    textAlign: "center",
    marginBottom: SPACE_6,
  },
  headlineAccent: {
    color: ACCENT,
    fontFamily: fonts.heavy,
  },
  memoSection: {
    width: CONTENT_W,
    alignSelf: "center",
    marginBottom: SPACE_5,
  },
  memoPill: {
    width: "100%",
    backgroundColor: "#141414",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: SPACE_4,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    position: "relative",
  },
  memoRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  memoIcon: {
    marginRight: SPACE_3,
  },
  memoInput: {
    flex: 1,
    color: TEXT,
    fontSize: TYPE_BODY,
    lineHeight: 22,
    fontFamily: fonts.book,
    padding: 0,
    margin: 0,
    minHeight: 24,
    backgroundColor: "transparent",
    paddingRight: 74,
  },
  memoOptionalBadgeWrap: {
    position: "absolute",
    right: 10,
    top: 0,
    bottom: 0,
    justifyContent: "center",
  },
  memoOptionalBadge: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.16)",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  memoOptionalBadgeText: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 12,
    lineHeight: 14,
    fontFamily: fonts.medium,
    letterSpacing: 0.2,
  },
  pulseBlock: {
    alignItems: "center",
    width: CONTENT_W,
    paddingTop: SPACE_3,
  },
  pulseHit: {
    width: 306,
    height: 288,
    alignItems: "center",
    justifyContent: "center",
  },
  pulseGlow: {
    position: "absolute",
    width: PULSE_SIZE + 6,
    height: PULSE_SIZE + 6,
    borderRadius: (PULSE_SIZE + 6) / 2,
    backgroundColor: "rgba(0,255,133,0.08)",
  },
  pulseRing: {
    position: "absolute",
    width: PULSE_SIZE + 2,
    height: PULSE_SIZE + 2,
    borderRadius: (PULSE_SIZE + 2) / 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.22)",
  },
  pulseGif: {
    width: PULSE_SIZE,
    height: PULSE_SIZE,
  },
  pulseStarting: {
    opacity: 0.88,
  },
  ctaHit: {
    marginTop: SPACE_5,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: SPACE_4,
  },
  ctaLabel: {
    color: MUTED2,
    fontSize: 13,
    lineHeight: 16,
    fontFamily: fonts.medium,
    letterSpacing: 1.4,
    textAlign: "center",
  },
});
