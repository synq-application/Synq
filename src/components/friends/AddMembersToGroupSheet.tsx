import {
  ACCENT,
  BG,
  BUTTON_RADIUS,
  Friend,
  fonts,
  MUTED2,
  ON_ACCENT_TEXT,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { resolveAvatar } from "@/app/helpers";

type Props = {
  visible: boolean;
  busy?: boolean;
  friends: Friend[];
  existingMemberIds: string[];
  onClose: () => void;
  onAdd: (memberIds: string[]) => void | Promise<void>;
};

function addMembersCtaLabel(selectedCount: number): string {
  if (selectedCount === 0) return "Add members";
  if (selectedCount === 1) return "Add member";
  return `Add members (${selectedCount})`;
}

export default function AddMembersToGroupSheet({
  visible,
  busy,
  friends,
  existingMemberIds,
  onClose,
  onAdd,
}: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const existingSet = useMemo(() => new Set(existingMemberIds), [existingMemberIds]);

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return friends
      .filter((f) => !existingSet.has(f.id))
      .filter((f) => !q || (f.displayName || "").toLowerCase().includes(q))
      .sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
  }, [friends, existingSet, query]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleClose = () => {
    setQuery("");
    setSelected(new Set());
    onClose();
  };

  const handleAdd = async () => {
    if (selected.size === 0 || busy) return;
    Keyboard.dismiss();
    await onAdd([...selected]);
    setQuery("");
    setSelected(new Set());
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Add members</Text>
            <CloseButton onPress={handleClose} />
          </View>
          <Text style={styles.subtitle}>Search friends to add to this group</Text>
          <View style={styles.searchBar}>
            <Ionicons name="search-outline" size={17} color={MUTED2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search friends"
              placeholderTextColor={MUTED2}
              value={query}
              onChangeText={setQuery}
            />
          </View>
          <FlatList
            data={candidates}
            keyExtractor={(item) => item.id}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.empty}>
                <Text style={styles.emptyText}>
                  {friends.length === existingMemberIds.length
                    ? "All friends are already in this group."
                    : "No friends match your search."}
                </Text>
              </View>
            }
            renderItem={({ item }) => {
              const checked = selected.has(item.id);
              return (
                <TouchableOpacity
                  style={styles.row}
                  onPress={() => toggle(item.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                >
                  <View style={styles.avatarRing}>
                    <ExpoImage
                      source={{ uri: resolveAvatar((item as { imageurl?: string }).imageurl) }}
                      style={styles.avatar}
                      cachePolicy="memory-disk"
                    />
                  </View>
                  <Text style={styles.rowName} numberOfLines={1}>
                    {item.displayName || "Friend"}
                  </Text>
                  <Ionicons
                    name={checked ? "checkbox" : "square-outline"}
                    size={22}
                    color={checked ? ACCENT : MUTED2}
                  />
                </TouchableOpacity>
              );
            }}
          />
          <TouchableOpacity
            style={[styles.cta, (selected.size === 0 || busy) && styles.ctaDisabled]}
            disabled={selected.size === 0 || busy}
            onPress={() => void handleAdd()}
          >
            {busy ? (
              <ActivityIndicator color={ON_ACCENT_TEXT} />
            ) : (
              <Text style={styles.ctaText}>{addMembersCtaLabel(selected.size)}</Text>
            )}
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
    maxHeight: "88%",
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
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: BUTTON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.book,
    fontSize: 16,
    paddingVertical: 0,
  },
  list: {
    maxHeight: 340,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    gap: 12,
  },
  avatarRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  avatar: {
    width: 44,
    height: 44,
  },
  rowName: {
    flex: 1,
    fontFamily: fonts.book,
    fontSize: 16,
    color: TEXT,
  },
  empty: {
    paddingVertical: 24,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    textAlign: "center",
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
    color: ON_ACCENT_TEXT,
  },
});
