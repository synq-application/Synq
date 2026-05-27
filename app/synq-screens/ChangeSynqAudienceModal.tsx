import CloseButton from "@/src/components/CloseButton";
import SynqAudiencePicker from "@/src/components/synq/SynqAudiencePicker";
import {
  BG,
  BORDER,
  BUTTON_RADIUS,
  fonts,
  ON_ACCENT_TEXT,
  SPACE_4,
  SPACE_5,
  SURFACE,
  TEXT,
} from "@/constants/Variables";
import type { FriendGroup } from "@/src/lib/friendGroups";
import type { SynqAudienceSelection } from "@/src/lib/synqBroadcast";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <CloseButton onPress={onClose} />
          <Text style={styles.headerTitle}>Change audience</Text>
          <View style={styles.headerSpacer} />
        </View>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.pickerCard}>
            <SynqAudiencePicker
              groups={groups}
              selection={selection}
              onChangeSelection={setSelection}
            />
          </View>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + SPACE_4 }]}>
          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
            onPress={() => void handleSave()}
            disabled={saving}
            accessibilityRole="button"
            accessibilityLabel="Save audience"
          >
            {saving ? (
              <ActivityIndicator color={ON_ACCENT_TEXT} />
            ) : (
              <Text style={styles.saveBtnText}>Save</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE_4,
    paddingBottom: SPACE_4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER,
  },
  headerTitle: {
    flex: 1,
    textAlign: "center",
    color: TEXT,
    fontSize: 17,
    fontFamily: fonts.heavy,
  },
  headerSpacer: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: SPACE_5,
  },
  pickerCard: {
    backgroundColor: SURFACE,
    borderRadius: BUTTON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    overflow: "hidden",
  },
  footer: {
    paddingHorizontal: SPACE_5,
    paddingTop: SPACE_4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
  },
  saveBtn: {
    backgroundColor: "#00FF85",
    borderRadius: BUTTON_RADIUS,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: ON_ACCENT_TEXT,
    fontSize: 16,
    fontFamily: fonts.medium,
  },
});
