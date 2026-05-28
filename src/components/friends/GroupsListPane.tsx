import ConfirmModal from "@/app/confirm-modal";
import {
  ACCENT,
  fonts,
  MUTED2,
  MUTED3,
  RADIUS_LG,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  synqOutlineAddBtn,
  synqOutlineAddBtnText,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
} from "@/constants/Variables";
import {
  deleteFriendGroup,
  FriendGroup,
  subscribeFriendGroups,
} from "@/src/lib/friendGroups";
import { friendGroupsCacheByUser } from "@/src/lib/socialCache";
import { Friend } from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import GroupListAvatar from "./GroupListAvatar";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
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
  "Only you can see your groups. Use them as custom filters for who sees you when you're active.";

const GROUP_SURFACE = "#0E1012";
const GROUP_BORDER = "rgba(255,255,255,0.06)";
const ROW_INSET = 72;

type Props = {
  userId: string;
  friends?: Friend[];
  listBottomInset?: number;
  onCreateGroup: (name: string) => Promise<string>;
};

function firstName(displayName?: string) {
  const trimmed = (displayName || "").trim();
  if (!trimmed) return "Friend";
  return trimmed.split(/\s+/)[0] || "Friend";
}

function formatGroupMeta(memberIds: string[], friends: Friend[]) {
  if (memberIds.length === 0) return "No members yet";

  const byId = new Map(friends.map((f) => [f.id, f]));

  if (memberIds.length === 1) {
    const name = firstName(byId.get(memberIds[0])?.displayName);
    return name;
  }

  if (memberIds.length === 2) {
    const names = memberIds.map((id) => firstName(byId.get(id)?.displayName));
    return names.join(" & ");
  }

  const preview = memberIds
    .slice(0, 2)
    .map((id) => firstName(byId.get(id)?.displayName))
    .join(", ");
  return `${preview} · ${memberIds.length} members`;
}

function GroupsEmptyState({ onCreatePress }: { onCreatePress: () => void }) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconOrb}>
        <Ionicons name="layers-outline" size={28} color={ACCENT} />
      </View>
      <Text style={styles.emptyTitle}>
        Organize your{"\n"}
        <Text style={styles.emptyTitleAccent}>audience</Text>
      </Text>
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

function GroupRowSeparator() {
  return <View style={styles.rowSeparator} />;
}

function NewGroupRow({ onPress, isFooter }: { onPress: () => void; isFooter?: boolean }) {
  return (
    <TouchableOpacity
      style={[styles.newGroupRow, isFooter && styles.newGroupRowFooter]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel="New group"
    >
      <View style={styles.newGroupIcon}>
        <Ionicons name="add" size={20} color={ACCENT} />
      </View>
      <Text style={styles.newGroupLabel}>New group</Text>
    </TouchableOpacity>
  );
}

function GroupRow({
  group,
  friends,
  onPress,
  onLongPress,
}: {
  group: FriendGroup;
  friends: Friend[];
  onPress: () => void;
  onLongPress: () => void;
}) {
  const meta = useMemo(
    () => formatGroupMeta(group.memberIds, friends),
    [group.memberIds, friends]
  );

  return (
    <TouchableOpacity
      style={styles.groupRow}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={400}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${group.name}, ${group.memberIds.length} members`}
      accessibilityHint="Long press to delete this group"
    >
      <GroupListAvatar memberIds={group.memberIds} friends={friends} />
      <View style={styles.groupRowMain}>
        <Text style={styles.groupName} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={styles.groupMeta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function GroupsListPane({
  userId,
  friends = [],
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

  const openCreate = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCreateVisible(true);
  };

  const openGroup = (id: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push({ pathname: "/friend-group/[id]", params: { id } });
  };

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

  const groupsListBody = hasGroups ? (
    <View style={styles.groupSurface}>
      {groups.map((group, index) => (
        <React.Fragment key={group.id}>
          {index > 0 ? <GroupRowSeparator /> : null}
          <GroupRow
            group={group}
            friends={friends}
            onPress={() => openGroup(group.id)}
            onLongPress={() => promptDeleteGroup(group)}
          />
        </React.Fragment>
      ))}
      <GroupRowSeparator />
      <NewGroupRow onPress={openCreate} isFooter />
    </View>
  ) : null;

  return (
    <>
      <FlatList
        data={[]}
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
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>Your groups</Text>
                <View style={styles.sectionCountPill}>
                  <Text style={styles.sectionCountText}>{groups.length}</Text>
                </View>
              </View>
              {groupsListBody}
            </View>
          ) : null
        }
        ListEmptyComponent={
          !hasGroups ? <GroupsEmptyState onCreatePress={openCreate} /> : null
        }
        renderItem={() => null}
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
    paddingTop: 2,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  listHeader: {
    marginBottom: SPACE_4,
    gap: SPACE_3,
  },
  groupsHint: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION + 1,
    color: MUTED3,
    lineHeight: 19,
    letterSpacing: 0.1,
  },
  groupsHintCenter: {
    textAlign: "center",
    maxWidth: 300,
    marginTop: SPACE_4,
    marginBottom: SPACE_6,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: SPACE_3,
  },
  sectionTitle: {
    fontFamily: fonts.heavy,
    fontSize: 18,
    color: TEXT,
    letterSpacing: 0.12,
  },
  sectionCountPill: {
    minWidth: 26,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
  },
  sectionCountText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    fontVariant: ["tabular-nums"],
    includeFontPadding: false,
  },
  groupSurface: {
    marginTop: SPACE_3,
    backgroundColor: GROUP_SURFACE,
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GROUP_BORDER,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: GROUP_SURFACE,
  },
  groupRowMain: {
    flex: 1,
    minWidth: 0,
    justifyContent: "center",
  },
  groupName: {
    fontFamily: fonts.heavy,
    fontSize: 17,
    color: TEXT,
    letterSpacing: 0.08,
    marginBottom: 4,
  },
  groupMeta: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION + 1,
    color: MUTED2,
    letterSpacing: 0.05,
  },
  rowSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: GROUP_BORDER,
    marginLeft: ROW_INSET,
  },
  newGroupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    backgroundColor: GROUP_SURFACE,
  },
  newGroupRowFooter: {
    borderBottomLeftRadius: RADIUS_LG,
    borderBottomRightRadius: RADIUS_LG,
  },
  newGroupIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,255,133,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.2)",
  },
  newGroupLabel: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: ACCENT,
    letterSpacing: 0.12,
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
    paddingTop: SPACE_5,
    paddingBottom: SPACE_6,
    minHeight: 380,
  },
  emptyIconOrb: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACE_5,
    backgroundColor: "rgba(0,255,133,0.08)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.22)",
  },
  emptyTitle: {
    fontFamily: fonts.heavy,
    fontSize: 32,
    lineHeight: 38,
    color: TEXT,
    textAlign: "center",
    letterSpacing: 0.15,
    marginBottom: SPACE_3,
  },
  emptyTitleAccent: {
    color: ACCENT,
    fontFamily: fonts.heavy,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: 0.15,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 22,
    marginTop: SPACE_4,
  },
});
