import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  fonts,
  MUTED2,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
} from "@/constants/Variables";
import { FriendGroup } from "@/src/lib/friendGroups";
import CloseButton from "@/src/components/CloseButton";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  visible: boolean;
  groups: FriendGroup[];
  friendName: string;
  memberId: string;
  onClose: () => void;
  onSelectGroup: (group: FriendGroup) => void;
};

export default function AddFriendToGroupSheet({
  visible,
  groups,
  friendName,
  memberId,
  onClose,
  onSelectGroup,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleClose = () => {
    setSelectedId(null);
    onClose();
  };

  const eligible = groups.filter((g) => !g.memberIds.includes(memberId));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Select group</Text>
            <CloseButton onPress={handleClose} />
          </View>
          <Text style={styles.subtitle}>
            Add {friendName || "this friend"} to a group
          </Text>
          {eligible.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {groups.length === 0
                  ? "Create a group from the Friends tab first."
                  : "This friend is already in all of your groups."}
              </Text>
            </View>
          ) : (
            <FlatList
              data={eligible}
              keyExtractor={(item) => item.id}
              style={styles.list}
              renderItem={({ item }) => {
                const selected = selectedId === item.id;
                return (
                  <TouchableOpacity
                    style={[styles.row, selected && styles.rowSelected]}
                    onPress={() => setSelectedId(item.id)}
                  >
                    <Text style={styles.rowName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Ionicons
                      name={selected ? "radio-button-on" : "radio-button-off"}
                      size={22}
                      color={selected ? ACCENT : MUTED2}
                    />
                  </TouchableOpacity>
                );
              }}
            />
          )}
          <TouchableOpacity
            style={[styles.cta, !selectedId && styles.ctaDisabled]}
            disabled={!selectedId}
            onPress={() => {
              const group = eligible.find((g) => g.id === selectedId);
              if (!group) return;
              onSelectGroup(group);
              setSelectedId(null);
            }}
          >
            <Text style={styles.ctaText}>Continue</Text>
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
  sheet: {
    maxHeight: "70%",
    backgroundColor: BG,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 18,
    color: TEXT,
  },
  subtitle: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    marginBottom: 12,
  },
  list: {
    maxHeight: 280,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: BUTTON_RADIUS,
  },
  rowSelected: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  rowName: {
    flex: 1,
    fontFamily: fonts.book,
    fontSize: 16,
    color: TEXT,
    marginRight: 8,
  },
  empty: {
    paddingVertical: 24,
  },
  emptyText: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    textAlign: "center",
    lineHeight: 18,
  },
  cta: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaDisabled: {
    opacity: 0.45,
  },
  ctaText: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: "#0A0B0D",
  },
});
