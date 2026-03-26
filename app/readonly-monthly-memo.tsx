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
  onPressPlan?: (event: EventItem) => void; // for future "interested"
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

        return (
          <TouchableOpacity
            key={p.id}
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => onPressPlan?.(p)}
          >
            <View style={styles.dateBlock}>
              <Text style={styles.day}>
                {d
                  .toLocaleDateString("en-US", { weekday: "short" })
                  .toUpperCase()}
              </Text>
              <Text style={styles.date}>{d.getDate()}</Text>
            </View>

            {/* EVENT INFO */}
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { fontFamily: fonts.medium }]}>
                {p.title}
              </Text>

              <Text style={styles.meta}>
                {p.time}
                {p.location ? ` · ${p.location}` : ""}
              </Text>
            </View>

            {/* OPTIONAL ACTION (future) */}
            <View style={styles.joinPill}>
              <Text style={{ color: ACCENT, fontSize: 12 }}>
                Join
              </Text>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "92%",
    alignSelf: "center",
    marginTop: 20,
  },

  header: {
    color: "white",
    fontSize: 18,
    marginBottom: 14,
  },

  empty: {
    color: "#666",
    fontSize: 14,
    marginBottom: 16,
  },

  card: {
    backgroundColor: "#0d0d0d",
    borderRadius: 20,
    padding: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    marginTop: -10,
    marginLeft: -20
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
    paddingVertical: 6,
    marginLeft: 8,
  },
});