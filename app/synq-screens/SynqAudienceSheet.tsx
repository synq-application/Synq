import SynqAudiencePicker from "@/src/components/synq/SynqAudiencePicker";
import {
  BG,
  BORDER,
  BUTTON_RADIUS,
  fonts,
  SPACE_4,
  SPACE_5,
  TEXT,
} from "@/constants/Variables";
import type { FriendGroup } from "@/src/lib/friendGroups";
import type { SynqAudienceSelection } from "@/src/lib/synqBroadcast";
import React from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  groups: FriendGroup[];
  selection: SynqAudienceSelection;
  onChangeSelection: (next: SynqAudienceSelection) => void;
  onClose: () => void;
};

export default function SynqAudienceSheet({
  visible,
  groups,
  selection,
  onChangeSelection,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" />
        <View style={[styles.sheetGroup, { paddingBottom: insets.bottom + SPACE_4 }]}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Share with</Text>
            <SynqAudiencePicker
              groups={groups}
              selection={selection}
              onChangeSelection={onChangeSelection}
            />
          </View>
          <TouchableOpacity
            style={styles.doneBtn}
            onPress={onClose}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Done"
          >
            <Text style={styles.doneText}>Done</Text>
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
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheetGroup: {
    paddingHorizontal: SPACE_5,
    gap: 10,
  },
  sheet: {
    backgroundColor: BG,
    borderRadius: BUTTON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    paddingTop: SPACE_4,
    paddingBottom: SPACE_4,
    overflow: "hidden",
  },
  sheetTitle: {
    color: TEXT,
    fontSize: 17,
    fontFamily: fonts.heavy,
    textAlign: "center",
    marginBottom: SPACE_4,
    paddingHorizontal: SPACE_4,
  },
  doneBtn: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderRadius: BUTTON_RADIUS,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  doneText: {
    color: TEXT,
    fontSize: 17,
    fontFamily: fonts.medium,
  },
});
