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
import {
  BG,
  BORDER,
  BUTTON_RADIUS,
  DESTRUCTIVE,
  TEXT,
  fonts,
} from "../../constants/Variables";

type Props = {
  visible: boolean;
  onClose: () => void;
  onEditMemo: () => void;
  onEndSynq: () => void;
};

export default function SynqOptionsSheet({
  visible,
  onClose,
  onEditMemo,
  onEndSynq,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close menu" />
        <View style={styles.sheetGroup}>
          <View style={styles.sheet}>
            <TouchableOpacity
              style={styles.option}
              onPress={() => {
                onClose();
                onEditMemo();
              }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Edit status"
            >
              <Ionicons name="create-outline" size={22} color={TEXT} />
              <Text style={styles.optionText}>Edit status</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.option}
              onPress={() => {
                onClose();
                onEndSynq();
              }}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="End Synq"
            >
              <Ionicons name="stop-circle-outline" size={22} color={DESTRUCTIVE} />
              <Text style={[styles.optionText, styles.destructiveText]}>End Synq</Text>
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetGroup: {
    paddingHorizontal: 12,
    paddingBottom: 34,
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
