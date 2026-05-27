import {
  ACCENT,
  BG,
  BORDER,
  MUTED2,
  MUTED3,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  SURFACE,
  TAB_BAR_SCROLL_INSET,
  TEXT,
  TYPE_BODY,
  fonts,
} from "@/constants/Variables";
import SynqAudienceSheet from "@/app/synq-screens/SynqAudienceSheet";
import type { FriendGroup } from "@/src/lib/friendGroups";
import { formatAudienceSelectionLabel, type SynqAudienceSelection } from "@/src/lib/synqBroadcast";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { Image as ExpoImage } from "expo-image";
import React, { useState } from "react";
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
  friendGroups: FriendGroup[];
  audienceSelection: SynqAudienceSelection;
  onAudienceSelectionChange: (next: SynqAudienceSelection) => void;
};

const PULSE_SIZE = 252;
const CONTENT_W = 320;
const IDLE_CONTENT_TOP_NUDGE = 16;

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

  const audienceLabel = formatAudienceSelectionLabel(audienceSelection, friendGroups);

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

  const openAudienceSheet = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setAudienceSheetOpen(true);
  };

  const enter = reduced ? FadeIn.duration(1) : FadeInDown.duration(420).springify();

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + SPACE_5 + IDLE_CONTENT_TOP_NUDGE,
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

          <View style={styles.composeSection}>
            <View style={styles.composePill}>
              <View style={styles.memoRow}>
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={17}
                  color={MUTED2}
                  style={styles.rowIcon}
                />
                <TextInput
                  style={styles.memoInput}
                  value={memo}
                  onChangeText={setMemo}
                  placeholder="What are you down for?"
                  placeholderTextColor={MUTED3}
                  blurOnSubmit
                  returnKeyType="done"
                  accessibilityLabel="What you're down for"
                  accessibilityHint="Optional. Leave blank to skip."
                />
              </View>
              <View style={styles.composeDivider} />
              <Pressable
                onPress={openAudienceSheet}
                style={({ pressed }) => [styles.audienceRow, pressed && styles.audienceRowPressed]}
                accessibilityRole="button"
                accessibilityLabel={`Share with ${audienceLabel}`}
                accessibilityHint="Opens audience picker"
              >
                <Ionicons name="people-outline" size={17} color={MUTED2} style={styles.rowIcon} />
                <Text style={styles.audienceValue} numberOfLines={1}>
                  {audienceLabel}
                </Text>
                <Ionicons name="chevron-forward" size={16} color={MUTED3} />
              </Pressable>
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
  composeSection: {
    width: CONTENT_W,
    alignSelf: "center",
    marginBottom: SPACE_5,
  },
  composePill: {
    width: "100%",
    backgroundColor: SURFACE,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  memoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE_4 + 2,
    paddingVertical: Platform.OS === "ios" ? 11 : 9,
  },
  composeDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginHorizontal: SPACE_4,
  },
  audienceRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE_4 + 2,
    paddingVertical: Platform.OS === "ios" ? 11 : 9,
  },
  audienceRowPressed: {
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  rowIcon: {
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
  audienceValue: {
    flex: 1,
    color: TEXT,
    fontSize: TYPE_BODY,
    lineHeight: 22,
    fontFamily: fonts.medium,
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
