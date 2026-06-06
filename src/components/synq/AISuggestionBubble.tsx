import {
  ACCENT,
  BORDER,
  fonts,
  MUTED2,
  MUTED3,
  TEXT,
} from "@/constants/Variables";
import { formatVenueAddressDisplay, stripLegacyAiPrefix } from "@/app/helpers";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const CARD_RADIUS = 22;
const BORDER_GRADIENT = [
  "rgba(0,255,133,0.42)",
  "rgba(0,255,133,0.14)",
  "rgba(0,255,133,0.06)",
] as const;

type Props = {
  text: string;
  isLegacy: boolean;
  name?: string;
  address?: string;
  onPress: () => void;
  heartCount?: number;
};

export default function AISuggestionBubble({
  text,
  isLegacy,
  name,
  address,
  onPress,
  heartCount = 0,
}: Props) {
  const legacyBody = stripLegacyAiPrefix(text);
  const displayName = name?.trim() || "";
  const displayAddress = formatVenueAddressDisplay(address || "");
  const showVenue = !isLegacy && (displayName || displayAddress);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={
        showVenue
          ? `${displayName || displayAddress}. Tap to view on map.`
          : "Tap to view suggestion."
      }
      style={({ pressed }) => [styles.pressable, pressed && styles.pressablePressed]}
    >
      <LinearGradient
        colors={[...BORDER_GRADIENT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.borderShell}
      >
        <View style={styles.card}>
          <LinearGradient
            colors={["rgba(0,255,133,0.07)", "rgba(0,255,133,0)", "rgba(0,0,0,0)"]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.topGlow}
            pointerEvents="none"
          />

          <View style={styles.body}>
            {showVenue ? (
              <>
                {displayName ? (
                  <Text style={styles.venueName} numberOfLines={2}>
                    {displayName}
                  </Text>
                ) : null}
                {displayAddress ? (
                  <View style={styles.addressRow}>
                    <Ionicons
                      name="location-outline"
                      size={13}
                      color={MUTED2}
                      style={styles.addressIcon}
                    />
                    <Text style={styles.addressText} numberOfLines={2}>
                      {displayAddress}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={styles.legacyBody}>{legacyBody || text}</Text>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerHint}>View on map</Text>
            <Ionicons name="chevron-forward" size={12} color={MUTED3} />
          </View>
        </View>
      </LinearGradient>

      {heartCount > 0 ? (
        <View style={styles.heartReaction}>
          {Array.from({ length: heartCount }, (_, i) => (
            <View
              key={i}
              style={[styles.heartReactionBadge, i > 0 && styles.heartReactionOverlap]}
            >
              <Ionicons name="heart" size={12} color="#FF2D55" />
            </View>
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: "100%",
    position: "relative",
    overflow: "visible",
  },
  pressablePressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  borderShell: {
    borderRadius: CARD_RADIUS,
    padding: 1,
    ...Platform.select({
      ios: {
        shadowColor: ACCENT,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 12,
      },
      android: { elevation: 4 },
    }),
  },
  card: {
    borderRadius: CARD_RADIUS - 1,
    backgroundColor: "#101112",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  topGlow: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 72,
  },
  body: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 8,
  },
  venueName: {
    color: TEXT,
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fonts.heavy,
    letterSpacing: 0.1,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  addressIcon: {
    marginTop: 2,
  },
  addressText: {
    flex: 1,
    color: MUTED2,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.book,
  },
  legacyBody: {
    color: TEXT,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: fonts.book,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  footerHint: {
    color: MUTED3,
    fontSize: 12,
    fontFamily: fonts.medium,
    letterSpacing: 0.15,
  },
  heartReaction: {
    position: "absolute",
    bottom: -10,
    right: -10,
    flexDirection: "row",
    alignItems: "center",
  },
  heartReactionBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#1C1C1E",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.35,
        shadowRadius: 2,
      },
      android: { elevation: 2 },
    }),
  },
  heartReactionOverlap: {
    marginLeft: -5,
  },
});
