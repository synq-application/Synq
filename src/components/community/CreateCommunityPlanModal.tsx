import AlertModal from "@/app/alert-modal";
import {
  ACCENT,
  BG,
  BORDER,
  BUTTON_RADIUS,
  fonts,
  MODAL_RADIUS,
  PRIMARY_CTA_WIDTH,
  TEXT,
} from "@/constants/Variables";
import CloseButton from "@/src/components/CloseButton";
import PlanDateCalendar from "@/src/components/PlanDateCalendar";
import PlanTimePicker from "@/src/components/PlanTimePicker";
import { filterOrReject } from "@/src/lib/contentFilter";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Keyboard,
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
  type KeyboardEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type Props = {
  visible: boolean;
  busy: boolean;
  onClose: () => void;
  onCreate: (input: { title: string; date: string; time: string; location: string }) => void;
};

function getInitialDate() {
  const d = new Date();
  d.setMinutes(0);
  d.setHours(d.getHours() + 1);
  return d;
}

function formatDateValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function isSameCalendarDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function DateBtn({
  label,
  onPress,
  selected,
}: {
  label: string;
  onPress: () => void;
  selected: boolean;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.dateBtn,
        selected && {
          borderColor: ACCENT,
          backgroundColor: `${ACCENT}22`,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Text style={[styles.dateBtnText, selected && styles.dateBtnTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function CreateCommunityPlanModal({ visible, busy, onClose, onCreate }: Props) {
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [location, setLocation] = useState("");
  const [selectedDate, setSelectedDate] = useState(getInitialDate);
  const [activePicker, setActivePicker] = useState<"date" | "time" | null>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const modalMaxHeight = useMemo(() => {
    const windowH = Dimensions.get("window").height;
    return windowH - insets.top - insets.bottom - 24;
  }, [insets.top, insets.bottom]);

  const minimumSelectableDate = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayRef = new Date();
  const tomorrowRef = new Date(Date.now() + 86400000);
  const isToday = isSameCalendarDay(selectedDate, todayRef);
  const isTomorrow = isSameCalendarDay(selectedDate, tomorrowRef);
  const isCustomDate = !isToday && !isTomorrow;

  const canPost = title.trim().length > 0 && !busy;

  const resetForm = useCallback(() => {
    setTitle("");
    setLocation("");
    setSelectedDate(getInitialDate());
    setActivePicker(null);
    setKeyboardInset(0);
  }, []);

  useEffect(() => {
    if (!visible) resetForm();
  }, [visible, resetForm]);

  useEffect(() => {
    if (!visible) return;

    const onShow = (e: KeyboardEvent) => {
      setKeyboardInset(e.endCoordinates.height);
    };
    const onHide = () => setKeyboardInset(0);

    const showEvt = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvt = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const showSub = Keyboard.addListener(showEvt, onShow);
    const hideSub = Keyboard.addListener(hideEvt, onHide);
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [visible]);

  const dismissPickers = useCallback(() => {
    setActivePicker(null);
  }, []);

  const dismissKeyboard = useCallback(() => {
    Keyboard.dismiss();
  }, []);

  const collapseActivePicker = useCallback(() => {
    Keyboard.dismiss();
    if (activePicker) setActivePicker(null);
  }, [activePicker]);

  const togglePicker = (picker: "date" | "time") => {
    Keyboard.dismiss();
    setActivePicker((p) => (p === picker ? null : picker));
  };

  const setDate = (base: Date) => {
    const d = new Date(base);
    d.setHours(selectedDate.getHours());
    d.setMinutes(selectedDate.getMinutes());
    setSelectedDate(d);
  };

  const formatPlanDateLabel = (d: Date) => {
    if (isSameCalendarDay(d, todayRef)) return "Today";
    if (isSameCalendarDay(d, tomorrowRef)) return "Tomorrow";
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const handleCalendarSelect = (d: Date) => {
    setDate(d);
    setActivePicker(null);
  };

  const handleClose = () => {
    if (busy) return;
    Keyboard.dismiss();
    resetForm();
    onClose();
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
    handleClose();
  };

  const handleSubmit = () => {
    if (!canPost) return;

    const trimmedTitle = title.trim();
    const titleCheck = filterOrReject(trimmedTitle);
    if (!titleCheck.ok) {
      setAlertMessage(titleCheck.reason);
      setAlertVisible(true);
      return;
    }
    const locationTrimmed = location.trim();
    if (locationTrimmed) {
      const locationCheck = filterOrReject(locationTrimmed);
      if (!locationCheck.ok) {
        setAlertMessage(locationCheck.reason);
        setAlertVisible(true);
        return;
      }
    }

    Keyboard.dismiss();
    onCreate({
      title: trimmedTitle,
      date: formatDateValue(selectedDate),
      time: formatTime(selectedDate),
      location: locationTrimmed,
    });
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
        <View
          style={[
            styles.popupOverlay,
            {
              paddingTop: insets.top + 12,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={handleBackdropPress}
            accessibilityRole="button"
            accessibilityLabel="Close plan editor"
          />
          <View
            style={[
              styles.popupAvoid,
              { maxHeight: modalMaxHeight },
              keyboardInset > 0 ? { marginBottom: keyboardInset } : null,
            ]}
            pointerEvents="box-none"
          >
            <View style={[styles.popupCard, { maxHeight: modalMaxHeight }]}>
              <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
                <View style={styles.popupTitleRow}>
                  <Text style={styles.popupTitle}>Add a plan</Text>
                  <CloseButton onPress={handleClose} accessibilityLabel="Close" />
                </View>
              </TouchableWithoutFeedback>

              <ScrollView
                style={styles.popupScroll}
                contentContainerStyle={styles.popupScrollContent}
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="interactive"
                onScrollBeginDrag={Keyboard.dismiss}
                showsVerticalScrollIndicator={false}
                bounces={false}
                nestedScrollEnabled
              >
                <TouchableWithoutFeedback onPress={dismissKeyboard} accessible={false}>
                  <View>
                    <TextInput
                      placeholder="What's the plan?"
                      placeholderTextColor="#555"
                      style={styles.planInput}
                      value={title}
                      onFocus={dismissPickers}
                      onChangeText={setTitle}
                      maxLength={80}
                      returnKeyType="next"
                      blurOnSubmit={false}
                    />

                    <View style={styles.scheduleBlock}>
                      <TouchableWithoutFeedback onPress={collapseActivePicker} accessible={false}>
                        <View>
                          <View style={styles.quickDateRow}>
                            <DateBtn
                              label="Today"
                              selected={isToday}
                              onPress={() => {
                                Keyboard.dismiss();
                                setActivePicker(null);
                                setDate(new Date());
                              }}
                            />
                            <DateBtn
                              label="Tomorrow"
                              selected={isTomorrow}
                              onPress={() => {
                                Keyboard.dismiss();
                                setActivePicker(null);
                                setDate(new Date(Date.now() + 86400000));
                              }}
                            />
                            <DateBtn
                              label="Other"
                              selected={isCustomDate}
                              onPress={() => togglePicker("date")}
                            />
                          </View>

                          <View style={styles.dateTimeRow}>
                            <TouchableOpacity
                              style={[
                                styles.dateTimeField,
                                activePicker === "date" && styles.dateTimeFieldActive,
                              ]}
                              onPress={() => togglePicker("date")}
                              activeOpacity={0.85}
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
                              onPress={() => togglePicker("time")}
                              activeOpacity={0.85}
                            >
                              <Ionicons
                                name="time-outline"
                                size={18}
                                color={activePicker === "time" ? ACCENT : "#888"}
                              />
                              <View style={styles.dateTimeTextWrap}>
                                <Text style={styles.dateTimeValue}>{formatTime(selectedDate)}</Text>
                              </View>
                            </TouchableOpacity>
                          </View>
                        </View>
                      </TouchableWithoutFeedback>
                    </View>

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
                        onChange={setSelectedDate}
                      />
                    ) : null}

                    <View style={styles.locationFieldWrap}>
                      <TextInput
                        placeholder="Add location"
                        placeholderTextColor="#555"
                        style={styles.planInputSecondary}
                        value={location}
                        onFocus={dismissPickers}
                        onChangeText={setLocation}
                        maxLength={120}
                        returnKeyType="done"
                      />
                    </View>

                    <TouchableOpacity
                      style={[styles.popupPostBtn, !canPost && styles.popupPostBtnDisabled]}
                      disabled={!canPost}
                      onPress={handleSubmit}
                      activeOpacity={0.88}
                    >
                      {busy ? (
                        <ActivityIndicator color="#061006" size="small" />
                      ) : (
                        <Text style={styles.popupPostBtnText}>Post</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </TouchableWithoutFeedback>
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      <AlertModal
        visible={alertVisible}
        message={alertMessage}
        onClose={() => setAlertVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  popupOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.78)",
    justifyContent: "flex-start",
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
    paddingBottom: 12,
  },
  popupScroll: {
    flexGrow: 0,
    flexShrink: 1,
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
    alignSelf: "center",
    width: PRIMARY_CTA_WIDTH,
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
    marginBottom: 8,
    paddingHorizontal: 2,
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
  locationFieldWrap: {
    marginTop: 10,
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
  dateBtnText: {
    color: "white",
    fontSize: 14,
    fontFamily: fonts.medium,
  },
  dateBtnTextSelected: {
    color: ACCENT,
  },
});
