import {
  ACCENT,
  fonts,
  MUTED2,
  RADIUS_MD,
  RADIUS_LG,
  SPACE_2,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  TEXT,
  TYPE_BODY,
  cardTitleText,
  cardMetaText,
  listSectionTitle,
  sectionLinkText,
  TYPE_CAPTION,
} from "@/constants/Variables";
import AlertModal from "@/app/alert-modal";
import ConfirmModal from "@/app/confirm-modal";
import CreateCommunityPlanModal from "@/src/components/community/CreateCommunityPlanModal";
import {
  addCommunityPlanToUserEvents,
  createCommunityGroupPlan,
  deleteCommunityGroupPlan,
  getCommunitySynqCardMetaParts,
  formatCommunitySynqGoingCount,
  isCommunityPlanGoing,
  isCommunityPlanOnUserEvents,
  removeCommunityPlanFromUserEvents,
  subscribeCommunityGroupPlans,
  type CommunityGroupPlan,
} from "@/src/lib/communityGroupPlans";
import { filterOutPastOpenPlans, isOpenPlanPast, sortOpenPlansByDateTime } from "@/src/lib/planEvents";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  groupId: string;
  groupName: string;
  uid: string;
  viewerDisplayName: string;
  isMember: boolean;
  isCreator: boolean;
};

type ConfirmKind = "delete";

export default function CommunityPlansSection({
  groupId,
  groupName,
  uid,
  viewerDisplayName,
  isMember,
  isCreator,
}: Props) {
  const [plans, setPlans] = useState<CommunityGroupPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [userEvents, setUserEvents] = useState<unknown[]>([]);
  const [createVisible, setCreateVisible] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [joiningPlanId, setJoiningPlanId] = useState<string | null>(null);
  const [showAllPlans, setShowAllPlans] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<CommunityGroupPlan | null>(null);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const prunedPastPlanIdsRef = useRef(new Set<string>());

  const PLAN_PREVIEW_COUNT = 3;

  const showAlert = useCallback((title: string, message = "") => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmKind(null);
    setPendingPlan(null);
  }, []);

  useEffect(() => {
    if (!groupId) return;
    const unsub = subscribeCommunityGroupPlans(
      groupId,
      (next) => {
        setPlans(next);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return unsub;
  }, [groupId]);

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, "users", uid);
    const unsub = onSnapshot(ref, (snap) => {
      const raw = snap.exists() ? (snap.data() as { events?: unknown }).events : [];
      setUserEvents(Array.isArray(raw) ? raw : []);
    });
    return unsub;
  }, [uid]);

  const visiblePlans = useMemo(
    () => sortOpenPlansByDateTime(filterOutPastOpenPlans(plans)),
    [plans]
  );

  useEffect(() => {
    prunedPastPlanIdsRef.current.clear();
  }, [groupId]);

  useEffect(() => {
    if (!groupId || loading) return;

    const pastPlans = plans.filter((plan) => isOpenPlanPast(plan));
    for (const plan of pastPlans) {
      if (prunedPastPlanIdsRef.current.has(plan.id)) continue;
      prunedPastPlanIdsRef.current.add(plan.id);
      void deleteCommunityGroupPlan(groupId, plan.id).catch(() => {
        prunedPastPlanIdsRef.current.delete(plan.id);
      });
    }
  }, [groupId, loading, plans]);

  const displayedPlans = showAllPlans
    ? visiblePlans
    : visiblePlans.slice(0, PLAN_PREVIEW_COUNT);

  const handleCreate = useCallback(
    async (input: { title: string; date: string; time: string; location: string }) => {
      if (!uid || !isMember) return;
      setCreateBusy(true);
      try {
        await createCommunityGroupPlan(groupId, uid, viewerDisplayName, input);
        setCreateVisible(false);
      } catch (err: unknown) {
        showAlert("Could not share synq", err instanceof Error ? err.message : "Try again.");
      } finally {
        setCreateBusy(false);
      }
    },
    [groupId, uid, isMember, viewerDisplayName, showAlert]
  );

  const handleJoin = useCallback(
    async (plan: CommunityGroupPlan) => {
      if (!uid) return;
      if (!isMember) {
        showAlert("Join community", `Join ${groupName} to see who's going.`);
        return;
      }
      setJoiningPlanId(plan.id);
      try {
        await addCommunityPlanToUserEvents(uid, plan, viewerDisplayName);
        showAlert("Joined!");
      } catch (err: unknown) {
        showAlert("Could not update", err instanceof Error ? err.message : "Try again.");
      } finally {
        setJoiningPlanId(null);
      }
    },
    [uid, isMember, groupName, viewerDisplayName, showAlert]
  );

  const handleLeave = useCallback(
    async (plan: CommunityGroupPlan) => {
      if (!uid) return;
      setJoiningPlanId(plan.id);
      try {
        await removeCommunityPlanFromUserEvents(uid, plan);
        showAlert("Left!");
      } catch (err: unknown) {
        showAlert("Could not update", err instanceof Error ? err.message : "Try again.");
      } finally {
        setJoiningPlanId(null);
      }
    },
    [uid, showAlert]
  );

  const openDeleteConfirm = useCallback((plan: CommunityGroupPlan) => {
    setPendingPlan(plan);
    setConfirmKind("delete");
  }, []);

  const handleConfirm = useCallback(async () => {
    const plan = pendingPlan;
    closeConfirm();
    if (!plan || !uid) return;

    try {
      await deleteCommunityGroupPlan(groupId, plan.id);
    } catch {
      showAlert("Error", "Could not remove this synq.");
    }
  }, [pendingPlan, closeConfirm, uid, groupId, showAlert]);

  const confirmCopy = useMemo(() => {
    if (!pendingPlan || confirmKind !== "delete") return null;

    return {
      title: "Remove synq?",
      message: `Remove "${pendingPlan.title}" from ${groupName}?`,
      confirmText: "Remove",
      destructive: true,
    };
  }, [pendingPlan, confirmKind, groupName]);

  return (
    <>
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          {visiblePlans.length > 0 ? (
            <TouchableOpacity
              onPress={() => setShowAllPlans((prev) => !prev)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.sectionLink}>
                {showAllPlans ? "Show less" : "See all"}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {loading ? (
          <ActivityIndicator color={ACCENT} style={styles.loader} />
        ) : displayedPlans.length === 0 ? (
          isMember ? null : (
            <Text style={styles.empty}>Nothing upcoming yet.</Text>
          )
        ) : (
          <View style={styles.list}>
            {displayedPlans.map((plan) => {
            const isGoing =
              isCommunityPlanGoing(plan, uid) ||
              isCommunityPlanOnUserEvents(plan, userEvents);
            const canDelete = plan.creatorId === uid || isCreator;
            const goingCount = Math.max(plan.goingMemberIds.length, isGoing ? 1 : 0);
            const metaParts = getCommunitySynqCardMetaParts(plan.date, plan.time, plan.location);
            const metaLabel = metaParts.join(" • ");
            const peopleInLabel = formatCommunitySynqGoingCount(goingCount);
            const busy = joiningPlanId === plan.id;

            return (
              <Pressable
                key={plan.id}
                style={styles.card}
                onLongPress={
                  canDelete
                    ? () => {
                        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        openDeleteConfirm(plan);
                      }
                    : undefined
                }
                delayLongPress={400}
                accessibilityRole="button"
                accessibilityLabel={`${plan.title}, ${metaLabel}, ${peopleInLabel}`}
                accessibilityHint={
                  canDelete ? "Long press to remove this synq" : undefined
                }
              >
                <View style={styles.cardAccent} />
                <View style={styles.cardContent}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardMain}>
                      <Text style={styles.planTitle} numberOfLines={2}>
                        {plan.title}
                      </Text>
                      <Text style={styles.planMeta} numberOfLines={2}>
                        {metaParts.map((part, index) => (
                          <React.Fragment key={`${part}-${index}`}>
                            {index > 0 ? (
                              <>
                                <Text> </Text>
                                <Text style={styles.planMetaBullet}>•</Text>
                                <Text> </Text>
                              </>
                            ) : null}
                            <Text>{part}</Text>
                          </React.Fragment>
                        ))}
                      </Text>
                      <Text style={styles.peopleIn} numberOfLines={1}>
                        {peopleInLabel}
                      </Text>
                    </View>

                    <View style={styles.cardAside}>
                      <TouchableOpacity
                        style={[styles.pill, busy && styles.pillDisabled]}
                        onPress={() =>
                          isGoing ? void handleLeave(plan) : void handleJoin(plan)
                        }
                        disabled={busy || !isMember}
                        activeOpacity={0.85}
                        accessibilityRole="button"
                        accessibilityLabel={
                          isGoing
                            ? `Leave ${plan.title}`
                            : `Join ${plan.title}`
                        }
                      >
                        {busy ? (
                          <ActivityIndicator color={ACCENT} size="small" />
                        ) : (
                          <Text style={styles.pillText}>
                            {isGoing ? "Joined" : "Join"}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Pressable>
            );
          })}
          </View>
        )}

        {isMember ? (
          <TouchableOpacity
            style={styles.startSynqCta}
            onPress={() => setCreateVisible(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Share a plan"
          >
            <View style={styles.startSynqIconWrap}>
              <Ionicons name="add" size={16} color={ACCENT} />
            </View>
            <View style={styles.startSynqCopy}>
              <Text style={styles.startSynqTitle}>Share a plan</Text>
              <Text style={styles.startSynqSubtitle}>Invite others in the group</Text>
            </View>
          </TouchableOpacity>
        ) : null}
      </View>

      <CreateCommunityPlanModal
        visible={createVisible}
        busy={createBusy}
        onClose={() => setCreateVisible(false)}
        onCreate={handleCreate}
      />

      <ConfirmModal
        visible={confirmCopy != null}
        title={confirmCopy?.title}
        message={confirmCopy?.message ?? ""}
        confirmText={confirmCopy?.confirmText}
        destructive={confirmCopy?.destructive}
        onCancel={closeConfirm}
        onConfirm={() => void handleConfirm()}
      />

      <AlertModal
        visible={alertVisible}
        title={alertTitle}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionBlock: {
    paddingTop: SPACE_2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: SPACE_5,
    paddingBottom: SPACE_2,
    gap: SPACE_3,
  },
  sectionTitle: {
    ...listSectionTitle,
    marginTop: 0,
    marginBottom: 0,
  },
  sectionLink: {
    ...sectionLinkText,
  },
  startSynqCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE_3,
    marginLeft: SPACE_5,
    marginRight: SPACE_5 + SPACE_4,
    marginTop: SPACE_2,
    marginBottom: SPACE_2,
    paddingHorizontal: SPACE_4,
    minHeight: 54,
    borderRadius: RADIUS_MD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.28)",
    backgroundColor: "rgba(0,255,133,0.06)",
  },
  startSynqIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  startSynqCopy: {
    flex: 1,
    gap: 2,
  },
  startSynqTitle: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION + 1,
    color: TEXT,
  },
  startSynqSubtitle: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION,
    color: MUTED2,
  },
  loader: {
    marginVertical: SPACE_4,
  },
  empty: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION + 1,
    color: MUTED2,
    paddingHorizontal: SPACE_5,
    paddingBottom: SPACE_4,
  },
  list: {
    paddingHorizontal: SPACE_5,
    gap: SPACE_3,
    paddingBottom: SPACE_2,
  },
  card: {
    flexDirection: "row",
    borderRadius: RADIUS_LG,
    overflow: "hidden",
    backgroundColor: "#101214",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  cardAccent: {
    width: 3,
    backgroundColor: ACCENT,
  },
  cardContent: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: SPACE_4,
    minWidth: 0,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE_4,
  },
  cardMain: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  cardAside: {
    flexShrink: 0,
  },
  planTitle: {
    ...cardTitleText,
  },
  planMeta: {
    ...cardMetaText,
    lineHeight: 18,
  },
  planMetaBullet: {
    fontSize: 9,
    color: MUTED2,
    lineHeight: 18,
  },
  peopleIn: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    color: ACCENT,
    lineHeight: 18,
    marginTop: 2,
  },
  pill: {
    minWidth: 72,
    minHeight: 34,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: ACCENT,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION,
    color: ACCENT,
  },
  pillDisabled: {
    opacity: 0.6,
  },
});
