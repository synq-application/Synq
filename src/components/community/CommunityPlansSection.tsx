import {
  ACCENT,
  BG,
  BORDER,
  fonts,
  MUTED2,
  ON_ACCENT_TEXT,
  profileScreenSectionTitle,
  RADIUS_MD,
  SPACE_3,
  SPACE_4,
  SPACE_5,
  SURFACE,
  TEXT,
  TYPE_BODY,
  TYPE_CAPTION,
} from "@/constants/Variables";
import CreateCommunityPlanModal from "@/src/components/community/CreateCommunityPlanModal";
import {
  addCommunityPlanToUserEvents,
  createCommunityGroupPlan,
  deleteCommunityGroupPlan,
  formatCommunityPlanDateLabel,
  isCommunityPlanOnUserEvents,
  subscribeCommunityGroupPlans,
  type CommunityGroupPlan,
} from "@/src/lib/communityGroupPlans";
import { filterOutPastOpenPlans, sortOpenPlansByDateTime } from "@/src/lib/planEvents";
import { Ionicons } from "@expo/vector-icons";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/src/lib/firebase";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

  const handleCreate = useCallback(
    async (input: { title: string; date: string; time: string; location: string }) => {
      if (!uid || !isMember) return;
      setCreateBusy(true);
      try {
        await createCommunityGroupPlan(groupId, uid, viewerDisplayName, input);
        setCreateVisible(false);
      } catch (err: unknown) {
        Alert.alert("Could not post plan", err instanceof Error ? err.message : "Try again.");
      } finally {
        setCreateBusy(false);
      }
    },
    [groupId, uid, isMember, viewerDisplayName]
  );

  const handleAddToPlans = useCallback(
    async (plan: CommunityGroupPlan) => {
      if (!uid) return;
      if (!isMember) {
        Alert.alert("Join community", `Join ${groupName} to add this plan.`);
        return;
      }
      setJoiningPlanId(plan.id);
      try {
        const result = await addCommunityPlanToUserEvents(uid, plan, viewerDisplayName);
        Alert.alert(
          result === "already" ? "Already added" : "Added",
          result === "already"
            ? "This plan is already on your open plans."
            : "Plan added to your open plans."
        );
      } catch (err: unknown) {
        Alert.alert("Could not add plan", err instanceof Error ? err.message : "Try again.");
      } finally {
        setJoiningPlanId(null);
      }
    },
    [uid, isMember, groupName, viewerDisplayName]
  );

  const handleDelete = useCallback(
    (plan: CommunityGroupPlan) => {
      Alert.alert("Delete plan?", `Remove "${plan.title}" from ${groupName}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            void deleteCommunityGroupPlan(groupId, plan.id).catch(() => {
              Alert.alert("Error", "Could not delete this plan.");
            });
          },
        },
      ]);
    },
    [groupId, groupName]
  );

  return (
    <>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Plans</Text>
        {isMember && visiblePlans.length > 0 ? (
          <TouchableOpacity
            style={styles.postBtn}
            onPress={() => setCreateVisible(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Post a plan for this group"
          >
            <Ionicons name="add" size={18} color={ACCENT} />
            <Text style={styles.postBtnText}>Post</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <ActivityIndicator color={ACCENT} style={styles.loader} />
      ) : visiblePlans.length === 0 ? (
        isMember ? (
          <TouchableOpacity
            style={styles.postCta}
            onPress={() => setCreateVisible(true)}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="Post a plan for this group"
          >
            <Ionicons name="calendar-outline" size={20} color={ACCENT} />
            <Text style={styles.postCtaText}>Post a plan for this group</Text>
          </TouchableOpacity>
        ) : (
          <Text style={styles.empty}>No plans yet.</Text>
        )
      ) : (
        <View style={styles.list}>
          {visiblePlans.map((plan) => {
            const joined = isCommunityPlanOnUserEvents(plan, userEvents);
            const isHost = plan.creatorId === uid;
            const canDelete = isHost || isCreator;
            const dateParts = formatCommunityPlanDateLabel(plan.date);
            const busy = joiningPlanId === plan.id;

            return (
              <View key={plan.id} style={styles.card}>
                <View style={styles.dateBlock}>
                  <Text style={styles.weekday}>{dateParts.weekday}</Text>
                  <Text style={styles.day}>{dateParts.day}</Text>
                  <Text style={styles.month}>{dateParts.month}</Text>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.planTitle} numberOfLines={2}>
                    {plan.title}
                  </Text>
                  {[plan.time, plan.location].some(Boolean) ? (
                    <Text style={styles.planMeta} numberOfLines={1}>
                      {[plan.time, plan.location].filter(Boolean).join(" · ")}
                    </Text>
                  ) : null}

                  <View style={styles.cardActions}>
                    {isHost ? (
                      <View style={[styles.pill, styles.pillHost]}>
                        <Text style={styles.pillHostText}>Yours</Text>
                      </View>
                    ) : joined ? (
                      <View style={[styles.pill, styles.pillJoined]}>
                        <Text style={styles.pillJoinedText}>Added</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[styles.pill, styles.pillAdd, busy && styles.pillDisabled]}
                        onPress={() => void handleAddToPlans(plan)}
                        disabled={busy || !isMember}
                        activeOpacity={0.85}
                      >
                        {busy ? (
                          <ActivityIndicator color={ON_ACCENT_TEXT} size="small" />
                        ) : (
                          <Text style={styles.pillAddText}>Add</Text>
                        )}
                      </TouchableOpacity>
                    )}

                    {canDelete ? (
                      <TouchableOpacity
                        onPress={() => handleDelete(plan)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${plan.title}`}
                      >
                        <Ionicons name="trash-outline" size={18} color={MUTED2} />
                      </TouchableOpacity>
                    ) : null}
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <CreateCommunityPlanModal
        visible={createVisible}
        busy={createBusy}
        onClose={() => setCreateVisible(false)}
        onCreate={handleCreate}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACE_5,
    paddingTop: SPACE_4,
    paddingBottom: SPACE_3,
  },
  sectionTitle: {
    ...profileScreenSectionTitle,
    marginBottom: 0,
  },
  postBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    minHeight: 34,
    borderRadius: 17,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.35)",
    backgroundColor: "rgba(0,255,133,0.08)",
  },
  postBtnText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION + 1,
    color: ACCENT,
  },
  postCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE_3,
    marginHorizontal: SPACE_5,
    marginBottom: SPACE_4,
    paddingHorizontal: SPACE_4,
    minHeight: 52,
    borderRadius: RADIUS_MD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.28)",
    backgroundColor: "rgba(0,255,133,0.06)",
  },
  postCtaText: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    color: TEXT,
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
    paddingBottom: SPACE_4,
  },
  card: {
    flexDirection: "row",
    gap: SPACE_4,
    padding: SPACE_4,
    borderRadius: RADIUS_MD,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER,
    backgroundColor: SURFACE,
  },
  dateBlock: {
    width: 52,
    alignItems: "center",
    paddingTop: 2,
  },
  weekday: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: MUTED2,
    letterSpacing: 0.6,
  },
  day: {
    fontFamily: fonts.heavy,
    fontSize: 24,
    color: TEXT,
    lineHeight: 28,
  },
  month: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: MUTED2,
    letterSpacing: 0.6,
  },
  cardBody: {
    flex: 1,
    gap: 4,
  },
  planTitle: {
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY + 1,
    color: TEXT,
    lineHeight: 22,
  },
  planMeta: {
    fontFamily: fonts.book,
    fontSize: TYPE_CAPTION + 1,
    color: MUTED2,
    lineHeight: 18,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACE_3,
    marginTop: SPACE_3,
  },
  pill: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  pillAdd: {
    backgroundColor: ACCENT,
  },
  pillAddText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION + 1,
    color: ON_ACCENT_TEXT,
  },
  pillJoined: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,255,133,0.35)",
    backgroundColor: "rgba(0,255,133,0.08)",
  },
  pillJoinedText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION + 1,
    color: ACCENT,
  },
  pillHost: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  pillHostText: {
    fontFamily: fonts.medium,
    fontSize: TYPE_CAPTION + 1,
    color: MUTED2,
  },
  pillDisabled: {
    opacity: 0.6,
  },
});
