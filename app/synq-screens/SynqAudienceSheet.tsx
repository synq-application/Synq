import SynqAudiencePicker from "@/src/components/synq/SynqAudiencePicker";
import {
  ACCENT,
  BORDER,
  BUTTON_RADIUS,
  fonts,
  ON_ACCENT_TEXT,
  PRIMARY_CTA_HEIGHT,
  PRIMARY_CTA_WIDTH,
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

/** Opaque panel fill — matches SynqOptionsSheet sheet. */
const SHEET_SURFACE = "#141414";

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
          <View style={styles.sheetCard}>
            <Text style={styles.sheetTitle}>Share with</Text>
            <SynqAudiencePicker
              groups={groups}
              selection={selection}
              onChangeSelection={onChangeSelection}
            />
            <View style={styles.footer}>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={onClose}
                activeOpacity={0.88}
                accessibilityRole="button"
                accessibilityLabel="Done"
              >
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
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
    paddingHorizontal: SPACE_5,
  },
  sheetCard: {
    backgroundColor: SHEET_SURFACE,
    borderRadius: BUTTON_RADIUS + 4,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  sheetTitle: {
    color: TEXT,
    fontSize: 17,
    fontFamily: fonts.heavy,
    textAlign: "center",
    paddingTop: SPACE_4 + 2,
    paddingBottom: SPACE_4,
    paddingHorizontal: SPACE_4,
  },
  footer: {
    alignItems: "center",
    paddingHorizontal: SPACE_4,
    paddingTop: SPACE_4,
    paddingBottom: SPACE_4 + 2,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    backgroundColor: SHEET_SURFACE,
  },
  doneBtn: {
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
    backgroundColor: ACCENT,
    borderRadius: BUTTON_RADIUS,
    minHeight: PRIMARY_CTA_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE_4,
  },
  doneText: {
    color: ON_ACCENT_TEXT,
    fontSize: 17,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
});
