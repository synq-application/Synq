import ConfirmModal from "@/app/confirm-modal";
import { resolveAvatar } from "@/src/lib/helpers";
import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  DESTRUCTIVE,
  fonts,
  Friend,
  MUTED2,
  ON_ACCENT_TEXT,
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
import CreateGroupModal from "@/src/components/friends/CreateGroupModal";
import HeaderIconButton from "@/src/components/HeaderIconButton";
import StackScreenHeader from "@/src/components/StackScreenHeader";
import { auth } from "@/src/lib/firebase";
import {
  communityGroupRef,
  deleteCommunityGroup,
  joinCommunityGroup,
  leaveCommunityGroup,
  removeMemberFromCommunityGroup,
  renameCommunityGroup,
  type CommunityGroup,
} from "@/src/lib/communityGroups";
import {
  sendCommunityGroupInvites,
  subscribePendingCommunityGroupInvites,
} from "@/src/lib/communityGroupInvites";
import { friendsListCacheByUser } from "@/src/lib/socialCache";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Image as ExpoImage } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { doc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import React, { useEffect, useMemo, useRef, useState } from "react";
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

function formatNameList(names: string[]): string {
  if (names.length === 0) return "them";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function invitedFriendsSuccessMessage(
  memberIds: string[],
  friends: Friend[],
  groupName: string
): string {
  const byId = new Map(friends.map((f) => [f.id, f]));
  const names = memberIds.map((id) => byId.get(id)?.displayName?.trim() || "Friend");
  const group = groupName.trim() || "the group";
  return `Invite sent to ${formatNameList(names)} for ${group}`;
}

const ADD_MEMBERS_FOOTER_FADE_HEIGHT = 56;
const ADD_MEMBERS_FOOTER_FADE_GRADIENT = [
  "rgba(0,0,0,0)",
  "rgba(0,0,0,0.45)",
  "#000000",
  "#000000",
] as const;
const ADD_MEMBERS_FOOTER_FADE_LOCATIONS = [0, 0.28, 0.48, 1] as const;
const ADD_MEMBERS_FOOTER_HEIGHT =
  ADD_MEMBERS_FOOTER_FADE_HEIGHT + SPACE_3 + 40 + SPACE_6;

type MemberRow = {
  id: string;
  displayName: string;
  imageurl?: string;
};

export default function CommunityGroupDetailScreen() {
  const router = useRouter();
  const { id: groupId } = useLocalSearchParams<{ id?: string }>();
  const uid = auth.currentUser?.uid ?? "";
  const friends = uid ? friendsListCacheByUser[uid] ?? [] : [];

  const [group, setGroup] = useState<CommunityGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [memberProfiles, setMemberProfiles] = useState<Record<string, MemberRow>>({});
  const [addSheetVisible, setAddSheetVisible] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [pendingInviteIds, setPendingInviteIds] = useState<string[]>([]);
  const [successVisible, setSuccessVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const pendingMemberIdsRef = useRef<string[] | null>(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [renameBusy, setRenameBusy] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [leaveVisible, setLeaveVisible] = useState(false);
  const [joinBusy, setJoinBusy] = useState(false);
  const [pendingRemoveMember, setPendingRemoveMember] = useState<{
    id: string;
    displayName: string;
  } | null>(null);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/friends");
  };

  useEffect(() => {
    if (!groupId || !uid) return;
    const unsub = subscribePendingCommunityGroupInvites(groupId, setPendingInviteIds, () => {});
    return unsub;
  }, [groupId, uid]);

  useEffect(() => {
    if (!groupId) return;
    const ref = communityGroupRef(groupId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setGroup(null);
          setLoading(false);
          return;
        }
        const data = snap.data();
        const serverMemberIds = Array.isArray(data.memberIds)
          ? [...new Set((data.memberIds as string[]).filter(Boolean))]
          : [];
        const pending = pendingMemberIdsRef.current;
        let memberIds = serverMemberIds;
        if (pending) {
          const serverHasPending = pending.every((id) => serverMemberIds.includes(id));
          if (serverHasPending && serverMemberIds.length >= pending.length) {
            pendingMemberIdsRef.current = null;
          } else {
            memberIds = pending;
          }
        }
        setGroup({
          id: snap.id,
          name: String(data.name || "").trim() || "Group",
          nameLower: String(data.nameLower || "").trim(),
          creatorId: String(data.creatorId || "").trim(),
          memberIds,
          createdAt: data.createdAt,
          updatedAt: data.updatedAt,
        });
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [groupId]);

  useEffect(() => {
    if (!group) return;
    const byId = new Map(friends.map((f) => [f.id, f]));
    const missingIds = group.memberIds.filter((id) => !byId.has(id));

    const fromFriends: Record<string, MemberRow> = {};
    group.memberIds.forEach((memberId) => {
      const friend = byId.get(memberId);
      if (friend) {
        fromFriends[memberId] = {
          id: memberId,
          displayName: friend.displayName || "Member",
          imageurl: (friend as { imageurl?: string }).imageurl,
        };
      }
    });
    setMemberProfiles((prev) => ({ ...prev, ...fromFriends }));

    if (missingIds.length === 0) return;

    let cancelled = false;
    void Promise.all(
      missingIds.map(async (memberId) => {
        try {
          const snap = await getDoc(doc(db, "users", memberId));
          if (!snap.exists()) return null;
          const data = snap.data() as { displayName?: string; imageurl?: string };
          return {
            id: memberId,
            displayName: String(data.displayName || "").trim() || "Member",
            imageurl: data.imageurl,
          } satisfies MemberRow;
        } catch {
          return {
            id: memberId,
            displayName: "Member",
          } satisfies MemberRow;
        }
      })
    ).then((rows) => {
      if (cancelled) return;
      const next: Record<string, MemberRow> = {};
      rows.forEach((row) => {
        if (row) next[row.id] = row;
      });
      if (Object.keys(next).length > 0) {
        setMemberProfiles((prev) => ({ ...prev, ...next }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [group, friends]);

  const isMember = !!group && !!uid && group.memberIds.includes(uid);
  const isCreator = !!group && !!uid && group.creatorId === uid;

  const memberRows = useMemo(() => {
    if (!group) return [];
    return group.memberIds.map((memberId) => {
      const profile = memberProfiles[memberId];
      return {
        id: memberId,
        displayName: profile?.displayName || "Member",
        imageurl: profile?.imageurl,
      };
    });
  }, [group, memberProfiles]);

  const handleJoin = async () => {
    if (!uid || !group || joinBusy) return;
    setJoinBusy(true);
    try {
      await joinCommunityGroup(uid, group.id, group.memberIds);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: unknown) {
      Alert.alert("Could not join", e instanceof Error ? e.message : "Try again.");
    } finally {
      setJoinBusy(false);
    }
  };

  const handleInviteFriends = async (memberIds: string[]) => {
    if (!uid || !group || memberIds.length === 0 || !isMember) return;

    const me = auth.currentUser;
    const inviterName = me?.displayName?.trim() || "Friend";
    const inviterImage = me?.photoURL;

    setInviteBusy(true);
    setAddSheetVisible(false);
    try {
      const sent = await sendCommunityGroupInvites(
        uid,
        inviterName,
        inviterImage,
        group,
        memberIds
      );
      if (sent.length === 0) {
        Alert.alert("No invites sent", "Those friends may already have a pending invite.");
        return;
      }
      setSuccessMessage(invitedFriendsSuccessMessage(sent, friends, group.name));
      setSuccessVisible(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTimeout(() => {
        setSuccessVisible(false);
        setSuccessMessage("");
      }, 1800);
    } catch (e: unknown) {
      Alert.alert("Could not send invites", e instanceof Error ? e.message : "Try again.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleRemoveMember = (memberId: string, displayName: string) => {
    if (!uid || !group) return;
    if (!isCreator && memberId !== uid) return;
    setPendingRemoveMember({ id: memberId, displayName });
  };

  const confirmRemoveMember = () => {
    if (!uid || !group || !pendingRemoveMember) return;
    const { id: memberId } = pendingRemoveMember;
    setPendingRemoveMember(null);

    const previousMemberIds = group.memberIds;
    const nextMemberIds = previousMemberIds.filter((id) => id !== memberId);

    pendingMemberIdsRef.current = nextMemberIds;
    setGroup({ ...group, memberIds: nextMemberIds });

    void removeMemberFromCommunityGroup(group.id, previousMemberIds, memberId).catch(() => {
      pendingMemberIdsRef.current = null;
      setGroup((g) => (g ? { ...g, memberIds: previousMemberIds } : g));
      Alert.alert("Error", "Could not remove member.");
    });
  };

  const handleRename = async (name: string) => {
    if (!group || !isCreator) return;
    setRenameBusy(true);
    try {
      await renameCommunityGroup(group.id, name);
      setRenameVisible(false);
    } catch (e: unknown) {
      Alert.alert("Could not rename", e instanceof Error ? e.message : "Try again.");
    } finally {
      setRenameBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!group || !isCreator) return;
    try {
      await deleteCommunityGroup(group.id);
      setDeleteVisible(false);
      goBack();
    } catch {
      Alert.alert("Error", "Could not delete group.");
    }
  };

  const handleLeave = async () => {
    if (!uid || !group || !isMember) return;
    try {
      await leaveCommunityGroup(uid, group.id, group.memberIds);
      setLeaveVisible(false);
      goBack();
    } catch {
      Alert.alert("Error", "Could not leave group.");
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

  const footerHeight = isMember ? ADD_MEMBERS_FOOTER_HEIGHT : SPACE_6;

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <StackScreenHeader
        title={group?.name || "Group"}
        onBack={goBack}
        right={
          group && isMember ? (
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
        <View style={styles.membersPane}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Members</Text>
              <Text style={styles.publicBadge}>Public group</Text>
            </View>
            <Text style={styles.sectionMeta}>{memberLabel}</Text>
          </View>

          {!isMember ? (
            <View style={styles.joinBanner}>
              <Text style={styles.joinBannerText}>
                Join to see members and add friends to this group.
              </Text>
              <TouchableOpacity
                style={[styles.joinBtn, joinBusy && styles.joinBtnDisabled]}
                disabled={joinBusy}
                onPress={() => void handleJoin()}
                accessibilityRole="button"
                accessibilityLabel={`Join ${group.name}`}
              >
                {joinBusy ? (
                  <ActivityIndicator color={ON_ACCENT_TEXT} size="small" />
                ) : (
                  <Text style={styles.joinBtnText}>Join group</Text>
                )}
              </TouchableOpacity>
            </View>
          ) : null}

          <FlatList
            data={isMember ? memberRows : []}
            keyExtractor={(item) => item.id}
            style={styles.list}
            contentContainerStyle={[styles.listContent, { paddingBottom: footerHeight }]}
            ListEmptyComponent={
              isMember ? (
                <Text style={styles.emptyMembers}>No members yet. Invite friends below.</Text>
              ) : null
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
                {(isCreator || item.id === uid) && item.id !== group.creatorId ? (
                  <TouchableOpacity
                    onPress={() => handleRemoveMember(item.id, item.displayName)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${item.displayName} from group`}
                    style={styles.removeMemberBtn}
                  >
                    <Text style={styles.removeMemberLabel}>Remove</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            )}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
          />

          {isMember ? (
            <LinearGradient
              colors={[...ADD_MEMBERS_FOOTER_FADE_GRADIENT]}
              locations={[...ADD_MEMBERS_FOOTER_FADE_LOCATIONS]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={[styles.addMembersFooter, { height: ADD_MEMBERS_FOOTER_HEIGHT }]}
            >
              <TouchableOpacity
                style={[synqOutlineAddBtnCompact, styles.addMembersBtn]}
                onPress={() => setAddSheetVisible(true)}
                activeOpacity={0.85}
              >
                <Ionicons name="person-add-outline" size={18} color={ACCENT} />
                <Text style={synqOutlineAddBtnText}>Invite friends</Text>
              </TouchableOpacity>
            </LinearGradient>
          ) : null}
        </View>
      )}

      <AddMembersToGroupSheet
        visible={addSheetVisible}
        busy={inviteBusy}
        friends={friends}
        existingMemberIds={group?.memberIds ?? []}
        pendingInviteIds={pendingInviteIds}
        mode="invite"
        onClose={() => setAddSheetVisible(false)}
        onAdd={handleInviteFriends}
      />

      <Modal visible={optionsVisible} transparent animationType="fade">
        <View style={styles.optionsOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setOptionsVisible(false)} />
          <View style={styles.optionsSheetGroup}>
            <View style={styles.optionsSheet}>
              {isCreator ? (
                <>
                  <TouchableOpacity
                    style={styles.optionsRow}
                    onPress={() => {
                      setOptionsVisible(false);
                      setRenameVisible(true);
                    }}
                    activeOpacity={0.75}
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
                  >
                    <Ionicons name="trash-outline" size={22} color={DESTRUCTIVE} />
                    <Text style={[styles.optionsRowText, styles.optionsDestructive]}>
                      Delete group
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.optionsRow}
                  onPress={() => {
                    setOptionsVisible(false);
                    setLeaveVisible(true);
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="exit-outline" size={22} color={DESTRUCTIVE} />
                  <Text style={[styles.optionsRowText, styles.optionsDestructive]}>Leave group</Text>
                </TouchableOpacity>
              )}
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
            <Text style={styles.successTitle}>{successMessage}</Text>
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

      <ConfirmModal
        visible={leaveVisible}
        title="Leave group?"
        message={`Leave "${group?.name || "this group"}"?`}
        confirmText="Leave"
        destructive
        onCancel={() => setLeaveVisible(false)}
        onConfirm={() => void handleLeave()}
      />

      <ConfirmModal
        visible={pendingRemoveMember != null}
        title="Remove member?"
        message={
          pendingRemoveMember && group
            ? `Remove ${pendingRemoveMember.displayName} from ${group.name}?`
            : ""
        }
        confirmText="Remove"
        destructive
        onCancel={() => setPendingRemoveMember(null)}
        onConfirm={() => void confirmRemoveMember()}
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
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: SPACE_5,
    paddingTop: SPACE_4,
    paddingBottom: SPACE_3,
  },
  sectionTitle: {
    ...profileScreenSectionTitle,
    marginBottom: 4,
  },
  publicBadge: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: ACCENT,
    letterSpacing: 0.2,
  },
  sectionMeta: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
    marginTop: 4,
  },
  joinBanner: {
    marginHorizontal: SPACE_5,
    marginBottom: SPACE_4,
    padding: SPACE_4,
    borderRadius: RADIUS_MD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: SURFACE,
    gap: SPACE_3,
  },
  joinBannerText: {
    fontFamily: fonts.book,
    fontSize: TYPE_BODY,
    color: MUTED2,
    lineHeight: 21,
  },
  joinBtn: {
    alignSelf: "flex-start",
    minHeight: 40,
    paddingHorizontal: 20,
    borderRadius: 20,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  joinBtnDisabled: {
    opacity: 0.6,
  },
  joinBtnText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: ON_ACCENT_TEXT,
  },
  membersPane: {
    flex: 1,
    position: "relative",
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
  addMembersFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: SPACE_5,
    paddingBottom: SPACE_6,
    paddingTop: SPACE_3,
    justifyContent: "flex-end",
    alignItems: "center",
    zIndex: 2,
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
