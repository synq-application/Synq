import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import {
    Keyboard,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";

type MonthlyMemoProps = {
    ACCENT: string;
    fonts: {
        heavy: string;
        medium: string;
        black: string;
    };

    showEventModal: boolean;
    setShowEventModal: (val: boolean) => void;

    newEvent: {
        title: string;
        date: string;
        time: string;
        location: string;
    };

    setNewEvent: React.Dispatch<
        React.SetStateAction<{
            title: string;
            date: string;
            time: string;
            location: string;
        }>
    >;

    saveEvent: () => void;

    selectedDate: Date;
    setSelectedDate: (date: Date) => void;

    events: {
        date: string;
        day: number;
        title: string;
    }[];
};

export default function MonthlyMemo({
    ACCENT,
    fonts,
    showEventModal,
    setShowEventModal,
    newEvent,
    setNewEvent,
    saveEvent,
    selectedDate,
    setSelectedDate,
    events,
}: MonthlyMemoProps) {
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [tempDate, setTempDate] = useState(new Date());
    const [tempTime, setTempTime] = useState(new Date());

    const formatDate = (date: Date) =>
        date.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
        });

    const formatTime = (date: Date) =>
        date.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
        });

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

    return (
        <View style={styles.section}>
            {/* HEADER */}
            <View style={styles.rowBetween}>
                <Text style={[styles.sectionTitle, { fontFamily: fonts.heavy }]}>
                    Monthly memo
                </Text>
                <TouchableOpacity onPress={() => setShowEventModal(true)}>
                    <Ionicons name="create-outline" size={22} color="white" />
                </TouchableOpacity>
            </View>

            {/* CALENDAR */}
            <View style={styles.calendarWrapper}>
                <View style={styles.calendarContainer}>
                    <View style={styles.monthHeader}>
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
                            <Ionicons name="chevron-back" size={18} color="#888" />
                        </TouchableOpacity>

                        <Text style={styles.monthLabel}>
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
                            <Ionicons name="chevron-forward" size={18} color="#888" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.weekRow}>
                        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                            <Text key={i} style={styles.weekDay}>
                                {d}
                            </Text>
                        ))}
                    </View>

                    <View style={styles.calendarGrid}>
                        {calendarDays.map((day, i) => {
                            if (!day) return <View key={i} style={styles.calendarDay} />;

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
                                        styles.calendarDay,
                                        isSelected && styles.selectedDay,
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.calendarDayText,
                                            isSelected && styles.selectedDayText,
                                        ]}
                                    >
                                        {day}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    {/* EVENTS */}
                    <View style={{ marginTop: 16 }}>
                        {events.length === 0 ? (
                            <Text style={styles.emptyText}>No plans this month</Text>
                        ) : (
                            events.map((event, i) => (
                                <View key={i} style={styles.eventCard}>
                                    <View style={styles.eventDateBlock}>
                                        <Text style={styles.eventDaySmall}>
                                            {new Date(
                                                selectedDate.getFullYear(),
                                                selectedDate.getMonth(),
                                                event.day
                                            ).toLocaleDateString("en-US", {
                                                weekday: "short",
                                            })}
                                        </Text>
                                        <Text style={styles.eventDayBig}>{event.day}</Text>
                                    </View>

                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.eventTitle}>
                                            {event.title}
                                        </Text>
                                    </View>

                                    <Ionicons
                                        name="chevron-forward"
                                        size={16}
                                        color="#666"
                                    />
                                </View>
                            ))
                        )}

                        <TouchableOpacity
                            style={[styles.addEventBtn, { borderColor: ACCENT }]}
                            onPress={() => setShowEventModal(true)}
                        >
                            <Ionicons name="add" size={16} color={ACCENT} />
                            <Text
                                style={[
                                    styles.addEventText,
                                    { color: ACCENT, fontFamily: fonts.heavy },
                                ]}
                            >
                                Add an event
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
            {/* MODAL */}
            <Modal visible={showEventModal} transparent animationType="fade">
                <View style={styles.modalOverlay}>

                    {/* 👇 TAP OUTSIDE TO DISMISS */}
                    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                        <View style={StyleSheet.absoluteFillObject} />
                    </TouchableWithoutFeedback>

                    <View style={styles.modalContainer}>
                        <Text style={[styles.modalTitle, { fontFamily: fonts.black }]}>
                            Add an event
                        </Text>

                        <View style={styles.field}>
                            <Text style={styles.label}>TITLE</Text>
                            <TextInput
                                style={styles.input}
                                value={newEvent.title}
                                onChangeText={(text) =>
                                    setNewEvent((p) => ({ ...p, title: text }))
                                }
                                placeholder="Meet up"
                                placeholderTextColor="#555"
                                returnKeyType="done"
                                onSubmitEditing={Keyboard.dismiss}
                            />
                        </View>

                        <TouchableOpacity
                            style={styles.field}
                            onPress={() => {
                                Keyboard.dismiss();
                                setShowDatePicker(true);
                                setShowTimePicker(false);
                            }}
                        >
                            <Text style={styles.label}>DATE</Text>
                            <Text style={styles.value}>
                                {newEvent.date || "Select date"}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.field}
                            onPress={() => {
                                Keyboard.dismiss();
                                setShowTimePicker(true);
                                setShowDatePicker(false);
                            }}
                        >
                            <Text style={styles.label}>TIME</Text>
                            <Text style={styles.value}>
                                {newEvent.time || "Add time"}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.actions}>
                            <TouchableOpacity onPress={() => setShowEventModal(false)}>
                                <Text style={{ color: "#888" }}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.createBtn}
                                onPress={() => {
                                    Keyboard.dismiss();
                                    saveEvent();
                                }}
                            >
                                <Text style={{ color: "black", fontWeight: "bold" }}>
                                    Create
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* 🔥 DATE PICKER */}
                        {showDatePicker && (
                            <View style={styles.pickerContainer}>
                                <DateTimePicker
                                    value={tempDate}
                                    mode="date"
                                    display="spinner"
                                    onChange={(e, d) => {
                                        if (d) {
                                            setTempDate(d);
                                            setNewEvent((p) => ({
                                                ...p,
                                                date: formatDate(d),
                                            }));
                                        }
                                        // ❌ DO NOT CLOSE (iOS scrolling)
                                    }}
                                />
                            </View>
                        )}

                        {/* 🔥 TIME PICKER */}
                        {showTimePicker && (
                            <View style={styles.pickerContainer}>
                                <DateTimePicker
                                    value={tempTime}
                                    mode="time"
                                    display="spinner"
                                    onChange={(e, t) => {
                                        if (t) {
                                            setTempTime(t);
                                            setNewEvent((p) => ({
                                                ...p,
                                                time: formatTime(t),
                                            }));
                                        }
                                        // ❌ DO NOT CLOSE
                                    }}
                                />
                            </View>
                        )}
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    section: { marginTop: 30 },

    rowBetween: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    pickerContainer: {
        marginTop: 15,
        backgroundColor: "white",
        borderRadius: 16,
        padding: 10,
    },

    sectionTitle: {
        color: "white",
        fontSize: 20,
    },

    calendarWrapper: {
        alignItems: "center",
    },

    calendarContainer: {
        width: "92%",
        backgroundColor: "#111",
        borderRadius: 24,
        padding: 16,
        borderWidth: 1,
        borderColor: "#222",
    },

    monthHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 10,
    },

    monthLabel: {
        color: "white",
        fontSize: 14,
    },

    weekRow: {
        flexDirection: "row",
        marginBottom: 6,
    },

    weekDay: {
        width: "14.28%",
        textAlign: "center",
        color: "#444",
        fontSize: 12,
    },

    calendarGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
    },

    calendarDay: {
        width: "14.28%",
        height: 32,
        justifyContent: "center",
        alignItems: "center",
    },

    calendarDayText: {
        color: "#666",
        fontSize: 14,
    },

    selectedDay: {
        borderWidth: 1,
        borderColor: "#7DFFA6",
        borderRadius: 8,
    },

    selectedDayText: {
        color: "#7DFFA6",
        fontWeight: "600",
    },

    eventCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#0a0a0a",
        borderRadius: 16,
        padding: 12,
        marginBottom: 10,
    },

    eventDateBlock: {
        width: 50,
        alignItems: "center",
        marginRight: 10,
    },

    eventDaySmall: {
        color: "#666",
        fontSize: 11,
    },

    eventDayBig: {
        color: "white",
        fontSize: 18,
        fontWeight: "600",
    },

    eventTitle: {
        color: "white",
        fontSize: 14,
    },

    emptyText: {
        color: "#555",
        textAlign: "center",
    },

    addEventBtn: {
        flexDirection: "row",
        justifyContent: "center",
        padding: 12,
        borderWidth: 1,
        borderStyle: "dashed",
        borderRadius: 12,
        marginTop: 10,
    },

    addEventText: {
        marginLeft: 6,
    },

    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.9)",
        justifyContent: "center",
        alignItems: "center",
    },

    modalContainer: {
        width: "90%",
        backgroundColor: "#0a0a0a",
        borderRadius: 20,
        padding: 20,
    },

    modalTitle: {
        color: "white",
        fontSize: 20,
        marginBottom: 20,
    },

    field: {
        backgroundColor: "#111",
        padding: 12,
        borderRadius: 12,
        marginBottom: 10,
    },
    label: {
        color: "#555",
        fontSize: 11,
    },
    input: {
        color: "white",
    },
    value: {
        color: "white",
    },
    actions: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 15,
    },
    createBtn: {
        backgroundColor: "#7DFFA6",
        padding: 12,
        borderRadius: 10,
    },
});