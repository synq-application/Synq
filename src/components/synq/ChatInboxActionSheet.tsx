import {
  BG,
  BORDER,
  BUTTON_RADIUS,
  DESTRUCTIVE,
  MUTED2,
  TEXT,
  fonts,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  chatTitle: string;
  isPinned: boolean;
  canCombine: boolean;
  onClose: () => void;
  onPin: () => void;
  onCombine: () => void;
  onDelete: () => void;
};

export default function ChatInboxActionSheet({
  visible,
  chatTitle,
  isPinned,
  canCombine,
  onClose,
  onPin,
  onCombine,
  onDelete,
}: Props) {
  const insets = useSafeAreaInsets();

  if (!visible) return null;

  return (
    <View style={styles.portal} pointerEvents="box-none">
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Close menu"
      />
      <View
        style={[
          styles.sheetGroup,
          { paddingBottom: Math.max(insets.bottom, 12) + 8 },
        ]}
        pointerEvents="box-none"
      >
        <Text style={styles.sheetTitle} numberOfLines={1}>
          {chatTitle}
        </Text>
        <View style={styles.sheet}>
          <TouchableOpacity
            style={styles.option}
            onPress={onPin}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel={isPinned ? "Unpin conversation" : "Pin conversation"}
          >
            <Ionicons
              name={isPinned ? "pin" : "pin-outline"}
              size={22}
              color={TEXT}
            />
            <Text style={styles.optionText}>
              {isPinned ? "Unpin chat" : "Pin chat"}
            </Text>
          </TouchableOpacity>
          {canCombine ? (
            <>
              <View style={styles.divider} />
              <TouchableOpacity
                style={styles.option}
                onPress={onCombine}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Combine with another chat"
              >
                <Ionicons name="people-outline" size={22} color={TEXT} />
                <Text style={styles.optionText}>Combine with another chat</Text>
              </TouchableOpacity>
            </>
          ) : null}
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.option}
            onPress={onDelete}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityLabel="Delete conversation"
          >
            <Ionicons name="trash-outline" size={22} color={DESTRUCTIVE} />
            <Text style={[styles.optionText, styles.destructiveText]}>
              Delete chat
            </Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity
          style={styles.cancelBtn}
          onPress={onClose}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  portal: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 200,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  sheetGroup: {
    paddingHorizontal: 12,
    zIndex: 1,
  },
  sheetTitle: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 10,
    paddingHorizontal: 24,
  },
  sheet: {
    backgroundColor: "#141414",
    borderRadius: BUTTON_RADIUS + 4,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 14,
  },
  optionText: {
    color: TEXT,
    fontSize: 17,
    fontFamily: fonts.medium,
  },
  destructiveText: {
    color: DESTRUCTIVE,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: 54,
  },
  cancelBtn: {
    marginTop: 10,
    backgroundColor: BG,
    borderRadius: BUTTON_RADIUS + 4,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 16,
    alignItems: "center",
  },
  cancelText: {
    color: TEXT,
    fontSize: 17,
    fontFamily: fonts.heavy,
  },
});
