import ConfirmModal from "@/app/confirm-modal";
import {
  ACCENT,
  Friend,
  MUTED2,
  MUTED3,
  SPACE_6,
} from "@/constants/Variables";
import CommunitySection from "@/src/components/friends/CommunityGroupsSection";
import GroupsFeatureInfoModal from "@/src/components/friends/GroupsFeatureInfoModal";
import { groupsPageStyles } from "@/src/components/friends/groupsListStyles";
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
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import CreateGroupModal from "./CreateGroupModal";
import GroupListAvatar from "./GroupListAvatar";

type Props = {
  userId: string;
  friends?: Friend[];
  listBottomInset?: number;
  onCreateGroup: (name: string) => Promise<string>;
};

function formatMemberCount(count: number): string {
  return count === 1 ? "1 member" : `${count} members`;
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
  const [circlesInfoVisible, setCirclesInfoVisible] = useState(false);

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
        "Could not create circle",
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
        "Could not delete circle",
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

  return (
    <>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          groupsPageStyles.scrollContent,
          { paddingBottom: listBottomInset },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={groupsPageStyles.section}>
          <View style={groupsPageStyles.sectionHeader}>
            <View style={groupsPageStyles.sectionTitleRow}>
              <Text style={groupsPageStyles.sectionTitle}>Circles</Text>
                <TouchableOpacity
                  style={groupsPageStyles.infoBtn}
                  onPress={() => setCirclesInfoVisible(true)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="What are circles"
              >
                <Ionicons name="information-circle-outline" size={16} color={MUTED2} />
              </TouchableOpacity>
            </View>
          </View>

          {groups.map((group) => (
            <TouchableOpacity
              key={group.id}
              style={groupsPageStyles.circleCard}
              onPress={() => openGroup(group.id)}
              onLongPress={() => promptDeleteGroup(group)}
              delayLongPress={400}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`${group.name}, ${group.memberIds.length} members`}
              accessibilityHint="Long press to delete this circle"
            >
              <GroupListAvatar memberIds={group.memberIds} friends={friends} />
              <View style={groupsPageStyles.circleCardMain}>
                <Text style={groupsPageStyles.circleCardTitle} numberOfLines={1}>
                  {group.name}
                </Text>
                <Text style={groupsPageStyles.circleCardMeta} numberOfLines={1}>
                  {formatMemberCount(group.memberIds.length)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={MUTED3} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity
            style={groupsPageStyles.circleCard}
            onPress={openCreate}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="New circle"
          >
            <View style={groupsPageStyles.newCircleIcon}>
              <Ionicons name="add" size={22} color={ACCENT} />
            </View>
            <View style={groupsPageStyles.circleCardMain}>
              <Text style={groupsPageStyles.circleCardTitle}>New circle</Text>
            </View>
          </TouchableOpacity>
        </View>

        <CommunitySection userId={userId} friends={friends} />
      </ScrollView>

      <CreateGroupModal
        visible={createVisible}
        busy={createBusy}
        title="New circle"
        hint="Name your circle — only you control who is in it and who sees your availability."
        submitLabel="Create circle"
        onClose={() => setCreateVisible(false)}
        onCreate={handleCreate}
      />

      <ConfirmModal
        visible={pendingDeleteGroup != null}
        title="Delete circle?"
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

      <GroupsFeatureInfoModal
        visible={circlesInfoVisible}
        variant="circles"
        onClose={() => setCirclesInfoVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACE_6,
  },
});
