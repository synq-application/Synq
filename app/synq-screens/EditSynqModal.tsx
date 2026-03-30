import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  Keyboard,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  onClose: () => void;
  memo: string;
  setMemo: (t: string) => void;
  onSaveMemo: () => void;
  styles: any;
};

export default function EditSynqModal({
  visible,
  onClose,
  memo,
  setMemo,
  onSaveMemo,
  styles,
}: Props) {
  const suggestions = [
    "Down for drinks",
    "Grabbing dinner",
    "Anyone for happy hour?",
    "Coffee?",
    "Down for something chill",
    "Anyone around?",
    "Quick bite?",
    "Down for a walk",
    "Gym?",
    "Going for a run",
    "Movie night?",
    "Game night?",
    "Down for something fun",
    "What’s the move?"
  ];

  const [visibleSuggestions, setVisibleSuggestions] = useState<string[]>([]);

  const pickSuggestions = () => {
    const shuffled = [...suggestions]
      .sort(() => 0.5 - Math.random())
      .filter((s) => s.toLowerCase() !== memo.toLowerCase());

    setVisibleSuggestions(shuffled.slice(0, 4));
  };

  useEffect(() => {
    if (!visible) return;
    pickSuggestions();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.centeredModalOverlay}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.editPanel}>

              <TouchableOpacity
                onPress={onClose}
                style={styles.closeBtn}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons
                  name="close"
                  size={22}
                  color="rgba(255,255,255,0.4)"
                />
              </TouchableOpacity>

              <Text style={styles.panelTitle}>Edit synq memo</Text>

              <Text style={styles.panelSubtext}>
                Share what you’re up to or what you’re down for
              </Text>

              {/* input */}
              <TextInput
                style={styles.panelInput}
                value={memo}
                onChangeText={setMemo}
                placeholder="e.g. let’s grab drinks 🍸"
                placeholderTextColor="rgba(255,255,255,0.25)"
                multiline
                submitBehavior="blurAndSubmit"
                returnKeyType="done"
              />

              <View style={localStyles.suggestionHeaderRow}>
                <Text style={styles.suggestionSectionTitle}>Suggested ideas</Text>

                <TouchableOpacity
                  onPress={pickSuggestions}
                  style={localStyles.shuffleBtn}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel="Shuffle suggested ideas"
                >
                  <Ionicons
                    name="shuffle-outline"
                    size={26}
                    color="rgba(255,255,255,0.55)"
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.suggestionWrap}>
                {visibleSuggestions.map((s, i) => (
                  <TouchableOpacity
                    key={i}
                    style={styles.suggestionChip}
                    onPress={() => setMemo(s)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.suggestionText}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={onSaveMemo}
              >
                <Text style={styles.saveBtnText}>Update memo</Text>
              </TouchableOpacity>
              <View style={styles.lockRow}>
                <Ionicons
                  name="lock-closed-outline"
                  size={14}
                  color="rgba(255,255,255,0.35)"
                />
                <Text style={styles.lockText}>
                  Only your friends can see this
                </Text>
              </View>

            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const localStyles = StyleSheet.create({
  suggestionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    minHeight: 44,
  },
  shuffleBtn: {
    minWidth: 48,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    marginRight: -4,
  },
});