import {
  ACCENT,
  BORDER,
  fonts,
  MUTED,
  MUTED2,
  RADIUS_LG,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  SURFACE,
  synqOutlineAddBtn,
  synqOutlineAddBtnText,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
} from "@/constants/Variables";
import { FriendGroup, subscribeFriendGroups } from "@/src/lib/friendGroups";
import { friendGroupsCacheByUser } from "@/src/lib/socialCache";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import CreateGroupModal from "./CreateGroupModal";

type Props = {
  userId: string;
  listBottomInset?: number;
  onCreateGroup: (name: string) => Promise<string>;
};

function GroupsEmptyState({ onCreatePress }: { onCreatePress: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>No groups yet</Text>
      <Text style={styles.emptySubtitle}>
        Only you can see your groups.{"\n"}Use them as custom filters to organize friends.
      </Text>
      <TouchableOpacity
        style={[synqOutlineAddBtn, styles.emptyCta]}
        onPress={onCreatePress}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel="Create your first group"
      >
        <Ionicons name="add" size={20} color={ACCENT} />
        <Text style={synqOutlineAddBtnText}>Create group</Text>
      </TouchableOpacity>
    </View>
  );
}

function NewGroupRow({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity
      style={styles.newGroupRow}
      onPress={onPress}
      activeOpacity={0.82}
      accessibilityRole="button"
      accessibilityLabel="New group"
    >
      <View style={styles.newGroupIcon}>
        <Ionicons name="add" size={22} color={ACCENT} />
      </View>
      <Text style={styles.newGroupLabel}>New group</Text>
    </TouchableOpacity>
  );
}

export default function GroupsListPane({
  userId,
  listBottomInset = 40,
  onCreateGroup,
}: Props) {
  const router = useRouter();
  const cached = userId ? friendGroupsCacheByUser[userId] ?? [] : [];
  const [groups, setGroups] = useState<FriendGroup[]>(cached);
  const [loading, setLoading] = useState(cached.length === 0);
  const [createVisible, setCreateVisible] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setLoading(groups.length === 0);
    const unsub = subscribeFriendGroups(
      userId,
      (next) => {
        friendGroupsCacheByUser[userId] = next;
        setGroups(next);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [userId]);

  const handleCreate = async (name: string) => {
    setCreateBusy(true);
    try {
      const id = await onCreateGroup(name);
      setCreateVisible(false);
      router.push({ pathname: "/friend-group/[id]", params: { id } });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Try again.";
      const permissionDenied =
        typeof message === "string" &&
        (message.includes("permission") || message.includes("PERMISSION_DENIED"));
      Alert.alert(
        "Could not create group",
        permissionDenied
          ? "Firestore may be missing the new groups rules. Deploy firestore rules, then try again."
          : message
      );
    } finally {
      setCreateBusy(false);
    }
  };

  const openCreate = () => setCreateVisible(true);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={ACCENT} />
      </View>
    );
  }

  const hasGroups = groups.length > 0;

  return (
    <>
      <FlatList
        data={groups}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent,
          !hasGroups && styles.listContentEmpty,
          { paddingBottom: listBottomInset },
        ]}
        ListHeaderComponent={
          hasGroups ? (
            <View style={styles.listHeader}>
              <Text style={styles.hint}>
                Only you can see your groups. Use them as custom filters to organize friends.
              </Text>
              <NewGroupRow onPress={openCreate} />
            </View>
          ) : null
        }
        ListEmptyComponent={<GroupsEmptyState onCreatePress={openCreate} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.groupCard}
            onPress={() =>
              router.push({ pathname: "/friend-group/[id]", params: { id: item.id } })
            }
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.memberIds.length} members`}
          >
            <View style={styles.groupIconRing}>
              <Ionicons name="people-outline" size={20} color={ACCENT} />
            </View>
            <View style={styles.groupCardMain}>
              <Text style={styles.groupName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.groupMeta}>
                {item.memberIds.length === 1
                  ? "1 member"
                  : `${item.memberIds.length} members`}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={MUTED2} />
          </TouchableOpacity>
        )}
      />

      <CreateGroupModal
        visible={createVisible}
        busy={createBusy}
        onClose={() => setCreateVisible(false)}
        onCreate={handleCreate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
    paddingTop: 4,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  listHeader: {
    marginBottom: SPACE_4,
    gap: SPACE_5,
  },
  hint: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION + 1,
    color: MUTED2,
    lineHeight: 20,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACE_6,
  },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACE_5,
    paddingTop: SPACE_6,
    paddingBottom: SPACE_6,
    minHeight: 360,
  },
  emptyTitle: {
    fontFamily: fonts.heavy,
    fontSize: 24,
    lineHeight: 30,
    color: TEXT,
    textAlign: "center",
    letterSpacing: 0.15,
    marginBottom: SPACE_4,
  },
  emptySubtitle: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    lineHeight: 24,
    color: MUTED,
    textAlign: "center",
    maxWidth: 300,
    marginBottom: SPACE_6,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
  },
  newGroupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.28)",
    backgroundColor: "rgba(0,255,133,0.06)",
  },
  newGroupIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,255,133,0.1)",
  },
  newGroupLabel: {
    fontFamily: fonts.medium,
    fontSize: 16,
    color: ACCENT,
    letterSpacing: 0.15,
  },
  groupCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
    borderRadius: RADIUS_LG,
    backgroundColor: SURFACE,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  groupIconRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  groupCardMain: {
    flex: 1,
    minWidth: 0,
  },
  groupName: {
    fontFamily: fonts.heavy,
    fontSize: 17,
    color: TEXT,
    letterSpacing: 0.1,
    marginBottom: 3,
  },
  groupMeta: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION + 1,
    color: MUTED2,
  },
});
