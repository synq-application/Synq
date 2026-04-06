import { ACCENT, BORDER, fonts, TEXT } from "@/constants/Variables";
import { filterOutPastOpenPlans } from "@/src/lib/planEvents";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useMemo, useState } from "react";
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
  viewerUid?: string;
  hostDisplayNameByUid?: Record<string, string>;
  highlightEventId?: string | null;
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
  viewerUid = "",
  hostDisplayNameByUid = {},
  highlightEventId = null,
}: Props) {
  const firstName = (name: string) => String(name || "").trim().split(/\s+/)[0] || "";

  const formatOthersInterestedLine = (names: string[]) => {
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is interested`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are interested`;
    const head = names.slice(0, -1).join(", ");
    const tail = names[names.length - 1];
    return `${head}, and ${tail} are interested`;
  };

  const planAttributionLines = (event: EventItem): { primary: string | null; secondary: string | null } => {
    const isJoinedPlan =
      !!event.joinedFromId ||
      !!event.joinedFromName ||
      (Array.isArray(event.joinedFromNames) && event.joinedFromNames.length > 0);
    if (!isJoinedPlan) return { primary: null, secondary: null };

    const rawNames = (Array.isArray(event.joinedFromNames) && event.joinedFromNames.length > 0
      ? event.joinedFromNames
      : [event.joinedFromName].filter(Boolean)) as string[];
    const nameFirsts = Array.from(
      new Set(rawNames.map((n) => firstName(n)).filter(Boolean))
    );
    const hostUid = String(event.planHostUid || "").trim();
    const viewerFn = viewerUid ? firstName(hostDisplayNameByUid[viewerUid] || "") : "";
    const hostIsViewer = !!(hostUid && viewerUid && hostUid === viewerUid);

    let hostFn: string | null = null;
    if (hostUid && !hostIsViewer) {
      const hostFull = String(hostDisplayNameByUid[hostUid] || "").trim();
      hostFn = hostFull ? firstName(hostFull) : null;
      if (!hostFn && nameFirsts.length > 0) {
        hostFn = nameFirsts[0];
      }
      if (!hostFn) hostFn = "Friend";
    }

    const othersFirsts = hostFn && !hostIsViewer
      ? nameFirsts.filter((n) => n !== hostFn)
      : nameFirsts.filter((n) => n !== viewerFn);

    const primary =
      hostIsViewer || !hostUid
        ? null
        : hostFn
          ? `${hostFn}'s plan`
          : null;

    const secondary =
      othersFirsts.length > 0 ? formatOthersInterestedLine(othersFirsts) : null;

    return { primary, secondary };
  };
  const [selectedDate, setSelectedDate] = useState(getInitialDate);
  const [picker, setPicker] = useState<"date" | "time" | null>(null);
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState<EventItem | null>(null);

  const visibleEvents = useMemo(() => filterOutPastOpenPlans(events), [events]);

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

  const handleDelete = (event: EventItem) => setPendingDeleteEvent(event);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Open plans</Text>

      <View style={styles.plansBox}>
      {!visibleEvents.length && (
        <Text style={styles.empty}>Nothing planned… yet 👀</Text>
      )}

      {[...visibleEvents]
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
        .map((p, index, arr) => {
          const isLast = index === arr.length - 1;
          const d = parseDate(p.date);
          const isJoinedPlan =
            !!p.joinedFromId ||
            !!p.joinedFromName ||
            (Array.isArray(p.joinedFromNames) && p.joinedFromNames.length > 0);
          const { primary: hostLine, secondary: othersLine } = planAttributionLines(p);
          const isHighlighted =
            !!highlightEventId && String(p.id) === String(highlightEventId);
          return (
            <TouchableOpacity
              key={p.id}
              style={[
                styles.card,
                isJoinedPlan && styles.joinedCard,
                isHighlighted && { borderColor: ACCENT, borderWidth: 2 },
                isLast && { marginBottom: 0 },
              ]}
              onLongPress={() => handleDelete(p)}
            >
            <View style={styles.dateBlock}>
              <Text style={styles.month}>
                {d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
              </Text>
              <View style={styles.dateNumberWrap}>
                <Text style={styles.date}>{d.getDate()}</Text>
              </View>
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
                {isJoinedPlan && (hostLine || othersLine) ? (
                  <>
                    {hostLine ? (
                      <Text style={styles.hostPlanLine}>{hostLine}</Text>
                    ) : null}
                    {othersLine ? (
                      <Text
                        style={[
                          styles.joinedMeta,
                          { color: ACCENT, marginTop: hostLine ? 4 : 6 },
                        ]}
                      >
                        {othersLine}
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={styles.addBtnRow}>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowEventModal(true)}
          accessibilityLabel="Add plan"
        >
          <Text style={styles.addBtnText}>+ Add plan</Text>
        </TouchableOpacity>
      </View>

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
        visible={!!pendingDeleteEvent}
        title={
          pendingDeleteEvent?.planHostUid &&
          viewerUid &&
          pendingDeleteEvent.planHostUid !== viewerUid
            ? "Remove this plan?"
            : "Delete plan"
        }
        message={
          pendingDeleteEvent?.planHostUid &&
          viewerUid &&
          pendingDeleteEvent.planHostUid !== viewerUid
            ? "This removes it from your open plans and updates interest for this friend."
            : "Are you sure?"
        }
        confirmText={
          pendingDeleteEvent?.planHostUid &&
          viewerUid &&
          pendingDeleteEvent.planHostUid !== viewerUid
            ? "Remove"
            : "Delete"
        }
        destructive
        onCancel={() => setPendingDeleteEvent(null)}
        onConfirm={() => {
          if (pendingDeleteEvent?.id) deleteEvent(pendingDeleteEvent.id);
          setPendingDeleteEvent(null);
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
  sectionTitle: {
    color: TEXT,
    fontSize: 20,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
    marginBottom: 16,
  },
  plansBox: {
    paddingVertical: 0,
    paddingHorizontal: 0,
  },
  empty: {
    color: "#666",
    marginBottom: 0,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "left",
    alignSelf: "stretch",
  },
  card: {
    backgroundColor: "#0d0d0d",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 12,
    marginBottom: 6,
    flexDirection: "row",
  },
  joinedCard: {
    borderColor: "rgba(43,255,136,0.35)",
    backgroundColor: "rgba(43,255,136,0.07)",
  },
  dateBlock: {
    width: 52,
    marginRight: 12,
    alignSelf: "stretch",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
  },
  dateNumberWrap: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    minHeight: 0,
  },
  day: {
    color: "#888",
    fontSize: 11,
    fontFamily: fonts.heavy,
    letterSpacing: 0.3,
    width: "100%",
    textAlign: "center",
  },
  date: {
    color: "white",
    fontSize: 19,
    fontFamily: fonts.heavy,
    lineHeight: 23,
    letterSpacing: -0.5,
    textAlign: "center",
    width: "100%",
  },
  title: { color: "white", fontSize: 15 },
  meta: { color: "#777", marginTop: 3, fontSize: 13 },
  joinedMeta: { marginTop: 6, fontSize: 12.5, fontFamily: fonts.medium },
  hostPlanLine: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 12,
    marginTop: 5,
    fontFamily: fonts.medium,
  },
  addBtnRow: {
    width: "100%",
    alignItems: "flex-start",
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: ACCENT,
    borderStyle: "solid",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  addBtnText: { color: ACCENT, fontFamily: fonts.heavy, fontSize: 13, marginLeft: 0 },
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
    color: "#888",
    fontSize: 11,
    fontFamily: fonts.heavy,
    letterSpacing: 0.4,
    width: "100%",
    textAlign: "center",
  },
});