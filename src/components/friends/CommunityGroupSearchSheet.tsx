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
import GroupListAvatar from "@/src/components/friends/GroupListAvatar";
import {
  CommunityGroup,
  joinCommunityGroup,
  searchCommunityGroups,
} from "@/src/lib/communityGroups";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  userId: string;
  friends: Friend[];
  joinedGroupIds: Set<string>;
  onClose: () => void;
  onJoined: (groupId: string) => void;
  onOpenGroup: (groupId: string) => void;
};

function formatMemberCount(count: number): string {
  return count === 1 ? "1 member" : `${count} members`;
}

export default function CommunityGroupSearchSheet({
  visible,
  userId,
  friends,
  joinedGroupIds,
  onClose,
  onJoined,
  onOpenGroup,
}: Props) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CommunityGroup[]>([]);
  const [searching, setSearching] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setQuery("");
      setResults([]);
      setSearching(false);
      setJoiningId(null);
      if (searchTimerRef.current) {
        clearTimeout(searchTimerRef.current);
        searchTimerRef.current = null;
      }
    }
  }, [visible]);

  useEffect(() => {
    if (!visible) return;

    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      void searchCommunityGroups(trimmed)
        .then((groups) => setResults(groups))
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, 280);

    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [query, visible]);

  const handleJoin = async (group: CommunityGroup) => {
    if (!userId || joiningId) return;
    setJoiningId(group.id);
    try {
      await joinCommunityGroup(userId, group.id, group.memberIds);
      onJoined(group.id);
      onOpenGroup(group.id);
      onClose();
    } catch (err: unknown) {
      Alert.alert(
        "Could not join",
        err instanceof Error ? err.message : "Try again."
      );
    } finally {
      setJoiningId(null);
    }
  };

  const trimmed = query.trim();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Dismiss" />
        <View style={[styles.sheet, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.header}>
            <Text style={styles.title}>Find community groups</Text>
            <CloseButton onPress={onClose} />
          </View>

          <View style={styles.searchRow}>
            <Ionicons name="search" size={18} color={MUTED2} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by name"
              placeholderTextColor={MUTED2}
              value={query}
              onChangeText={setQuery}
              autoFocus
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={MUTED2} />
              </TouchableOpacity>
            ) : null}
          </View>

          {searching ? (
            <View style={styles.centered}>
              <ActivityIndicator color={ACCENT} />
            </View>
          ) : !trimmed ? (
            <Text style={styles.emptyHint}>Type a group name to search.</Text>
          ) : results.length === 0 ? (
            <Text style={styles.emptyHint}>No groups found for &ldquo;{trimmed}&rdquo;.</Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={styles.list}
              renderItem={({ item }) => {
                const isJoined = joinedGroupIds.has(item.id);
                const busy = joiningId === item.id;

                return (
                  <TouchableOpacity
                    style={styles.resultRow}
                    activeOpacity={0.8}
                    onPress={() => {
                      if (isJoined) {
                        onOpenGroup(item.id);
                        onClose();
                      }
                    }}
                  >
                    <GroupListAvatar memberIds={item.memberIds} friends={friends} />
                    <View style={styles.resultMain}>
                      <Text style={styles.resultName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      <Text style={styles.resultMeta} numberOfLines={1}>
                        {formatMemberCount(item.memberIds.length)} · Public
                      </Text>
                    </View>
                    {isJoined ? (
                      <View style={styles.joinedPill}>
                        <Text style={styles.joinedPillText}>Joined</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.joinBtn, busy && styles.joinBtnDisabled]}
                        disabled={busy}
                        onPress={() => void handleJoin(item)}
                        accessibilityRole="button"
                        accessibilityLabel={`Join ${item.name}`}
                      >
                        {busy ? (
                          <ActivityIndicator color={ON_ACCENT_TEXT} size="small" />
                        ) : (
                          <Text style={styles.joinBtnText}>Join</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    flex: 1,
    backgroundColor: BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontFamily: fonts.heavy,
    fontSize: 20,
    color: TEXT,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: BUTTON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: TEXT,
    padding: 0,
  },
  list: {
    flex: 1,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
  },
  resultMain: {
    flex: 1,
    minWidth: 0,
  },
  resultName: {
    fontFamily: fonts.heavy,
    fontSize: 16,
    color: TEXT,
    marginBottom: 3,
  },
  resultMeta: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
  },
  joinBtn: {
    minWidth: 72,
    height: 34,
    borderRadius: 17,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  joinBtnDisabled: {
    opacity: 0.6,
  },
  joinBtnText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION + 1,
    color: ON_ACCENT_TEXT,
  },
  joinedPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  joinedPillText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginLeft: 62,
  },
  centered: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyHint: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    textAlign: "center",
    paddingVertical: 32,
    paddingHorizontal: 12,
  },
});
