import SynqAudiencePicker from "@/src/components/synq/SynqAudiencePicker";
import {
  ACCENT,
  BORDER,
  BUTTON_RADIUS,
  fonts,
  SPACE_3,
  SPACE_4,
  TEXT,
} from "@/constants/Variables";
import type { FriendGroup } from "@/src/lib/friendGroups";
import type { SynqAudienceSelection } from "@/src/lib/synqBroadcast";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Opaque panel fill — matches SynqOptionsSheet / SynqAudienceSheet. */
const SHEET_SURFACE = "#141414";

type Props = {
  visible: boolean;
  groups: FriendGroup[];
  initialSelection: SynqAudienceSelection;
  onClose: () => void;
  onSave: (selection: SynqAudienceSelection) => Promise<void>;
};

export default function ChangeSynqAudienceModal({
  visible,
  groups,
  initialSelection,
  onClose,
  onSave,
}: Props) {
  const insets = useSafeAreaInsets();
  const [selection, setSelection] = useState<SynqAudienceSelection>(initialSelection);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) setSelection(initialSelection);
  }, [visible, initialSelection]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(selection);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityLabel="Close change audience"
        />
        <View style={[styles.sheetGroup, { paddingBottom: insets.bottom + SPACE_3 }]}>
          <View style={styles.sheetCard}>
            <View style={styles.headerRow}>
              <Text style={styles.sheetTitle}>Change audience</Text>
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => void handleSave()}
                disabled={saving}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Save audience"
                hitSlop={8}
              >
                {saving ? (
                  <ActivityIndicator color={ACCENT} size="small" />
                ) : (
                  <Text style={styles.saveBtnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <SynqAudiencePicker
                groups={groups}
                selection={selection}
                onChangeSelection={setSelection}
                compact
              />
            </ScrollView>
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
    paddingHorizontal: 12,
  },
  sheetCard: {
    backgroundColor: SHEET_SURFACE,
    borderRadius: BUTTON_RADIUS + 4,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
    maxHeight: Dimensions.get("window").height * 0.58,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: SPACE_3 + 2,
    paddingBottom: SPACE_3,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.06)",
  },
  sheetTitle: {
    flex: 1,
    color: TEXT,
    fontSize: 16,
    fontFamily: fonts.heavy,
    marginRight: SPACE_3,
  },
  saveBtn: {
    minWidth: 44,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: ACCENT,
    fontSize: 16,
    fontFamily: fonts.heavy,
    letterSpacing: 0.1,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingBottom: SPACE_3,
  },
});
