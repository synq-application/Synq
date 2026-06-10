import {
  BG,
  BORDER,
  DEFAULT_AVATAR,
  fonts,
  MUTED,
  MUTED2,
  synqOutlineAddBtnCompact,
  synqOutlineAddBtnDisabled,
  synqOutlineAddBtnTextCompact,
  synqOutlineAddBtnTextDisabled,
  TEXT,
  TYPE_BODY,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import SynqPlusAddButton from "@/src/components/SynqPlusAddButton";
import { planInviteErrorMessage, sendPlanInvite } from "@/src/lib/planInvite";
import { Image as ExpoImage } from "expo-image";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { resolveAvatar } from "@/app/helpers";

export type PlanInviteFriend = {
  id: string;
  displayName?: string;
  imageurl?: string;
};

type Props = {
  visible: boolean;
  friends: PlanInviteFriend[];
  eventId: string;
  planTitle: string;
  onClose: () => void;
  onInvited?: (friendId: string) => void;
  onError?: (message: string) => void;
  /** Use inside another modal — avoids a second RN Modal stacking behind the parent. */
  embedded?: boolean;
};

export default function PlanInviteFriendsSheet({
  visible,
  friends,
  eventId,
  planTitle,
  onClose,
  onInvited,
  onError,
  embedded = false,
}: Props) {
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sentIds, setSentIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    if (!visible) return;
    setSentIds(new Set());
    setSendingId(null);
  }, [visible, eventId]);

  const sortedFriends = useMemo(
    () =>
      [...friends].sort((a, b) =>
        String(a.displayName || "").localeCompare(String(b.displayName || ""), undefined, {
          sensitivity: "base",
        })
      ),
    [friends]
  );

  const handleClose = () => {
    setSendingId(null);
    onClose();
  };

  const inviteFriend = async (friend: PlanInviteFriend) => {
    if (!friend.id || sendingId) return;
    setSendingId(friend.id);
    try {
      await sendPlanInvite(friend.id, eventId);
      setSentIds((prev) => new Set(prev).add(friend.id));
      onInvited?.(friend.id);
    } catch (err) {
      onError?.(planInviteErrorMessage(err));
    } finally {
      setSendingId(null);
    }
  };

  const title = String(planTitle || "").trim() || "your plan";

  if (!visible) return null;

  const sheet = (
    <View style={[styles.overlay, embedded && styles.overlayEmbedded]}>
      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Text style={styles.heading}>Invite friends</Text>
          <CloseButton onPress={handleClose} accessibilityLabel="Close invite friends" />
        </View>
        <Text style={styles.subtitle}>Ask a friend to join {title}</Text>

        {sortedFriends.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Add friends first to invite them to a plan.</Text>
          </View>
        ) : (
          <FlatList
            data={sortedFriends}
            keyExtractor={(item) => item.id}
            style={styles.list}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const avatarUri = resolveAvatar(item.imageurl) || DEFAULT_AVATAR;
              const firstName =
                String(item.displayName || "Friend").trim().split(/\s+/)[0] || "Friend";
              const sent = sentIds.has(item.id);
              const busy = sendingId === item.id;

              return (
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <View style={styles.avatar}>
                      <ExpoImage
                        source={{ uri: avatarUri }}
                        style={styles.avatarImg}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={0}
                        recyclingKey={item.id}
                      />
                    </View>
                    <Text style={styles.name}>{firstName}</Text>
                  </View>

                  {sent ? (
                    <TouchableOpacity
                      style={[synqOutlineAddBtnCompact, synqOutlineAddBtnDisabled]}
                      disabled
                      accessibilityRole="button"
                      accessibilityLabel={`Invite sent to ${firstName}`}
                    >
                      <Text
                        style={[synqOutlineAddBtnTextCompact, synqOutlineAddBtnTextDisabled]}
                      >
                        Sent
                      </Text>
                    </TouchableOpacity>
                  ) : busy ? (
                    <View style={styles.inviteBusy}>
                      <ActivityIndicator size="small" color={MUTED2} />
                    </View>
                  ) : (
                    <SynqPlusAddButton
                      label="Invite"
                      onPress={() => inviteFriend(item)}
                      accessibilityLabel={`Invite ${firstName}`}
                      activeOpacity={0.8}
                    />
                  )}
                </View>
              );
            }}
          />
        )}
      </View>
    </View>
  );

  if (embedded) return sheet;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={handleClose}>
      {sheet}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  overlayEmbedded: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    elevation: 20,
  },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    maxHeight: "78%",
    paddingBottom: 24,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 8,
  },
  heading: {
    color: TEXT,
    fontSize: 20,
    fontFamily: fonts.heavy,
  },
  subtitle: {
    color: MUTED,
    fontSize: TYPE_BODY,
    fontFamily: fonts.book,
    paddingHorizontal: 20,
    paddingBottom: 12,
    lineHeight: 20,
  },
  list: {
    paddingHorizontal: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#252525",
  },
  rowLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    backgroundColor: "#222",
    marginRight: 12,
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  name: {
    color: TEXT,
    fontSize: TYPE_BODY,
    fontFamily: fonts.medium,
    flex: 1,
  },
  inviteBusy: {
    minWidth: 84,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  empty: {
    paddingHorizontal: 20,
    paddingVertical: 28,
  },
  emptyText: {
    color: MUTED2,
    fontSize: TYPE_BODY,
    fontFamily: fonts.book,
    lineHeight: 20,
    textAlign: "center",
  },
});
