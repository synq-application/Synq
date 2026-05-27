import ConfirmModal from "@/app/confirm-modal";
import {
  ACCENT,
  BORDER,
  fonts,
  MUTED2,
  MUTED3,
  RADIUS_LG,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  SURFACE,
  synqOutlineAddBtn,
  synqOutlineAddBtnText,
  TEXT,
  TYPE_CAPTION,
} from "@/constants/Variables";
import {
  deleteFriendGroup,
  FriendGroup,
  subscribeFriendGroups,
} from "@/src/lib/friendGroups";
import { friendGroupsCacheByUser } from "@/src/lib/socialCache";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
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

const GROUPS_HINT =
  "Only you can see your groups. These are custom filters to organize your friends.";

type Props = {
  userId: string;
  listBottomInset?: number;
  onCreateGroup: (name: string) => Promise<string>;
};

function GroupsEmptyState({ onCreatePress }: { onCreatePress: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <Text style={styles.emptyTitle}>No groups yet</Text>
      <Text style={[styles.groupsHint, styles.groupsHintCenter]}>{GROUPS_HINT}</Text>
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
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<FriendGroup | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

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

  const promptDeleteGroup = (group: FriendGroup) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setPendingDeleteGroup(group);
  };

  const handleConfirmDelete = async () => {
    const group = pendingDeleteGroup;
    if (!userId || !group) return;
    setDeleteBusy(true);
    try {
      await deleteFriendGroup(userId, group.id);
      setPendingDeleteGroup(null);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: unknown) {
      Alert.alert(
        "Could not delete group",
        err instanceof Error ? err.message : "Try again."
      );
    } finally {
      setDeleteBusy(false);
    }
  };

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
              <Text style={styles.groupsHint}>{GROUPS_HINT}</Text>
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
            onLongPress={() => promptDeleteGroup(item)}
            delayLongPress={400}
            activeOpacity={0.82}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.memberIds.length} members`}
            accessibilityHint="Long press to delete this group"
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

      <ConfirmModal
        visible={pendingDeleteGroup != null}
        title="Delete group?"
        message={
          pendingDeleteGroup
            ? `Delete "${pendingDeleteGroup.name}"? This cannot be undone.`
            : ""
        }
        confirmText="Delete"
        destructive
        onCancel={() => {
          if (!deleteBusy) setPendingDeleteGroup(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
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
  groupsHint: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED3,
    lineHeight: 18,
    letterSpacing: 0.1,
  },
  groupsHintCenter: {
    textAlign: "center",
    maxWidth: 280,
    marginBottom: SPACE_6,
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
