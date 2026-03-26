import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type EventItem = {
  id: string;
  date: string;
  title: string;
  time?: string;
  location?: string;
};

type Props = {
  events: EventItem[];
  ACCENT: string;
  fonts: any;
  onPressPlan?: (event: EventItem) => void;
};

export default function FriendOpenPlans({
  events,
  ACCENT,
  fonts,
  onPressPlan,
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
            {canJoin && (
              <TouchableOpacity
                style={[styles.joinPill, { borderColor: ACCENT }]}
                activeOpacity={0.85}
                onPress={() => onPressPlan?.(p)}
              >
                <Text style={[styles.joinText, { color: ACCENT, fontFamily: fonts.heavy }]}>
                  Join
                </Text>
              </TouchableOpacity>
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
  joinText: {
    fontSize: 12.5,
  },
});