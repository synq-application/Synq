import {
  ACCENT,
  BG,
  MUTED,
  MUTED2,
  MUTED3,
  RADIUS_MD,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  TAB_BAR_SCROLL_INSET,
  TEXT,
  TYPE_BODY,
  fonts,
  synqSvg,
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
  useReducedMotion,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";

type Props = {
  memo: string;
  setMemo: (text: string) => void;
  onStartSynq: () => void;
  isStartingSynq?: boolean;
};

const STAGGER = [0, 80, 160] as const;

function entering(reduced: boolean, delayMs: number) {
  if (reduced) return FadeIn.duration(1);
  return FadeInDown.duration(400).delay(delayMs);
}

export default function InactiveSynqView({
  memo,
  setMemo,
  onStartSynq,
  isStartingSynq = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const bottomPad =
    TAB_BAR_SCROLL_INSET + (Platform.OS === "android" ? insets.bottom : 0);

  const handlePress = () => {
    if (isStartingSynq) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onStartSynq();
  };

  return (
    <View style={styles.root}>
      <View pointerEvents="none" style={styles.bgSvgWrap}>
        <SvgXml xml={synqSvg} width="120%" height="120%" />
      </View>

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
        <View style={styles.stack}>
          <Animated.View
            entering={entering(reduced, STAGGER[0])}
            style={styles.heroCopy}
          >
            <Text style={styles.heroTitle}>
              See who's <Text style={styles.heroAccent}>free.</Text>
            </Text>
            <Text style={styles.heroSubtitle}>
              Tap the pulse to start making plans.
            </Text>
          </Animated.View>

          <Animated.View
            entering={entering(reduced, STAGGER[1])}
            style={styles.memoRow}
          >
            <Ionicons
              name="chatbubble-ellipses-outline"
              size={16}
              color={MUTED2}
              style={styles.memoIcon}
            />
            <TextInput
              style={styles.memoInput}
              value={memo}
              onChangeText={setMemo}
              placeholder="Memo (optional)"
              placeholderTextColor={MUTED3}
              blurOnSubmit
              returnKeyType="done"
              accessibilityLabel="Optional memo shown to friends when you start Synq"
            />
          </Animated.View>

          <Animated.View
            entering={entering(reduced, STAGGER[2])}
            style={styles.pulseWrap}
          >
            <Pressable
              onPress={handlePress}
              disabled={isStartingSynq}
              style={({ pressed }) => [
                styles.pulseBox,
                pressed && !isStartingSynq && styles.pulsePressed,
                isStartingSynq && styles.pulseStarting,
              ]}
              accessibilityRole="button"
              accessibilityLabel={
                isStartingSynq
                  ? "Starting Synq"
                  : "Start Synq and show friends you are available"
              }
              accessibilityHint="Shows friends who are free right now"
            >
              <ExpoImage
                source={require("../../assets/pulse.gif")}
                style={styles.gifLarge}
                contentFit="contain"
                transition={0}
                cachePolicy="memory-disk"
              />
            </Pressable>
          </Animated.View>
        </View>
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
  bgSvgWrap: {
    position: "absolute",
    top: -45,
    left: -45,
    right: -45,
    bottom: -45,
    opacity: 0.22,
    transform: [{ rotate: "-10deg" }],
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: SPACE_5,
    justifyContent: "center",
  },
  stack: {
    width: "100%",
    maxWidth: 400,
    alignSelf: "center",
    alignItems: "center",
  },
  heroCopy: {
    width: "100%",
    alignItems: "center",
    marginBottom: SPACE_4,
  },
  heroTitle: {
    color: TEXT,
    fontSize: 34,
    lineHeight: 40,
    fontFamily: fonts.heavy,
    letterSpacing: 0.15,
    textAlign: "center",
  },
  heroAccent: {
    color: ACCENT,
    fontFamily: fonts.heavy,
  },
  heroSubtitle: {
    color: MUTED,
    fontSize: TYPE_BODY,
    lineHeight: 24,
    fontFamily: fonts.medium,
    textAlign: "center",
    marginTop: SPACE_4,
    maxWidth: 300,
  },
  memoRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    maxWidth: 300,
    marginTop: SPACE_4,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: RADIUS_MD,
    paddingHorizontal: SPACE_4,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    marginBottom: SPACE_6,
  },
  memoIcon: {
    marginRight: SPACE_3,
  },
  memoInput: {
    flex: 1,
    color: TEXT,
    fontSize: TYPE_BODY,
    lineHeight: 22,
    fontFamily: fonts.medium,
    padding: 0,
    margin: 0,
    minHeight: 22,
    backgroundColor: "transparent",
  },
  pulseWrap: {
    alignItems: "center",
  },
  pulseBox: {
    width: 306,
    height: 288,
    justifyContent: "center",
    alignItems: "center",
  },
  pulsePressed: {
    opacity: 0.9,
  },
  pulseStarting: {
    opacity: 0.9,
  },
  gifLarge: {
    width: 252,
    height: 252,
  },
});
