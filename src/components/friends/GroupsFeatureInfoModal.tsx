import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  MODAL_RADIUS,
  ON_ACCENT_TEXT,
  fonts,
  MUTED2,
  TEXT,
  TYPE_BODY,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export type GroupsFeatureInfoVariant = "circles" | "community";

type Props = {
  visible: boolean;
  variant: GroupsFeatureInfoVariant;
  onClose: () => void;
};

const COPY: Record<
  GroupsFeatureInfoVariant,
  {
    title: string;
    icon: keyof typeof Ionicons.glyphMap;
    body: string;
  }
> = {
  circles: {
    title: "Circles",
    icon: "lock-closed-outline",
    body: "Private groups only you control. Add friends to a circle to choose exactly who sees when you're available.",
  },
  community: {
    title: "Community",
    icon: "earth-outline",
    body: "Open groups anyone can find and join. Discover people who share your interests and grow beyond your existing circles.",
  },
};

export default function GroupsFeatureInfoModal({ visible, variant, onClose }: Props) {
  const content = COPY[variant];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={styles.card}>
          <View style={styles.iconRing}>
            <Ionicons name={content.icon} size={24} color={ACCENT} />
          </View>

          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.body}>{content.body}</Text>

          <TouchableOpacity
            style={styles.button}
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Got it"
          >
            <Text style={styles.buttonText}>Got it</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 28,
  },
  card: {
    width: "100%",
    backgroundColor: BG,
    borderRadius: MODAL_RADIUS,
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
  },
  iconRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,255,133,0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.22)",
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.heavy,
    fontSize: 20,
    color: TEXT,
    letterSpacing: 0.06,
    marginBottom: 10,
    textAlign: "center",
  },
  body: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    lineHeight: 22,
    letterSpacing: 0.02,
    textAlign: "center",
    marginBottom: 22,
  },
  button: {
    minWidth: 140,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 13,
    paddingHorizontal: 28,
    alignItems: "center",
    backgroundColor: ACCENT,
  },
  buttonText: {
    fontFamily: fonts.heavy,
    fontSize: TYPE_BODY,
    color: ON_ACCENT_TEXT,
    letterSpacing: 0.04,
  },
});
