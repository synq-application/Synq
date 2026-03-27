import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type EventItem = {
  id: string;
  date: string;
  title: string;
  time?: string;
  location?: string;
  joinedFromFriendUid?: string;
  joinedFromId?: string;
  joinedFromIds?: string[];
  planHostUid?: string;
};

type Props = {
  events: EventItem[];
  ACCENT: string;
  fonts: any;
  onPressPlan?: (event: EventItem) => void;
  isPlanJoined?: (event: EventItem) => boolean;
  /** When true, this row is the viewer’s own plan on the friend’s list (they joined you) — show label, not Join. */
  isViewerHostOfPlan?: (event: EventItem) => boolean;
};

export default function FriendOpenPlans({
  events,
  ACCENT,
  fonts,
  onPressPlan,
  isPlanJoined,
  isViewerHostOfPlan,
}: Props) {
  const parseDate = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  return (
    <View style={styles.container}>
      {events.length === 0 && (
        <Text style={styles.empty}>
          Nothing planned right now 👀
        </Text>
      )}

      {events.map((p) => {
        const d = parseDate(p.date);
        const canJoin = typeof onPressPlan === "function";
        const joined = isPlanJoined?.(p) ?? false;
        const isHost = isViewerHostOfPlan?.(p) ?? false;

        return (
          <View key={p.id} style={styles.card}>
            <View style={styles.dateBlock}>
              <Text style={styles.day}>
                {d
                  .toLocaleDateString("en-US", { weekday: "short" })
                  .toUpperCase()}
              </Text>
              <Text style={styles.date}>{d.getDate()}</Text>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontFamily: fonts.medium }]}>
                {p.title}
              </Text>
              <Text style={styles.meta}>
                {p.time}
                {p.location ? ` · ${p.location}` : ""}
              </Text>
            </View>
            {isHost ? (
              <View style={styles.hostPill}>
                <Text
                  style={[
                    styles.joinText,
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
                    styles.joinPill,
                    joined
                      ? { borderColor: "rgba(255,255,255,0.2)", backgroundColor: "rgba(255,255,255,0.08)" }
                      : { borderColor: ACCENT },
                  ]}
                  activeOpacity={0.85}
                  onPress={() => onPressPlan?.(p)}
                >
                  <Text
                    style={[
                      styles.joinText,
                      { color: joined ? "rgba(255,255,255,0.75)" : ACCENT, fontFamily: fonts.heavy },
                    ]}
                  >
                    {joined ? "Joined" : "Join"}
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
    width: "92%"
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
    backgroundColor: "#0d0d0d",
    borderRadius: 20,
    padding: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
  },

  dateBlock: {
    width: 48,
    alignItems: "center",
    marginRight: 12,
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

  title: {
    color: "white",
    fontSize: 15,
  },

  meta: {
    color: "#777",
    marginTop: 3,
    fontSize: 13,
  },

  joinPill: {
    borderWidth: 1,
    borderColor: "#333",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: 8,
    minWidth: 62,
    alignItems: "center",
  },
  hostPill: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginLeft: 8,
    alignItems: "center",
  },
  hostPillText: {
    color: "rgba(255,255,255,0.55)",
  },
  joinText: {
    fontSize: 12.5,
  },
});