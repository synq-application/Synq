import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

type EventItem = {
  id: string;
  date: string;
  title: string;
  time?: string;
};

type Props = {
  events: EventItem[];
  ACCENT: string;
  fonts: any;
};

export default function MonthlyMemoReadOnly({
  events,
  ACCENT,
  fonts,
}: Props) {
  const [selectedDate, setSelectedDate] = useState(new Date());

  const daysInMonth = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth() + 1,
    0
  ).getDate();

  const startDay = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    1
  ).getDay();

  const calendarDays = [
    ...Array(startDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const parseLocalDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const selectedDayEvents = events.filter((e) => {
    const d = parseLocalDate(e.date);
    return (
      d.getDate() === selectedDate.getDate() &&
      d.getMonth() === selectedDate.getMonth() &&
      d.getFullYear() === selectedDate.getFullYear()
    );
  });

  const hasEvent = (day: number) =>
    events.some((e) => {
      const d = parseLocalDate(e.date);
      return (
        d.getDate() === day &&
        d.getMonth() === selectedDate.getMonth() &&
        d.getFullYear() === selectedDate.getFullYear()
      );
    });

  return (
    <View style={styles.card}>
      {/* HEADER */}
      <View style={styles.row}>
        <TouchableOpacity
          onPress={() =>
            setSelectedDate(
              new Date(
                selectedDate.getFullYear(),
                selectedDate.getMonth() - 1,
                1
              )
            )
          }
        >
          <Ionicons name="chevron-back" size={20} color="#888" />
        </TouchableOpacity>

        <Text style={{ color: "white", fontFamily: fonts.heavy }}>
          {selectedDate
            .toLocaleString("default", { month: "long" })
            .toUpperCase()}
        </Text>

        <TouchableOpacity
          onPress={() =>
            setSelectedDate(
              new Date(
                selectedDate.getFullYear(),
                selectedDate.getMonth() + 1,
                1
              )
            )
          }
        >
          <Ionicons name="chevron-forward" size={20} color="#888" />
        </TouchableOpacity>
      </View>

      {/* WEEK ROW */}
      <View style={{ flexDirection: "row" }}>
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <Text key={i} style={styles.week}>
            {d}
          </Text>
        ))}
      </View>

      {/* CALENDAR GRID */}
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {calendarDays.map((day, i) => {
          if (!day) return <View key={i} style={styles.day} />;

          const isSelected = selectedDate.getDate() === day;

          return (
            <TouchableOpacity
              key={i}
              onPress={() =>
                setSelectedDate(
                  new Date(
                    selectedDate.getFullYear(),
                    selectedDate.getMonth(),
                    day
                  )
                )
              }
              style={[
                styles.day,
                isSelected && {
                  borderWidth: 1.5,
                  borderColor: ACCENT,
                  borderRadius: 8,
                },
              ]}
            >
              <Text style={{ color: "#777" }}>{day}</Text>

              {hasEvent(day) && (
                <View style={[styles.dot, { backgroundColor: ACCENT }]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* EVENTS LIST */}
      {selectedDayEvents.length > 0 && (
        <View style={{ marginTop: 14 }}>
          {selectedDayEvents.map((e) => {
            const d = parseLocalDate(e.date);

            return (
              <View key={e.id} style={styles.eventCard}>
                <View style={styles.dateBlock}>
                  <Text style={styles.dayText}>
                    {d.toLocaleDateString("en-US", { weekday: "short" })}
                  </Text>
                  <Text style={styles.dateText}>{d.getDate()}</Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={{ color: "white", fontSize: 15 }}>
                    {e.title}
                  </Text>

                  {!!e.time && (
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        marginTop: 4,
                      }}
                    >
                      <Ionicons
                        name="time-outline"
                        size={12}
                        color="#666"
                      />
                      <Text style={{ color: "#666", marginLeft: 4 }}>
                        {e.time}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#111",
    padding: 16,
    borderRadius: 20,
  },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },

  week: {
    width: "14.28%",
    textAlign: "center",
    color: "#444",
  },

  day: {
    width: "14.28%",
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },

  dot: {
    position: "absolute",
    bottom: 6,
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  eventCard: {
    flexDirection: "row",
    backgroundColor: "#0a0a0a",
    borderRadius: 14,
    padding: 12,
    marginTop: 10,
  },

  dateBlock: {
    width: 44,
    alignItems: "center",
    marginRight: 10,
  },

  dayText: {
    color: "#666",
    fontSize: 11,
  },

  dateText: {
    color: "white",
    fontSize: 16,
  },
});