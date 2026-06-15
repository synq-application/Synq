import { filterOutPastOpenPlans, sortOpenPlansByDateTime } from "@/src/lib/planEvents";
import { resolvePlanAttribution } from "@/src/lib/planAttribution";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from "react-native";

const PLAN_PILL_LAYOUT: ViewStyle = {
  marginLeft: "auto",
  minWidth: 88,
  minHeight: 32,
  borderRadius: 12,
  borderWidth: 1,
  paddingHorizontal: 10,
  paddingVertical: 6,
  alignItems: "center",
  justifyContent: "center",
};

type EventItem = {
  id: string;
  date: string;
  title: string;
  time?: string;
  location?: string;
  joinedFromFriendUid?: string;
  joinedFromId?: string;
  joinedFromIds?: string[];
  joinedFromName?: string;
  joinedFromNames?: string[];
  planHostUid?: string;
  attendeeDisplayNames?: Record<string, string>;
};

type Props = {
  events: EventItem[];
  ACCENT: string;
  fonts: any;
  viewerUid?: string;
  profileSubjectUid?: string;
  onPressPlan?: (event: EventItem) => void;
  isPlanJoined?: (event: EventItem) => boolean;
  isViewerHostOfPlan?: (event: EventItem) => boolean;
  hostDisplayNameByUid: Record<string, string>;
  profileFallbackFirstName?: string;
};

export default function FriendOpenPlans({
  events,
  ACCENT,
  fonts,
  viewerUid = "",
  profileSubjectUid = "",
  onPressPlan,
  isPlanJoined,
  isViewerHostOfPlan,
  hostDisplayNameByUid,
}: Props) {
  const visibleEvents = useMemo(
    () => sortOpenPlansByDateTime(filterOutPastOpenPlans(events)),
    [events]
  );

  const parseDate = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const planHostLabelForRow = (p: EventItem) => {
    const { primary } = resolvePlanAttribution(
      p,
      viewerUid,
      hostDisplayNameByUid,
      profileSubjectUid || viewerUid
    );
    return primary;
  };

  return (
    <View style={styles.container}>
      {visibleEvents.length === 0 && (
        <Text style={styles.empty}>
          Nothing planned right now 👀
        </Text>
      )}

      {visibleEvents.map((p) => {
        const d = parseDate(p.date);
        const canJoin = typeof onPressPlan === "function";
        const joined = isPlanJoined?.(p) ?? false;
        const isHost = isViewerHostOfPlan?.(p) ?? false;
        const rowHostLabel = planHostLabelForRow(p);
        const hasInterestLine = !!rowHostLabel;

        return (
          <View key={p.id} style={styles.card}>
            <View style={styles.dateBlock}>
              <Text style={styles.day}>
                {d
                  .toLocaleDateString("en-US", { weekday: "short" })
                  .toUpperCase()}
              </Text>
              <Text style={styles.date}>{d.getDate()}</Text>
              <Text style={styles.month}>
                {d
                  .toLocaleDateString("en-US", { month: "short" })
                  .toUpperCase()}
              </Text>
            </View>

            <View
              style={[
                styles.planBody,
                hasInterestLine && styles.planBodyWithInterest,
              ]}
            >
              <Text style={[styles.title, { fontFamily: fonts.medium }]}>
                {p.title}
              </Text>
              <Text style={styles.meta}>
                {p.time}
                {p.location ? ` · ${p.location}` : ""}
              </Text>
              {rowHostLabel ? (
                <Text style={[styles.planOwnerLine, { fontFamily: fonts.medium }]}>
                  {rowHostLabel}
                </Text>
              ) : null}
            </View>
            {isHost ? (
              <View style={[styles.hostPill, styles.planSidePill]}>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.interestText,
                    styles.hostPillText,
                    { fontFamily: fonts.medium },
                  ]}
                >
                  Your plan
                </Text>
              </View>
            ) : (
              canJoin && (
                <TouchableOpacity
                  style={[
                    styles.interestPill,
                    styles.planSidePill,
                    joined
                      ? {
                          borderColor: "rgba(255,255,255,0.14)",
                          backgroundColor: "rgba(255,255,255,0.06)",
                        }
                      : { borderColor: ACCENT },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => onPressPlan?.(p)}
                  accessibilityRole="button"
                  accessibilityLabel={joined ? "Added" : "Add"}
                  accessibilityHint={
                    joined
                      ? "Tap to remove this plan from your open plans."
                      : "Adds this plan to your open plans and notifies your friend."
                  }
                  accessibilityState={{ selected: joined }}
                >
                  <Text
                    style={[
                      styles.interestText,
                      {
                        color: joined ? "rgba(255,255,255,0.48)" : ACCENT,
                        fontFamily: joined ? fonts.medium : fonts.heavy,
                      },
                    ]}
                  >
                    {joined ? "Added" : "Add"}
                  </Text>
                </TouchableOpacity>
              )
            )}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "92%",
    alignItems: "flex-start",
  },
  header: {
    color: "white",
    fontSize: 18,
    marginBottom: 14,
  },
  empty: {
    color: "#666",
    fontSize: 14,
    marginBottom: 20
  },
  card: {
    alignSelf: "flex-start",
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#0d0d0d",
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "stretch",
  },

  dateBlock: {
    width: 48,
    alignItems: "center",
    marginRight: 12,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  planBody: {
    flex: 1,
    alignSelf: "stretch",
    justifyContent: "center",
  },
  planBodyWithInterest: {
    justifyContent: "flex-start",
  },
  planSidePill: {
    alignSelf: "center",
  },

  day: {
    color: "#666",
    fontSize: 10,
  },

  date: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },

  month: {
    color: "#666",
    fontSize: 10,
    marginTop: 2,
  },

  title: {
    color: "white",
    fontSize: 15,
  },

  meta: {
    color: "#777",
    marginTop: 3,
    fontSize: 13,
  },

  planOwnerLine: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    marginTop: 5,
  },

  interestPill: {
    ...PLAN_PILL_LAYOUT,
    borderColor: "#333",
  },
  hostPill: {
    ...PLAN_PILL_LAYOUT,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  hostPillText: {
    color: "rgba(255,255,255,0.55)",
  },
  interestText: {
    fontSize: 12,
    textAlign: "center",
    includeFontPadding: false,
  },
});
