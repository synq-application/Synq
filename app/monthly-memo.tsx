import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";

type EventItem = {
  id: string;
  date: string;
  title: string;
  time?: string;
};

type MonthlyMemoProps = {
  ACCENT: string;
  fonts: { heavy: string; medium: string; black: string };
  showEventModal: boolean;
  setShowEventModal: (val: boolean) => void;
  newEvent: { title: string; date: string; time: string; location: string };
  setNewEvent: React.Dispatch<any>;
  saveEvent: (event?: any) => void;
  deleteEvent: (id: string) => void;
  selectedDate: Date;
  setSelectedDate: (date: Date) => void;
  events: EventItem[];
};

export default function MonthlyMemo({
  ACCENT,
  fonts,
  showEventModal,
  setShowEventModal,
  newEvent,
  setNewEvent,
  saveEvent,
  deleteEvent,
  selectedDate,
  setSelectedDate,
  events,
}: MonthlyMemoProps) {
  const defaultHour = "1";
  const defaultMinute = "00";
  const defaultAmPm = "AM";

  const [pickerMode, setPickerMode] = useState<"date" | "time" | null>(null);
  const [hour, setHour] = useState(defaultHour);
  const [minute, setMinute] = useState(defaultMinute);
  const [ampm, setAmPm] = useState<"AM" | "PM">(defaultAmPm);

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

  const formatFullDate = (date: Date) => {
    const weekday = date.toLocaleDateString("en-US", { weekday: "long" });
    const month = date.toLocaleDateString("en-US", { month: "long" });
    const day = date.getDate();
    return `${weekday}, ${month} ${day}`;
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

  const handleDelete = (id: string) => {
    Alert.alert("Delete event", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteEvent(id) },
    ]);
  };

  const resetEvent = () => {
    setNewEvent({ title: "", date: "", time: "", location: "" });
    setPickerMode(null);
    setHour(defaultHour);
    setMinute(defaultMinute);
    setAmPm(defaultAmPm);
  };

  const openModal = () => {
    setNewEvent((p: any) => ({
      ...p,
      date: `${selectedDate.getFullYear()}-${(selectedDate.getMonth() + 1)
        .toString()
        .padStart(2, "0")}-${selectedDate
          .getDate()
          .toString()
          .padStart(2, "0")}`,
    }));
    setShowEventModal(true);
  };

  const ITEM_HEIGHT = 40;

  const renderPicker = (
    data: string[],
    selected: string,
    setValue: (v: string) => void
  ) => (
    <FlatList
      style={{ flex: 1 }}
      data={data}
      keyExtractor={(item) => item}
      snapToInterval={ITEM_HEIGHT}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: ITEM_HEIGHT * 2 }}
      onMomentumScrollEnd={(e) => {
        const index = Math.round(
          e.nativeEvent.contentOffset.y / ITEM_HEIGHT
        );
        if (data[index]) setValue(data[index]);
      }}
      renderItem={({ item }) => (
        <View style={{ height: ITEM_HEIGHT, justifyContent: "center", alignItems: "center" }}>
          <Text
            style={{
              color: item === selected ? ACCENT : "#555",
              fontSize: item === selected ? 22 : 16,
            }}
          >
            {item}
          </Text>
        </View>
      )}
    />
  );

  return (
    <View style={{ marginTop: 30, width: "95%", alignSelf: "center" }}>
      <Text style={{ color: "white", fontSize: 20, fontFamily: fonts.heavy, marginLeft: 18 }}>
        Monthly memo
      </Text>
      <Text style={{ color: "gray", fontSize: 14, fontFamily: fonts.medium, marginLeft: 18, marginTop: 5 }}>
        Let your friends know what you're up to this month.
      </Text>
      <View style={styles.card}>
        <View style={styles.row}>
          <TouchableOpacity
            onPress={() =>
              setSelectedDate(
                new Date(selectedDate.getFullYear(), selectedDate.getMonth() - 1, 1)
              )
            }
          >
            <Ionicons name="chevron-back" size={20} color="#888" />
          </TouchableOpacity>

          <Text style={{ color: "white" }}>
            {selectedDate.toLocaleString("default", { month: "long" }).toUpperCase()}
          </Text>

          <TouchableOpacity
            onPress={() =>
              setSelectedDate(
                new Date(selectedDate.getFullYear(), selectedDate.getMonth() + 1, 1)
              )
            }
          >
            <Ionicons name="chevron-forward" size={20} color="#888" />
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: "row" }}>
          {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
            <Text key={i} style={styles.week}>{d}</Text>
          ))}
        </View>

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
                  selectedDate.getDate() === day && {
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
        {selectedDayEvents.length > 0 && (
          <View style={{ marginTop: 16 }}>
            <Text style={styles.sectionTitle}>
              {formatFullDate(selectedDate)}
            </Text>

            {selectedDayEvents.map((e) => {
              const d = parseLocalDate(e.date);
              return (
                <TouchableOpacity
                  key={e.id}
                  onLongPress={() => handleDelete(e.id)}
                  style={styles.eventCard}
                >
                  <View style={styles.dateBlock}>
                    <Text style={styles.dayText}>
                      {d.toLocaleDateString("en-US", { weekday: "short" })}
                    </Text>
                    <Text style={styles.dateText}>{d.getDate()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: "white", fontSize: 16 }}>{e.title}</Text>

                    {e.time ? (
                      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
                        <Ionicons name="time-outline" size={12} color="#666" />
                        <Text style={{ color: "#666", marginLeft: 4, fontSize: 12 }}>
                          {e.time}
                        </Text>
                      </View>
                    ) : (
                      <Text style={{ color: "red", marginTop: 4 }}>
                        (no time saved)
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </View>
      <TouchableOpacity
        style={[styles.addBtn, { borderColor: ACCENT }]}
        onPress={openModal}
      >
        <Ionicons name="add" size={18} color={ACCENT} />
        <Text style={{ color: ACCENT, marginLeft: 8 }}>
          New event
        </Text>
      </TouchableOpacity>
      <Modal visible={showEventModal} transparent animationType="fade">
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => { Keyboard.dismiss(); setPickerMode(null); }}>
            <View style={StyleSheet.absoluteFillObject} />
          </TouchableWithoutFeedback>

          <View style={styles.modal}>
            <Text style={{ color: "white", fontSize: 26, marginBottom: 16 }}>
              Add an event
            </Text>

            <TextInput
              style={styles.field}
              placeholder="What’s the plan?"
              placeholderTextColor="#555"
              value={newEvent.title}
              onChangeText={(t) =>
                setNewEvent((p: any) => ({ ...p, title: t }))
              }
            />

            <TouchableOpacity
              style={styles.field}
              onPress={() => {
                Keyboard.dismiss();
                setPickerMode("time");
              }}
            >
              <Text style={{ color: "white" }}>
                {pickerMode === "time"
                  ? `${hour}:${minute} ${ampm}`
                  : newEvent.time || "Add time"}
              </Text>
            </TouchableOpacity>

            {pickerMode === "time" && (
              <View style={styles.timePicker}>
                {renderPicker([...Array(12)].map((_, i) => (i + 1).toString()), hour, setHour)}
                {renderPicker(["00", "15", "30", "45"], minute, setMinute)}
                {renderPicker(["AM", "PM"], ampm, (v) => setAmPm(v as "AM" | "PM"))}
                <View style={styles.highlight} />
              </View>
            )}

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  resetEvent();
                  setShowEventModal(false);
                }}
              >
                <Text style={{ color: "#aaa" }}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.createBtn}
                onPress={() => {
                  const formattedTime = `${hour}:${minute} ${ampm}`;
                  saveEvent({ ...newEvent, time: formattedTime });
                  resetEvent();
                  setShowEventModal(false);
                }}
              >
                <Text style={{ color: "black" }}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#111", padding: 16, borderRadius: 20, width: "95%", alignSelf: "center", marginTop: 14 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  week: { width: "14.28%", textAlign: "center", color: "#444" },
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
  sectionTitle: { color: "#888", marginBottom: 8 },

  eventCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0a0a0a",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },

  dateBlock: {
    width: 50,
    alignItems: "center",
    marginRight: 12,
  },
  dayText: { color: "#666", fontSize: 12 },
  dateText: { color: "white", fontSize: 18 },

  addBtn: {
    flexDirection: "row",
    justifyContent: "center",
    padding: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 14,
    marginTop: 14,
    width: 160,
    alignSelf: "center",
  },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },

  modal: {
    width: "92%",
    backgroundColor: "#0a0a0a",
    padding: 20,
    borderRadius: 20,
  },

  field: {
    backgroundColor: "#111",
    padding: 12,
    marginTop: 10,
    borderRadius: 10,
    color: "white",
  },
  buttonRow: { flexDirection: "row", marginTop: 20, gap: 10 },
  cancelBtn: {
    flex: 1,
    backgroundColor: "#222",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  createBtn: {
    flex: 1,
    backgroundColor: "#7DFFA6",
    padding: 14,
    borderRadius: 10,
    alignItems: "center",
  },

  timePicker: { flexDirection: "row", height: 200, marginTop: 20 },

  highlight: {
    position: "absolute",
    top: "50%",
    marginTop: -20,
    height: 40,
    width: "100%",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#333",
    pointerEvents: "none",
  },
});