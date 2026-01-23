import React from "react";
import { Keyboard, Modal, Text, TextInput, TouchableOpacity, TouchableWithoutFeedback, View } from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  memo: string;
  setMemo: (t: string) => void;
  onSaveMemo: () => void;
  onEndSynq: () => void;
  styles: any;
};

export default function EditSynqModal({
  visible,
  onClose,
  memo,
  setMemo,
  onSaveMemo,
  onEndSynq,
  styles,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.centeredModalOverlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.editPanel}>
              <Text style={styles.panelTitle}>Edit your Synq</Text>
              <TextInput
                style={styles.panelInput}
                value={memo}
                onChangeText={setMemo}
              />
              <TouchableOpacity style={styles.saveBtn} onPress={onSaveMemo}>
                <Text style={styles.saveBtnText}>Update Memo</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.endSynqBtn} onPress={onEndSynq}>
                <Text style={styles.endSynqBtnText}>Deactivate Synq</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
