import { resolveAvatar } from "@/app/helpers";
import {
  ACCENT,
  BUTTON_RADIUS,
  fonts,
  MUTED2,
  ON_ACCENT_TEXT,
  RADIUS_MD,
  TEXT,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type SynqNudgeCardProps = {
  onNudge: () => void;
  loading?: boolean;
  sent?: boolean;
  /** When set, renders a list-row layout with avatar and name. */
  friend?: { displayName?: string; imageurl?: string };
};

export default function SynqNudgeCard({
  onNudge,
  loading = false,
  sent = false,
  friend,
}: SynqNudgeCardProps) {
  const disabled = sent || loading;
  const firstName =
    friend?.displayName?.trim().split(/\s+/)[0] || "They";
  const showAvatar = !!friend;

  return (
    <View style={styles.outer}>
      <LinearGradient
        colors={
          sent
            ? ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.02)"]
            : ["rgba(0,255,133,0.14)", "rgba(0,255,133,0.04)", "rgba(255,255,255,0.02)"]
        }
        locations={sent ? [0, 1] : [0, 0.45, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}
      >
        <View style={[styles.card, sent && styles.cardSent]}>
          {showAvatar ? (
            <ExpoImage
              source={{ uri: resolveAvatar(friend?.imageurl) }}
              style={styles.avatar}
              cachePolicy="memory-disk"
              transition={0}
            />
          ) : null}

          <View style={styles.copy}>
            <View style={styles.statusRow}>
              {!sent ? (
                <View style={styles.statusDot} />
              ) : (
                <Ionicons
                  name="checkmark-circle"
                  size={14}
                  color={MUTED2}
                  style={styles.statusIcon}
                />
              )}
              <Text style={styles.kicker}>
                {sent ? "Nudge sent" : "Not currently active"}
              </Text>
            </View>
            <Text style={styles.subtitle} numberOfLines={2}>
              {sent
                ? `${firstName} will get a ping to see if they're free`
                : friend
                  ? `Ask ${firstName} if they're free to Synq`
                  : "Ask if they're free to Synq"}
            </Text>
          </View>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[styles.cta, sent && styles.ctaSent]}
            onPress={onNudge}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={
              sent
                ? `Nudge already sent${friend ? ` to ${friend.displayName}` : ""}`
                : `Nudge${friend ? ` ${friend.displayName}` : ""} — not currently active`
            }
          >
            {loading ? (
              <ActivityIndicator
                size="small"
                color={sent ? MUTED2 : ON_ACCENT_TEXT}
              />
            ) : (
              <Text style={[styles.ctaText, sent && styles.ctaTextSent]}>
                {sent ? "Nudged" : "Nudge"}
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </View>
  );
}

const SURFACE = "#0E1012";
const BORDER = "rgba(255,255,255,0.07)";

const styles = StyleSheet.create({
  outer: {
    width: "100%",
  },
  gradientBorder: {
    borderRadius: RADIUS_MD,
    padding: StyleSheet.hairlineWidth,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: SURFACE,
    borderRadius: RADIUS_MD - 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  cardSent: {
    backgroundColor: "#0A0B0D",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "rgba(255,255,255,0.28)",
  },
  statusIcon: {
    marginRight: -2,
  },
  kicker: {
    color: TEXT,
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.15,
  },
  subtitle: {
    color: MUTED2,
    fontFamily: fonts.book,
    fontSize: 12,
    lineHeight: 17,
  },
  cta: {
    minWidth: 76,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaSent: {
    backgroundColor: "transparent",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
  },
  ctaText: {
    color: ON_ACCENT_TEXT,
    fontFamily: fonts.heavy,
    fontSize: 14,
    letterSpacing: 0.2,
  },
  ctaTextSent: {
    color: MUTED2,
    fontFamily: fonts.medium,
  },
});
