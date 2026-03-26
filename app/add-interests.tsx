import { useRouter } from "expo-router";
import { doc, setDoc } from "firebase/firestore";
import React, { useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { ACCENT, BG, BUTTON_RADIUS } from "../constants/Variables";
import { auth, db } from "../src/lib/firebase";
import AlertModal from "./alert-modal";
import { useAuthRefresh } from "./_layout";

const INTERESTS = [
    "🍽️ Going out to eat",
    "☕ Coffee",
    "🍹 Drinks",
    "🚶 Walk",
    "🏋️ Gym",
    "🧘 Pilates / Yoga",
    "🎾 Pickleball",
    "🏀 Basketball",
    "⚽ Soccer",
    "🎳 Bowling",
    "🎮 Games",
    "🎤 Karaoke",
    "🎶 Live music",
    "🖼️ Museums",
    "🎬 Movies",
    "🏈 Sports bars",
    "🌲 Hiking",
    "🛍️ Shopping",
    "🧑‍🍳 Cooking",
    "🐶 Dog park",
    "🎨 Art",
    "📚 Reading",
];

export default function InterestsOnboarding() {
    const router = useRouter();
    const { refreshAuth } = useAuthRefresh();

    const [selected, setSelected] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [alertVisible, setAlertVisible] = useState(false);
    const [alertMessage, setAlertMessage] = useState("");

    const canContinue = selected.length > 0 && !loading;

    const toggle = (label: string) => {
        setSelected((prev) =>
            prev.includes(label)
                ? prev.filter((x) => x !== label)
                : [...prev, label]
        );
    };

    const saveInterests = async () => {
        if (!auth.currentUser) return;

        try {
            setLoading(true);

            await setDoc(
                doc(db, "users", auth.currentUser.uid),
                {
                    interests: selected,
                },
                { merge: true }
            );

            refreshAuth();
            router.replace("/(tabs)/friends");
        } catch (e: any) {
            console.error(e);
            setAlertMessage("Could not save interests.");
            setAlertVisible(true);
            setLoading(false);
        }
    };

    const handleSkip = () => {
        refreshAuth();
        router.replace("/(tabs)/friends");
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Add your interests</Text>
            <Text style={styles.subtitle}>
                This helps Synq suggest plans and helps friends find common ground.
            </Text>

            <View style={styles.pillsSection}>
                <ScrollView
                    style={styles.pillsScroll}
                    contentContainerStyle={styles.pillsWrap}
                    showsVerticalScrollIndicator={false}
                >
                    {INTERESTS.map((label) => {
                        const isOn = selected.includes(label);
                        return (
                            <TouchableOpacity
                                key={label}
                                onPress={() => toggle(label)}
                                activeOpacity={0.85}
                                style={[styles.pill, isOn && styles.pillOn]}
                            >
                                <Text style={[styles.pillText, isOn && styles.pillTextOn]}>
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            <TouchableOpacity
                disabled={!canContinue}
                onPress={saveInterests}
                style={[styles.button, !canContinue && { opacity: 0.5 }]}
            >
                {loading ? (
                    <ActivityIndicator color="black" />
                ) : (
                    <Text style={styles.buttonText}>
                        Continue{selected.length ? ` (${selected.length})` : ""}
                    </Text>
                )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSkip} style={styles.skipButton}>
                <Text style={styles.skipText}>Skip for now</Text>
            </TouchableOpacity>
            <AlertModal
                visible={alertVisible}
                title="Error"
                message={alertMessage}
                onClose={() => setAlertVisible(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG,
        padding: 24,
        justifyContent: "center",
    },
    title: { color: "white", fontSize: 28, fontWeight: "800" },
    subtitle: {
        color: "rgba(255,255,255,0.7)",
        fontSize: 16,
        marginTop: 8,
    },
    pillsSection: {
        marginTop: 28,
        marginBottom: 8,
    },
    pillsScroll: {
        maxHeight: 380,
    },
    pillsWrap: {
        flexDirection: "row",
        flexWrap: "wrap",
        paddingBottom: 6,
    },
    pill: {
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 999,
        marginRight: 10,
        marginBottom: 10,
        backgroundColor: "rgba(255,255,255,0.08)",
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.15)",
    },
    pillOn: {
        backgroundColor: "rgba(125,255,166,0.18)",
        borderColor: "rgba(125,255,166,0.6)",
    },
    pillText: {
        color: "rgba(255,255,255,0.85)",
        fontSize: 14,
        fontWeight: "700",
    },
    pillTextOn: { color: "white" },

    button: {
        marginTop: 20,
        backgroundColor: ACCENT,
        height: 52,
        borderRadius: BUTTON_RADIUS,
        alignItems: "center",
        justifyContent: "center",
    },
    buttonText: { color: "black", fontSize: 16, fontWeight: "800" },
    skipButton: { marginTop: 20, alignSelf: "center" },
    skipText: {
        color: "rgba(255,255,255,0.5)",
        fontSize: 14,
        fontWeight: "600",
    },
});
