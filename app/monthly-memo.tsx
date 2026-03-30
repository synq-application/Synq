import { fonts, TEXT } from "@/constants/Variables";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import ConfirmModal from "./confirm-modal";

type EventItem = {
  id: string;
  date: string;
  title: string;
  time?: string;
  location?: string;
  joinedFromId?: string;
  joinedFromName?: string;
  joinedFromNames?: string[];
  planHostUid?: string;
};

type Props = {
  ACCENT: string;
  showEventModal: boolean;
  setShowEventModal: (val: boolean) => void;
  newEvent: { title: string; date: string; time: string; location: string };
  setNewEvent: React.Dispatch<any>;
  saveEvent: (event?: any) => void;
  deleteEvent: (id: string) => void;
  events: EventItem[];
};

const getInitialDate = () => {
  const d = new Date();
  d.setMinutes(0);
  d.setHours(d.getHours() + 1);
  return d;
};

export default function OpenPlans({
  ACCENT,
  showEventModal,
  setShowEventModal,
  newEvent,
  setNewEvent,
  saveEvent,
  deleteEvent,
  events,
}: Props) {
  const firstName = (name: string) => String(name || "").trim().split(/\s+/)[0] || "";

  const formatAlsoInterested = (event: EventItem) => {
    const rawNames = (Array.isArray(event.joinedFromNames) && event.joinedFromNames.length > 0
      ? event.joinedFromNames
      : [event.joinedFromName].filter(Boolean)) as string[];
    const names = Array.from(
      new Set(rawNames.map((n) => firstName(n)).filter(Boolean))
    );
    if (names.length === 0) return "A friend is also interested";
    if (names.length === 1) return `${names[0]} is also interested`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are also interested`;
    const head = names.slice(0, -1).join(", ");
    const tail = names[names.length - 1];
    return `${head}, and ${tail} are also interested`;
  };
  const [selectedDate, setSelectedDate] = useState(getInitialDate);
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const closePickers = () => setPicker(null);

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  const parseDate = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d); 
  };

  const setDate = (base: Date) => {
    const d = new Date(base);
    d.setHours(selectedDate.getHours());
    d.setMinutes(selectedDate.getMinutes());
    setSelectedDate(d);
  };

  const isSameCalendarDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const todayRef = new Date();
  const tomorrowRef = new Date(Date.now() + 86400000);
  const pickDateMode = picker === "date";
  const pillarToday =
    !pickDateMode && isSameCalendarDay(selectedDate, todayRef);
  const pillarTomorrow =
    !pickDateMode && isSameCalendarDay(selectedDate, tomorrowRef);
  const pillarPickDate =
    pickDateMode || (!pillarToday && !pillarTomorrow);

  const handleSave = () => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, "0");
    const day = String(selectedDate.getDate()).padStart(2, "0");
    const localDate = `${year}-${month}-${day}`;

    saveEvent({
      ...newEvent,
      date: localDate,
      time: formatTime(selectedDate),
    });

    setShowEventModal(false);
  };

  const handleDelete = (id: string) => setDeleteId(id);

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Open plans</Text>

      {!events.length && (
        <Text style={styles.empty}>Nothing planned… yet 👀</Text>
      )}

      {[...events]
        .sort((a, b) => {
          const baseA = parseDate(a.date);
          const baseB = parseDate(b.date);

          const getMinutes = (time?: string) => {
            if (!time) return 0;
            const [t, period] = time.split(" ");
            let [hours, minutes] = t.split(":").map(Number);

            if (period === "PM" && hours !== 12) hours += 12;
            if (period === "AM" && hours === 12) hours = 0;

            return hours * 60 + minutes;
          };

          const minutesA = getMinutes(a.time);
          const minutesB = getMinutes(b.time);

          return (
            baseA.getTime() + minutesA * 60000 -
            (baseB.getTime() + minutesB * 60000)
          );
        })
        .map((p) => {
          const d = parseDate(p.date);
          const isJoinedPlan =
            !!p.joinedFromId ||
            !!p.joinedFromName ||
            (Array.isArray(p.joinedFromNames) && p.joinedFromNames.length > 0);
          return (
            <TouchableOpacity
              key={p.id}
              style={[styles.card, isJoinedPlan && styles.joinedCard]}
              onLongPress={() => handleDelete(p.id)}
            >
            <View style={styles.dateBlock}>
              <Text style={styles.month}>
                {d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
              </Text>

              <Text style={styles.date}>{d.getDate()}</Text>

              <Text style={styles.day}>
                {d
                  .toLocaleDateString("en-US", { weekday: "short" })
                  .toUpperCase()}
              </Text>
            </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>{p.title}</Text>
                <Text style={styles.meta}>
                  {p.time}
                  {p.location ? ` · ${p.location}` : ""}
                </Text>
                {isJoinedPlan && (
                  <Text style={[styles.joinedMeta, { color: ACCENT }]}>
                    {formatAlsoInterested(p)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          );
        })}

      <TouchableOpacity
        style={[styles.addBtn, { borderColor: ACCENT }]}
        onPress={() => setShowEventModal(true)}
      >
        <Text style={{ color: ACCENT, fontSize: 18, fontFamily: fonts.heavy }}>
          + Add plan
        </Text>
      </TouchableOpacity>

      <Modal visible={showEventModal} transparent animationType="fade">
        <TouchableWithoutFeedback
          onPress={() => {
            Keyboard.dismiss();
            closePickers();
          }}
        >
          <View style={styles.overlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={30}
              style={{ width: "100%", alignItems: "center" }}
            >
              <View style={styles.modal}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  <View style={styles.headerRow}>
                    <Text
                      onPress={() => setShowEventModal(false)}
                      style={styles.cancel}
                    >
                      Cancel
                    </Text>
                    <Text style={styles.modalTitle}>Add a plan</Text>
                    <Text
                      onPress={handleSave}
                      style={{ color: ACCENT, fontSize: 16 }}
                    >
                      Post
                    </Text>
                  </View>

                  <TextInput
                    placeholder="What's the plan?"
                    placeholderTextColor="#555"
                    style={styles.input}
                    value={newEvent.title}
                    onFocus={closePickers}
                    onChangeText={(t) =>
                      setNewEvent((p: any) => ({ ...p, title: t }))
                    }
                  />

                  <View style={styles.row}>
                    <DateBtn
                      label="Today"
                      selected={pillarToday}
                      accentColor={ACCENT}
                      onPress={() => {
                        setPicker(null);
                        setDate(new Date());
                      }}
                    />
                    <DateBtn
                      label="Tomorrow"
                      selected={pillarTomorrow}
                      accentColor={ACCENT}
                      onPress={() => {
                        setPicker(null);
                        setDate(new Date(Date.now() + 86400000));
                      }}
                    />
                    <DateBtn
                      label="Pick a date"
                      selected={pillarPickDate}
                      accentColor={ACCENT}
                      onPress={() => setPicker("date")}
                    />
                  </View>

                  {picker === "date" && (
                    <DateTimePicker
                      value={selectedDate}
                      mode="date"
                      display="spinner"
                      themeVariant="dark"
                      textColor="white"
                      onChange={(e, d) => {
                        if (d) {
                          setDate(d);
                        }
                      }}
                    />
                  )}

                  <Text style={styles.label}>When?</Text>
                  <TouchableOpacity
                    style={styles.input}
                    onPress={() => setPicker("time")}
                  >
                    <Text style={{ color: "white", fontSize: 16 }}>
                      {selectedDate.toDateString()} ·{" "}
                      {formatTime(selectedDate)}
                    </Text>
                  </TouchableOpacity>

                  {picker === "time" && (
                    <DateTimePicker
                      value={selectedDate}
                      mode="time"
                      display="spinner"
                      themeVariant="dark"
                      textColor="white"
                      onChange={(e, t) => {
                        if (t) {
                          const updated = new Date(selectedDate);
                          updated.setHours(t.getHours());
                          updated.setMinutes(t.getMinutes());
                          setSelectedDate(updated);
                        }
                      }}
                    />
                  )}

                  <Text style={styles.label}>Where?</Text>
                  <TextInput
                    placeholder="Add location"
                    placeholderTextColor="#555"
                    style={styles.input}
                    value={newEvent.location}
                    onFocus={closePickers}
                    onChangeText={(t) =>
                      setNewEvent((p: any) => ({ ...p, location: t }))
                    }
                  />
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
      <ConfirmModal
        visible={!!deleteId}
        title="Delete plan"
        message="Are you sure?"
        confirmText="Delete"
        destructive
        onCancel={() => setDeleteId(null)}
        onConfirm={() => {
          if (deleteId) deleteEvent(deleteId);
          setDeleteId(null);
        }}
      />
    </View>
  );
}

const DateBtn = ({
  label,
  onPress,
  selected,
  accentColor,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
  accentColor: string;
}) => (
  <TouchableOpacity
    style={[
      styles.dateBtn,
      selected && {
        borderColor: accentColor,
        backgroundColor: `${accentColor}22`,
      },
    ]}
    onPress={onPress}
  >
    <Text
      style={{
        color: selected ? accentColor : "white",
        fontSize: 14,
        fontFamily: fonts.medium,
      }}
    >
      {label}
    </Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { width: "100%", alignSelf: "stretch" },
  header: {
    color: TEXT,
    fontSize: 20,
    fontFamily: fonts.heavy,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  empty: { color: "#666", marginBottom: 16 },
  card: { backgroundColor: "#0d0d0d", borderRadius: 20, padding: 14, marginBottom: 10, flexDirection: "row" },
  joinedCard: {
    borderWidth: 1,
    borderColor: "rgba(43,255,136,0.35)",
    backgroundColor: "rgba(43,255,136,0.07)",
  },
  dateBlock: { width: 48, alignItems: "center", marginRight: 12 },
  day: { color: "#666", fontSize: 10 },
  date: { color: "white", fontSize: 18 },
  title: { color: "white", fontSize: 15 },
  meta: { color: "#777", marginTop: 3, fontSize: 13 },
  joinedMeta: { marginTop: 6, fontSize: 12.5, fontFamily: fonts.medium },
  addBtn: { padding: 12, alignItems: "center", marginTop: 8 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" },
  modal: { width: "92%", backgroundColor: "#0a0a0a", padding: 18, borderRadius: 22 },
  modalTitle: { color: "white", fontSize: 18, fontFamily: fonts.medium },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  row: { flexDirection: "row", justifyContent: "flex-start", gap: 6, marginBottom: 14 },
  input: { backgroundColor: "#111", padding: 14, borderRadius: 12, color: "white", marginBottom: 12, fontSize: 16, fontFamily: fonts.medium },
  label: { color: "#777", marginBottom: 5, fontSize: 14, fontFamily: fonts.medium },
  dateBtn: { borderWidth: 1, borderColor: "#333", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  cancel: { color: "#aaa", fontSize: 14 },
  month: {
  color: "#666",
  fontSize: 10,
  marginBottom: 2,
},
});