import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  fonts,
  MODAL_RADIUS,
  profileScreenSectionTitle,
  TEXT,
} from "@/constants/Variables";
import PlanDateCalendar from "@/src/components/PlanDateCalendar";
import PlanTimePicker from "@/src/components/PlanTimePicker";
import SynqPlusAddButton from "@/src/components/SynqPlusAddButton";
import { filterOutPastOpenPlans } from "@/src/lib/planEvents";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Dimensions,
  Keyboard,
  type KeyboardEvent,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
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
  const [activePicker, setActivePicker] = useState<"date" | "time" | null>(null);
  const [pendingDeleteEvent, setPendingDeleteEvent] = useState<EventItem | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const planScrollRef = useRef<ScrollView>(null);
  const locationInputRef = useRef<TextInput>(null);

  const minimumSelectableDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  useEffect(() => {
    if (showEventModal) {
      setSelectedDate(getInitialDate());
      setActivePicker(null);
      setNewEvent({ title: "", date: "", time: "", location: "" });
      setKeyboardInset(0);
    }
  }, [showEventModal, setNewEvent]);

  useEffect(() => {
    if (!showEventModal) return;

    const onShow = (e: KeyboardEvent) => {
      setKeyboardInset(e.endCoordinates.height);
    };
    const onHide = () => setKeyboardInset(0);

    const showEvt =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [showEventModal]);

  const visibleEvents = useMemo(() => filterOutPastOpenPlans(events), [events]);

  const closeModal = () => {
    Keyboard.dismiss();
    setActivePicker(null);
    setShowEventModal(false);
  };

  const handleBackdropPress = () => {
    if (keyboardInset > 0) {
      Keyboard.dismiss();
      return;
    }
    if (activePicker) {
      setActivePicker(null);
      return;
    }
    closeModal();
  };

  const canPost = newEvent.title.trim().length > 0;

  const dismissPickers = () => setActivePicker(null);

  const locationScrollY = useRef(0);
  const pendingLocationScroll = useRef(false);
  const popupScrollMaxHeight = useMemo(
    () => Math.min(420, Dimensions.get("window").height * 0.48),
    []
  );

  const scrollToLocationField = () => {
    requestAnimationFrame(() => {
      planScrollRef.current?.scrollTo({
        y: Math.max(0, locationScrollY.current - 20),
        animated: true,
      });
    });
  };

  useEffect(() => {
    if (keyboardInset <= 0 || !pendingLocationScroll.current) return;
    pendingLocationScroll.current = false;
    scrollToLocationField();
  }, [keyboardInset]);

  const collapseActivePicker = () => {
    if (activePicker) setActivePicker(null);
  };

  const handleCalendarSelect = (d: Date) => {
    setDate(d);
    setActivePicker(null);
  };

  const handleTimeSelect = (d: Date) => {
    setSelectedDate(d);
    setActivePicker(null);
  };

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
  const isToday = isSameCalendarDay(selectedDate, todayRef);
  const isTomorrow = isSameCalendarDay(selectedDate, tomorrowRef);
  const isCustomDate = !isToday && !isTomorrow;

  const formatPlanDateLabel = (d: Date) => {
    if (isSameCalendarDay(d, todayRef)) return "Today";
    if (isSameCalendarDay(d, tomorrowRef)) return "Tomorrow";
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const handleSave = () => {
    if (!canPost) return;
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
              <Text style={styles.day}>
                {d
                  .toLocaleDateString("en-US", { weekday: "short" })
                  .toUpperCase()}
              </Text>
              <View style={styles.dateNumberWrap}>
                <Text style={styles.date}>{d.getDate()}</Text>
              </View>
              <Text style={styles.month}>
                {d.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
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
        <SynqPlusAddButton
          onPress={() => setShowEventModal(true)}
          accessibilityLabel="Add plan"
          style={styles.addBtnSpacing}
        />
      </View>

      <Modal
        visible={showEventModal}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <Pressable style={styles.popupOverlay} onPress={handleBackdropPress}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.popupAvoid}
          >
            <Pressable
              style={styles.popupCard}
              onPress={(e) => {
                e.stopPropagation();
                Keyboard.dismiss();
                if (activePicker) setActivePicker(null);
              }}
            >
              <View style={styles.popupTitleRow}>
                <Text style={styles.popupTitle}>Add a plan</Text>
                <TouchableOpacity
                  onPress={closeModal}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel="Close"
                >
                  <Ionicons name="close" size={24} color={TEXT} />
                </TouchableOpacity>
              </View>

              <TouchableWithoutFeedback
                onPress={Keyboard.dismiss}
                accessible={false}
              >
                <View>
                  <Text style={styles.sheetSub}>
                    Tell friends what you&apos;re doing, they can join.
                  </Text>
                </View>
              </TouchableWithoutFeedback>

              <ScrollView
                ref={planScrollRef}
                style={{ maxHeight: popupScrollMaxHeight }}
                contentContainerStyle={[
                  styles.popupScrollContent,
                  keyboardInset > 0 ? { paddingBottom: 16 } : null,
                ]}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                onScrollBeginDrag={Keyboard.dismiss}
                showsVerticalScrollIndicator={false}
                bounces={false}
              >
              <TouchableWithoutFeedback
                onPress={Keyboard.dismiss}
                accessible={false}
              >
                <View>
              <TextInput
                placeholder="What's the plan?"
                placeholderTextColor="#555"
                style={styles.planInput}
                value={newEvent.title}
                onFocus={dismissPickers}
                onChangeText={(t) =>
                  setNewEvent((p: any) => ({ ...p, title: t }))
                }
                returnKeyType="next"
                blurOnSubmit={false}
              />

              <View style={styles.scheduleBlock}>
                <TouchableWithoutFeedback onPress={collapseActivePicker}>
                  <View>
                    <View style={styles.quickDateRow}>
                      <DateBtn
                        label="Today"
                        selected={isToday}
                        accentColor={ACCENT}
                        onPress={() => {
                          setActivePicker(null);
                          setDate(new Date());
                        }}
                      />
                      <DateBtn
                        label="Tomorrow"
                        selected={isTomorrow}
                        accentColor={ACCENT}
                        onPress={() => {
                          setActivePicker(null);
                          setDate(new Date(Date.now() + 86400000));
                        }}
                      />
                      <DateBtn
                        label="Other"
                        selected={isCustomDate}
                        accentColor={ACCENT}
                        onPress={() =>
                          setActivePicker((p) => (p === "date" ? null : "date"))
                        }
                      />
                    </View>

                    <View style={styles.dateTimeRow}>
                      <TouchableOpacity
                        style={[
                          styles.dateTimeField,
                          activePicker === "date" && styles.dateTimeFieldActive,
                        ]}
                        onPress={() =>
                          setActivePicker((p) => (p === "date" ? null : "date"))
                        }
                      >
                        <Ionicons
                          name="calendar-outline"
                          size={18}
                          color={activePicker === "date" ? ACCENT : "#888"}
                        />
                        <View style={styles.dateTimeTextWrap}>
                          <Text style={styles.dateTimeValue}>
                            {formatPlanDateLabel(selectedDate)}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.dateTimeField,
                          activePicker === "time" && styles.dateTimeFieldActive,
                        ]}
                        onPress={() =>
                          setActivePicker((p) => (p === "time" ? null : "time"))
                        }
                      >
                        <Ionicons
                          name="time-outline"
                          size={18}
                          color={activePicker === "time" ? ACCENT : "#888"}
                        />
                        <View style={styles.dateTimeTextWrap}>
                          <Text style={styles.dateTimeValue}>
                            {formatTime(selectedDate)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  </View>
                </TouchableWithoutFeedback>

                {activePicker === "date" ? (
                  <View style={styles.calendarWrap}>
                    <PlanDateCalendar
                      value={selectedDate}
                      minimumDate={minimumSelectableDate}
                      accentColor={ACCENT}
                      onChange={handleCalendarSelect}
                    />
                  </View>
                ) : null}

                {activePicker === "time" ? (
                  <PlanTimePicker
                    value={selectedDate}
                    accentColor={ACCENT}
                    onSelect={handleTimeSelect}
                  />
                ) : null}
              </View>

              <View
                onLayout={(e) => {
                  locationScrollY.current = e.nativeEvent.layout.y;
                }}
              >
                <TextInput
                  ref={locationInputRef}
                  placeholder="Add location"
                  placeholderTextColor="#555"
                  style={styles.planInputSecondary}
                  value={newEvent.location}
                  onFocus={() => {
                    dismissPickers();
                    pendingLocationScroll.current = true;
                    if (keyboardInset > 0) {
                      pendingLocationScroll.current = false;
                      scrollToLocationField();
                    }
                  }}
                  onChangeText={(t) =>
                    setNewEvent((p: any) => ({ ...p, location: t }))
                  }
                  returnKeyType="done"
                />
              </View>
                </View>
              </TouchableWithoutFeedback>
              </ScrollView>

              <TouchableOpacity
                style={[styles.popupPostBtn, !canPost && styles.popupPostBtnDisabled]}
                disabled={!canPost}
                onPress={handleSave}
              >
                <Text style={styles.popupPostBtnText}>Post</Text>
              </TouchableOpacity>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
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
  sectionTitle: profileScreenSectionTitle,
  plansBox: {
    paddingVertical: 0,
    paddingHorizontal: 0,
    alignItems: "flex-start",
    width: "100%",
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
    alignSelf: "flex-start",
    width: "86%",
    maxWidth: 340,
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
  addBtnSpacing: { marginTop: 16, marginBottom: 8 },
  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  popupAvoid: {
    width: "100%",
    maxWidth: 400,
  },
  popupCard: {
    width: "100%",
    backgroundColor: BG,
    borderRadius: MODAL_RADIUS,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 18,
  },
  popupTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  popupTitle: {
    flex: 1,
    color: TEXT,
    fontFamily: fonts.heavy,
    fontSize: 22,
    letterSpacing: -0.2,
  },
  popupScrollContent: {
    paddingBottom: 4,
  },
  popupPostBtn: {
    marginTop: 14,
    height: 50,
    borderRadius: BUTTON_RADIUS,
    backgroundColor: ACCENT,
    alignItems: "center",
    justifyContent: "center",
  },
  popupPostBtnDisabled: {
    opacity: 0.4,
  },
  popupPostBtnText: {
    color: "#061006",
    fontFamily: fonts.heavy,
    fontSize: 16,
  },
  calendarWrap: {
    marginTop: 6,
    marginBottom: 2,
  },
  sheetSub: {
    color: "rgba(255,255,255,0.62)",
    fontFamily: fonts.medium,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  planInput: {
    backgroundColor: "#0c0c0c",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 14,
    borderRadius: BUTTON_RADIUS,
    color: TEXT,
    fontSize: 16,
    fontFamily: fonts.medium,
    marginBottom: 10,
  },
  planInputSecondary: {
    backgroundColor: "#0c0c0c",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    padding: 12,
    borderRadius: BUTTON_RADIUS,
    color: TEXT,
    fontSize: 15,
    fontFamily: fonts.medium,
    marginBottom: 0,
  },
  scheduleBlock: {
    backgroundColor: "#0c0c0c",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: BUTTON_RADIUS,
    padding: 10,
    marginBottom: 10,
  },
  quickDateRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },
  dateTimeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
  },
  dateTimeField: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#050505",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dateTimeFieldActive: {
    borderColor: ACCENT,
    backgroundColor: "rgba(0,255,133,0.08)",
  },
  dateTimeTextWrap: { flex: 1 },
  dateTimeValue: {
    color: TEXT,
    fontSize: 15,
    fontFamily: fonts.heavy,
  },
  dateBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "#050505",
  },
  month: {
    color: "#888",
    fontSize: 11,
    fontFamily: fonts.heavy,
    letterSpacing: 0.4,
    width: "100%",
    textAlign: "center",
  },
});