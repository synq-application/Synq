import { resolveAvatar } from "@/app/helpers";
import {
  ACCENT,
  BORDER,
  fonts,
  MUTED2,
  RADIUS_MD,
  SURFACE,
  TEXT,
} from "@/constants/Variables";
import { Image as ExpoImage } from "expo-image";
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
        <Text style={styles.kicker}>
          {sent ? "Nudge sent" : "Inactive right now"}
        </Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {sent
            ? `${firstName} got a ping to see if they're free`
            : friend
              ? `See if ${firstName} is free`
              : "See if they're free"}
        </Text>
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        style={[styles.cta, sent && styles.ctaSent]}
        onPress={onNudge}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={
          sent
            ? `Nudge already sent${friend ? ` to ${friend.displayName}` : ""}`
            : `Nudge${friend ? ` ${friend.displayName}` : ""}`
        }
      >
        {loading ? (
          <ActivityIndicator size="small" color={sent ? MUTED2 : ACCENT} />
        ) : (
          <Text style={[styles.ctaText, sent && styles.ctaTextSent]}>
            {sent ? "Sent" : "Nudge"}
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: SURFACE,
    borderRadius: RADIUS_MD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.18)",
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  cardSent: {
    borderColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  kicker: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
  subtitle: {
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: 15,
    lineHeight: 21,
    opacity: 0.92,
  },
  cta: {
    minWidth: 58,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(0,255,133,0.45)",
    backgroundColor: "rgba(0,255,133,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  ctaSent: {
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "transparent",
  },
  ctaText: {
    color: ACCENT,
    fontFamily: fonts.medium,
    fontSize: 13,
    letterSpacing: 0.1,
  },
  ctaTextSent: {
    color: MUTED2,
  },
});
