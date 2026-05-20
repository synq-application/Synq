import { fonts } from "@/constants/Variables";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

type TimeSlot = {
  key: string;
  hours: number;
  minutes: number;
  label: string;
};

function buildTimeSlots(): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let hours = 7; hours <= 23; hours++) {
    for (const minutes of [0, 30]) {
      if (hours === 23 && minutes === 30) break;
      const d = new Date();
      d.setHours(hours, minutes, 0, 0);
      slots.push({
        key: `${hours}-${minutes}`,
        hours,
        minutes,
        label: d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }),
      });
    }
  }
  return slots;
}

const TIME_SLOTS = buildTimeSlots();

type Props = {
  value: Date;
  onSelect: (date: Date) => void;
  accentColor: string;
};

export default function PlanTimePicker({ value, onSelect, accentColor }: Props) {
  const selectedKey = useMemo(() => {
    const h = value.getHours();
    const m = value.getMinutes();
    const match = TIME_SLOTS.find((s) => s.hours === h && s.minutes === m);
    return match?.key ?? null;
  }, [value]);

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        style={styles.scroll}
        contentContainerStyle={styles.grid}
      >
        {TIME_SLOTS.map((slot) => {
          const selected = slot.key === selectedKey;
          return (
            <TouchableOpacity
              key={slot.key}
              style={[
                styles.chip,
                selected && {
                  borderColor: accentColor,
                  backgroundColor: `${accentColor}22`,
                },
              ]}
              onPress={() => {
                const next = new Date(value);
                next.setHours(slot.hours, slot.minutes, 0, 0);
                onSelect(next);
              }}
              accessibilityLabel={slot.label}
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.chipText,
                  selected && { color: accentColor, fontFamily: fonts.heavy },
                ]}
              >
                {slot.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginTop: 8,
  },
  scroll: {
    maxHeight: 132,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    paddingBottom: 2,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#050505",
  },
  chipText: {
    color: "white",
    fontFamily: fonts.medium,
    fontSize: 14,
  },
});
