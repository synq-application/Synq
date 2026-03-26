import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  MUTED2,
  TEXT,
  fonts,
} from "@/constants/Variables";
import React from "react";
import {
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type Props = {
  visible: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
};

export default function ConfirmModal({
  visible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {title && <Text style={styles.title}>{title}</Text>}

          <Text style={styles.message}>{message}</Text>

          <View style={styles.actions}>
            <TouchableOpacity
              onPress={onCancel}
              style={styles.cancelBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={onConfirm}
              style={[
                styles.confirmBtn,
                destructive && styles.destructiveBtn,
              ]}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.confirmText,
                  destructive && styles.destructiveText,
                ]}
              >
                {confirmText}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  container: {
    width: "100%",
    backgroundColor: BG,
    borderRadius: BUTTON_RADIUS,
    padding: 22,
    borderWidth: 1,
    borderColor: BORDER,
  },

  title: {
    color: TEXT,
    fontSize: 18,
    fontFamily: fonts.heavy,
    marginBottom: 8,
  },

  message: {
    color: MUTED2,
    fontSize: 14,
    fontFamily: fonts.book,
    lineHeight: 20,
    marginBottom: 20,
  },

  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },

  cancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginRight: 10,
  },

  cancelText: {
    color: MUTED2,
    fontFamily: fonts.medium,
    fontSize: 14,
  },

  confirmBtn: {
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },

  confirmText: {
    color: "#061006",
    fontFamily: fonts.heavy,
    fontSize: 14,
  },

  destructiveBtn: {
    backgroundColor: "rgba(255,69,58,0.12)",
    borderWidth: 1,
    borderColor: "#ff453a",
  },

  destructiveText: {
    color: "#ff453a",
  },
});