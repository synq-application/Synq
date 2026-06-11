import {

  ACCENT,

  BG,

  BORDER,

  BUTTON_RADIUS,

  DEFAULT_AVATAR,

  fonts,

  MUTED,

  MUTED2,

  ON_ACCENT_TEXT,

  synqOutlineAddBtnCompact,

  synqOutlineAddBtnDisabled,

  synqOutlineAddBtnTextCompact,

  synqOutlineAddBtnTextDisabled,

  TEXT,

  TYPE_BODY,

} from "@/constants/Variables";

import CloseButton from "@/src/components/CloseButton";

import { planInviteErrorMessage, sendPlanInvites } from "@/src/lib/planInvite";

import { Ionicons } from "@expo/vector-icons";

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

  useWindowDimensions,

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

  alreadyInvitedIds?: string[];

  alreadyInterestedIds?: string[];

  onClose: () => void;

  onInvited?: (friendIds: string[]) => void;

  onError?: (message: string) => void;

  /** Use inside another modal — avoids a second RN Modal stacking behind the parent. */

  embedded?: boolean;

};



function inviteCtaLabel(selectedCount: number): string {

  if (selectedCount === 0) return "Invite friends";

  if (selectedCount === 1) return "Invite 1 friend";

  return `Invite ${selectedCount} friends`;

}



export default function PlanInviteFriendsSheet({

  visible,

  friends,

  eventId,

  planTitle,

  alreadyInvitedIds = [],

  alreadyInterestedIds = [],

  onClose,

  onInvited,

  onError,

  embedded = false,

}: Props) {

  const { height: windowHeight } = useWindowDimensions();

  const sheetMaxHeight = Math.round(windowHeight * 0.78);

  const listMaxHeight = Math.max(160, sheetMaxHeight - 196);



  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const [inviting, setInviting] = useState(false);

  const [sessionInvitedIds, setSessionInvitedIds] = useState<Set<string>>(() => new Set());



  useEffect(() => {

    if (!visible) return;

    setSelected(new Set());

    setInviting(false);

    setSessionInvitedIds(new Set());

  }, [visible, eventId]);



  const invitedSet = useMemo(() => {

    const ids = new Set(

      alreadyInvitedIds.map((id) => String(id || "").trim()).filter(Boolean)

    );

    sessionInvitedIds.forEach((id) => ids.add(id));

    return ids;

  }, [alreadyInvitedIds, sessionInvitedIds]);



  const interestedSet = useMemo(() => {

    return new Set(

      alreadyInterestedIds.map((id) => String(id || "").trim()).filter(Boolean)

    );

  }, [alreadyInterestedIds]);



  const sortedFriends = useMemo(

    () =>

      [...friends].sort((a, b) =>

        String(a.displayName || "").localeCompare(String(b.displayName || ""), undefined, {

          sensitivity: "base",

        })

      ),

    [friends]

  );



  const selectableFriends = useMemo(

    () =>

      sortedFriends.filter(

        (f) => f.id && !invitedSet.has(f.id) && !interestedSet.has(f.id)

      ),

    [sortedFriends, invitedSet, interestedSet]

  );



  const handleClose = () => {

    setInviting(false);

    setSelected(new Set());

    onClose();

  };



  const toggleFriend = (friendId: string) => {

    if (invitedSet.has(friendId) || interestedSet.has(friendId) || inviting) return;

    setSelected((prev) => {

      const next = new Set(prev);

      if (next.has(friendId)) next.delete(friendId);

      else next.add(friendId);

      return next;

    });

  };



  const inviteSelected = async () => {

    if (inviting || selected.size === 0 || !eventId) return;

    const ids = [...selected];

    setInviting(true);

    try {

      const { invitedIds, alreadyInvitedIds: alreadyIds, errors } = await sendPlanInvites(

        ids,

        eventId

      );

      const newlyInvited = [...invitedIds, ...alreadyIds];

      if (newlyInvited.length > 0) {

        setSessionInvitedIds((prev) => {

          const next = new Set(prev);

          newlyInvited.forEach((id) => next.add(id));

          return next;

        });

        setSelected(new Set());

        onInvited?.(newlyInvited);

      }

      if (errors.length > 0) {

        if (newlyInvited.length > 0) {

          onError?.(

            newlyInvited.length === 1

              ? "Invited 1 friend. Some invites could not be sent."

              : `Invited ${newlyInvited.length} friends. Some invites could not be sent.`

          );

        } else {

          onError?.(errors[0] || planInviteErrorMessage(new Error("Could not send invite.")));

        }

      }

      if (newlyInvited.length > 0) {

        handleClose();

      }

    } catch (err) {

      onError?.(planInviteErrorMessage(err));

    } finally {

      setInviting(false);

    }

  };



  const title = String(planTitle || "").trim() || "your plan";



  if (!visible) return null;



  const sheet = (

    <View

      style={[styles.overlay, embedded && styles.overlayEmbedded]}

      pointerEvents="box-none"

    >

      <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

      <View style={[styles.sheet, { maxHeight: sheetMaxHeight }]}>

        <View style={styles.header}>

          <Text style={styles.heading}>Invite friends</Text>

          <CloseButton onPress={handleClose} accessibilityLabel="Close invite friends" />

        </View>

        <Text style={styles.subtitle}>Select friends to join {title}</Text>



        {sortedFriends.length === 0 ? (

          <View style={styles.empty}>

            <Text style={styles.emptyText}>Add friends first to invite them to a plan.</Text>

          </View>

        ) : (

          <>

            <FlatList

              data={sortedFriends}

              keyExtractor={(item) => item.id}

              style={[styles.list, { maxHeight: listMaxHeight }]}

              keyboardShouldPersistTaps="handled"

              nestedScrollEnabled

              showsVerticalScrollIndicator={false}

              renderItem={({ item }) => {

                const avatarUri = resolveAvatar(item.imageurl) || DEFAULT_AVATAR;

                const firstName =

                  String(item.displayName || "Friend").trim().split(/\s+/)[0] || "Friend";

                const interested = interestedSet.has(item.id);

                const invited = !interested && invitedSet.has(item.id);

                const unavailable = interested || invited;

                const checked = selected.has(item.id);



                return (

                  <TouchableOpacity

                    style={[styles.row, unavailable && styles.rowInvited]}

                    onPress={() => toggleFriend(item.id)}

                    disabled={unavailable || inviting}

                    accessibilityRole={unavailable ? "text" : "checkbox"}

                    accessibilityState={{ checked: unavailable ? undefined : checked, disabled: unavailable }}

                    accessibilityLabel={

                      interested

                        ? `${firstName} already interested`

                        : invited

                          ? `${firstName} already invited`

                          : `${firstName}, ${checked ? "selected" : "not selected"}`

                    }

                  >

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



                    {unavailable ? (

                      <View

                        style={[synqOutlineAddBtnCompact, synqOutlineAddBtnDisabled]}

                        accessibilityRole="text"

                      >

                        <Text

                          style={[synqOutlineAddBtnTextCompact, synqOutlineAddBtnTextDisabled]}

                        >

                          {interested ? "Interested" : "Invited"}

                        </Text>

                      </View>

                    ) : (

                      <Ionicons

                        name={checked ? "checkbox" : "square-outline"}

                        size={22}

                        color={checked ? ACCENT : MUTED2}

                      />

                    )}

                  </TouchableOpacity>

                );

              }}

            />



            <TouchableOpacity

              style={[

                styles.inviteBtn,

                (selected.size === 0 || inviting || selectableFriends.length === 0) &&

                  styles.inviteBtnDisabled,

              ]}

              disabled={selected.size === 0 || inviting || selectableFriends.length === 0}

              onPress={() => void inviteSelected()}

              accessibilityRole="button"

              accessibilityLabel={inviteCtaLabel(selected.size)}

            >

              {inviting ? (

                <ActivityIndicator color={ON_ACCENT_TEXT} />

              ) : (

                <Text style={styles.inviteBtnText}>{inviteCtaLabel(selected.size)}</Text>

              )}

            </TouchableOpacity>

          </>

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

    justifyContent: "flex-end",

  },

  sheet: {

    backgroundColor: BG,

    borderTopLeftRadius: 20,

    borderTopRightRadius: 20,

    borderWidth: 1,

    borderColor: BORDER,

    width: "100%",

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

  rowInvited: {

    opacity: 0.85,

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

  inviteBtn: {

    marginTop: 12,

    marginHorizontal: 20,

    height: 50,

    borderRadius: BUTTON_RADIUS,

    backgroundColor: ACCENT,

    alignItems: "center",

    justifyContent: "center",

  },

  inviteBtnDisabled: {

    opacity: 0.45,

  },

  inviteBtnText: {

    color: ON_ACCENT_TEXT,

    fontFamily: fonts.heavy,

    fontSize: 16,

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


