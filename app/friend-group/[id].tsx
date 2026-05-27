import { resolveAvatar } from "@/app/helpers";
import ConfirmModal from "@/app/confirm-modal";
import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  DESTRUCTIVE,
  fonts,
  MUTED2,
  profileScreenSectionTitle,
  RADIUS_MD,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SPACE_6,
  SURFACE,
  synqOutlineAddBtnCompact,
  synqOutlineAddBtnText,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
} from "@/constants/Variables";
import AddMembersToGroupSheet from "@/src/components/friends/AddMembersToGroupSheet";
import HeaderIconButton from "@/src/components/HeaderIconButton";
import StackScreenHeader from "@/src/components/StackScreenHeader";
import {
  addMembersToFriendGroup,
  deleteFriendGroup,
  friendGroupRef,
  removeMemberFromFriendGroup,
  renameFriendGroup,
  type FriendGroup,
} from "@/src/lib/friendGroups";
import { auth, db } from "@/src/lib/firebase";
import { friendsListCacheByUser } from "@/src/lib/socialCache";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, onSnapshot } from "firebase/firestore";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import CreateGroupModal from "@/src/components/friends/CreateGroupModal";

export default function FriendGroupDetailScreen() {
  const router = useRouter();
  const { id: groupId } = useLocalSearchParams<{ id?: string }>();
  const uid = auth.currentUser?.uid ?? "";
  const friends = uid ? friendsListCacheByUser[uid] ?? [] : [];

  const [group, setGroup] = useState<FriendGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [addBusy, setAddBusy] = useState(false);
  const [successVisible, setSuccessVisible] = useState(false);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameBusy, setRenameBusy] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/friends");
  };

  useEffect(() => {
    if (!uid || !groupId) return;
    const ref = friendGroupRef(uid, groupId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setGroup(null);
          setLoading(false);
          return;
        }
        const data = snap.data();
        setGroup({
          id: snap.id,
          name: String(data.name || "").trim() || "Group",
          memberIds: Array.isArray(data.memberIds)
            ? [...new Set((data.memberIds as string[]).filter(Boolean))]
            : [],
          sortOrder: typeof data.sortOrder === "number" ? data.sortOrder : 0,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [uid, groupId]);

  const memberRows = useMemo(() => {
    if (!group) return [];
    const byId = new Map(friends.map((f) => [f.id, f]));
    return group.memberIds.map((memberId) => {
      const friend = byId.get(memberId);
      return {
        id: memberId,
        displayName: friend?.displayName || "Friend",
        imageurl: (friend as { imageurl?: string } | undefined)?.imageurl,
      };
    });
  }, [group, friends]);

  const handleAddMembers = async (memberIds: string[]) => {
    if (!uid || !group || memberIds.length === 0) return;
    setAddBusy(true);
    try {
      await addMembersToFriendGroup(uid, group.id, group.memberIds, memberIds);
      setAddSheetVisible(false);
      setSuccessVisible(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => setSuccessVisible(false), 1800);
    } catch (e: unknown) {
      Alert.alert("Could not add members", e instanceof Error ? e.message : "Try again.");
    } finally {
      setAddBusy(false);
    }
  };

  const handleRemoveMember = (memberId: string, name: string) => {
    if (!uid || !group) return;
    Alert.alert("Remove member?", `Remove ${name} from ${group.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await removeMemberFromFriendGroup(uid, group.id, group.memberIds, memberId);
          } catch {
            Alert.alert("Error", "Could not remove member.");
          }
        },
      },
    ]);
  };

  const handleRename = async (name: string) => {
    if (!uid || !group) return;
    setRenameBusy(true);
    try {
      await renameFriendGroup(uid, group.id, name);
      setRenameVisible(false);
    } catch (e: unknown) {
      Alert.alert("Could not rename", e instanceof Error ? e.message : "Try again.");
    } finally {
      setRenameBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!uid || !group) return;
    try {
      await deleteFriendGroup(uid, group.id);
      setDeleteVisible(false);
      goBack();
    } catch {
      Alert.alert("Error", "Could not delete group.");
    }
  };

  if (!groupId) {
    return (
      <SafeAreaView style={styles.screen}>
        <Text style={styles.errorText}>Group not found.</Text>
      </SafeAreaView>
    );
  }

  const memberLabel =
    group && group.memberIds.length === 1
      ? "1 member"
      : `${group?.memberIds.length ?? 0} members`;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <StackScreenHeader
        title={group?.name || "Group"}
        onBack={goBack}
        right={
          group ? (
            <HeaderIconButton
              name="ellipsis-horizontal"
              size={22}
              onPress={() => setOptionsVisible(true)}
              accessibilityLabel="Group options"
            />
          ) : null
        }
      />

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={ACCENT} />
        </View>
      ) : !group ? (
        <View style={styles.loading}>
          <Text style={styles.errorText}>This group no longer exists.</Text>
        </View>
      ) : (
        <>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Members</Text>
            <Text style={styles.sectionMeta}>{memberLabel}</Text>
          </View>

          <FlatList
            data={memberRows}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyMembers}>No members yet. Add friends below.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.memberRow}>
                <TouchableOpacity
                  style={styles.memberMain}
                  activeOpacity={0.82}
                  onPress={() =>
                    router.push({
                      pathname: "/friend-profile",
                      params: { friendId: item.id, from: "friends" },
                    })
                  }
                >
                  <View style={styles.avatarRing}>
                    <ExpoImage
                      source={{ uri: resolveAvatar(item.imageurl) }}
                      style={styles.avatar}
                      cachePolicy="memory-disk"
                    />
                  </View>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => handleRemoveMember(item.id, item.displayName)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${item.displayName} from group`}
                  style={styles.removeMemberBtn}
                >
                  <Text style={styles.removeMemberLabel}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />

          <View style={styles.footer}>
            <TouchableOpacity
              style={[synqOutlineAddBtnCompact, styles.addMembersBtn]}
              onPress={() => setAddSheetVisible(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="person-add-outline" size={18} color={ACCENT} />
              <Text style={synqOutlineAddBtnText}>Add members</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      <AddMembersToGroupSheet
        visible={addSheetVisible}
        busy={addBusy}
        friends={friends}
        existingMemberIds={group?.memberIds ?? []}
        onClose={() => setAddSheetVisible(false)}
        onAdd={handleAddMembers}
      />

      <Modal visible={optionsVisible} transparent animationType="fade">
        <View style={styles.optionsOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOptionsVisible(false)} />
          <View style={styles.optionsSheetGroup}>
            <View style={styles.optionsSheet}>
              <TouchableOpacity
                style={styles.optionsRow}
                onPress={() => {
                  setOptionsVisible(false);
                  setRenameVisible(true);
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Rename group"
              >
                <Ionicons name="create-outline" size={22} color={TEXT} />
                <Text style={styles.optionsRowText}>Rename group</Text>
              </TouchableOpacity>
              <View style={styles.optionsDivider} />
              <TouchableOpacity
                style={styles.optionsRow}
                onPress={() => {
                  setOptionsVisible(false);
                  setDeleteVisible(true);
                }}
                activeOpacity={0.75}
                accessibilityRole="button"
                accessibilityLabel="Delete group"
              >
                <Ionicons name="trash-outline" size={22} color={DESTRUCTIVE} />
                <Text style={[styles.optionsRowText, styles.optionsDestructive]}>Delete group</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={styles.optionsCancel} onPress={() => setOptionsVisible(false)}>
              <Text style={styles.optionsCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <CreateGroupModal
        visible={renameVisible}
        busy={renameBusy}
        title="Rename group"
        hint=""
        submitLabel="Save"
        initialName={group?.name ?? ""}
        onClose={() => setRenameVisible(false)}
        onCreate={handleRename}
      />

      <Modal visible={successVisible} transparent animationType="fade">
        <View style={styles.successOverlay}>
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={40} color={ACCENT} />
            <Text style={styles.successTitle}>You have successfully added.</Text>
          </View>
        </View>
      </Modal>

      <ConfirmModal
        visible={deleteVisible}
        title="Delete group?"
        message={`Delete "${group?.name || "this group"}"? This cannot be undone.`}
        confirmText="Delete"
        destructive
        onCancel={() => setDeleteVisible(false)}
        onConfirm={() => void handleDelete()}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG,
  },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    textAlign: "center",
    padding: SPACE_6,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    paddingHorizontal: SPACE_5,
    paddingTop: SPACE_4,
    paddingBottom: SPACE_3,
  },
  sectionTitle: {
    ...profileScreenSectionTitle,
    marginBottom: 0,
  },
  sectionMeta: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: SPACE_4,
    flexGrow: 1,
  },
  emptyMembers: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    paddingVertical: SPACE_6,
    paddingHorizontal: SPACE_5,
    textAlign: "center",
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: SPACE_5,
  },
  memberMain: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    minWidth: 0,
  },
  avatarRing: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 12,
    overflow: "hidden",
    backgroundColor: SURFACE,
  },
  avatar: {
    width: 48,
    height: 48,
  },
  memberName: {
    flex: 1,
    fontFamily: fonts.heavy,
    fontSize: 16,
    color: TEXT,
    letterSpacing: 0.05,
  },
  removeMemberBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BUTTON_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,69,58,0.35)",
    backgroundColor: "rgba(255,69,58,0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  removeMemberLabel: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    color: DESTRUCTIVE,
    letterSpacing: 0.15,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.05)",
    marginLeft: 48 + 12 + SPACE_5,
  },
  footer: {
    paddingHorizontal: SPACE_5,
    paddingTop: SPACE_3,
    paddingBottom: SPACE_6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: BORDER,
    alignItems: "center",
  },
  addMembersBtn: {
    flexDirection: "row",
    gap: 8,
    alignSelf: "center",
    paddingHorizontal: 26,
    paddingVertical: 11,
  },
  successOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: SPACE_6,
  },
  successCard: {
    backgroundColor: BG,
    borderRadius: RADIUS_MD,
    padding: SPACE_6,
    alignItems: "center",
    gap: 12,
    minWidth: 260,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
  },
  successTitle: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: TEXT,
    textAlign: "center",
  },
  optionsOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  optionsSheetGroup: {
    paddingHorizontal: 12,
    paddingBottom: 34,
  },
  optionsSheet: {
    backgroundColor: "#141414",
    borderRadius: BUTTON_RADIUS + 4,
    borderWidth: 1,
    borderColor: BORDER,
    overflow: "hidden",
  },
  optionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  optionsRowText: {
    fontFamily: fonts.medium,
    fontSize: 17,
    color: TEXT,
  },
  optionsDestructive: {
    color: DESTRUCTIVE,
    fontFamily: fonts.medium,
  },
  optionsDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER,
    marginLeft: 54,
  },
  optionsCancel: {
    marginTop: 10,
    paddingVertical: 16,
    alignItems: "center",
    backgroundColor: BG,
    borderRadius: BUTTON_RADIUS + 4,
    borderWidth: 1,
    borderColor: BORDER,
  },
  optionsCancelText: {
    fontFamily: fonts.heavy,
    fontSize: 17,
    color: TEXT,
  },
});
