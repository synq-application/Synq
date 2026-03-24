import { ACCENT, BG, BORDER, fonts, MUTED2, TEXT } from "@/constants/Variables";
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
  buttonText?: string;
  onClose: () => void;
};

export default function AlertModal({
  visible,
  title,
  message,
  buttonText = "OK",
  onClose,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.container}>
          {title && <Text style={styles.title}>{title}</Text>}

          <Text style={styles.message}>{message}</Text>

          <TouchableOpacity
            style={styles.button}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>{buttonText}</Text>
          </TouchableOpacity>
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
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: "center",
  },

  title: {
    color: TEXT,
    fontSize: 18,
    fontFamily: fonts.heavy,
    marginBottom: 6,
    textAlign: "center",
  },

  message: {
    color: MUTED2,
    fontSize: 14,
    fontFamily: fonts.book,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },

  button: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 28,
  },

  buttonText: {
    color: "#061006",
    fontFamily: fonts.heavy,
    fontSize: 14,
  },
});