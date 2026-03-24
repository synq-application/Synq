import { ACCENT } from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    Keyboard,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";

type Props = {
    visible: boolean;
    onClose: () => void;
    onBack: () => void;
    onSelectVibe: (label: string) => void;
    isThinking: boolean;
    isAILoading: boolean;
    showOptionsList: boolean;
    aiOptions: any[];
    selectedOption: any;
    setSelectedOption: (item: any) => void;
    sendAISuggestionToChat: () => void;
    currentCategory: string;
};

export default function ExploreModal({
    visible,
    onClose,
    onBack,
    onSelectVibe,
    isThinking,
    isAILoading,
    showOptionsList,
    aiOptions,
    selectedOption,
    setSelectedOption,
    sendAISuggestionToChat,
    currentCategory,
}: Props) {
    const [pressed, setPressed] = useState<string | null>(null);

    if (!visible) return null;

    const vibes = [
        {
            label: "Night Out",
            desc: "Drinks, dancing, late nights",
        },
        {
            label: "Dinner",
            desc: "Good food & conversation",
        },
        {
            label: "Chill",
            desc: "Low-key and relaxing",
        },
        {
            label: "Outdoors",
            desc: "Fresh air & open space",
        },
        {
            label: "Surprise Me",
            desc: "We’ll pick something for you",
            special: true,
        },
    ];

    return (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
            {isThinking && ( 
                <View style={styles.thinkingOverlay}>
                    <Image
                        source={require("../assets/pulse.gif")}
                        style={styles.thinkingOrb}
                    />
                    <Text style={styles.thinkingText}>Finding the move...</Text>
                </View>
            )}

            <TouchableWithoutFeedback onPress={onClose}>
                <View style={{ flex: 1, justifyContent: "flex-end" }}>
                    <TouchableWithoutFeedback>
                        <View style={styles.panel}>

                            {!showOptionsList ? (
                                <>
                                    <View style={styles.header}>
                                        <Text style={styles.title}>What’s the vibe?</Text>
                                        <TouchableOpacity onPress={onClose}>
                                            <Ionicons name="close" size={26} color="#666" />
                                        </TouchableOpacity>
                                    </View>

                                    <Text style={styles.subtitle}>
                                        Pick the energy you’re feeling
                                    </Text>

                                    <ScrollView contentContainerStyle={{ padding: 20 }}>

                                        {vibes.map((item) => {
                                            const isPressed = pressed === item.label;

                                            return (
                                                <TouchableOpacity
                                                    key={item.label}
                                                    activeOpacity={0.9}
                                                    onPressIn={() => setPressed(item.label)}
                                                    onPressOut={() => setPressed(null)}
                                                    onPress={() => {
                                                        Keyboard.dismiss();
                                                        onSelectVibe(item.label);
                                                    }}
                                                    style={[
                                                        styles.vibeCard,
                                                        isPressed && styles.vibeCardPressed,
                                                        item.special && styles.specialCard,
                                                    ]}
                                                >
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.vibeTitle}>
                                                            {item.label}
                                                        </Text>
                                                        <Text style={styles.vibeDesc}>
                                                            {item.desc}
                                                        </Text>
                                                    </View>

                                                    <Ionicons
                                                        name="chevron-forward"
                                                        size={18}
                                                        color="#555"
                                                    />
                                                </TouchableOpacity>
                                            );
                                        })}

                                        {isAILoading && (
                                            <View style={{ marginTop: 30, alignItems: "center" }}>
                                                <ActivityIndicator color={ACCENT} />
                                                <Text style={{ color: "#888", marginTop: 10 }}>
                                                    Finding something good...
                                                </Text>
                                            </View>
                                        )}
                                    </ScrollView>
                                </>
                            ) : (
                                <>
                                    <View style={styles.header}>
                                        <TouchableOpacity onPress={onBack} style={{ flexDirection: "row", alignItems: "center" }}>
                                            <Ionicons name="chevron-back" size={24} color={ACCENT} />
                                            <Text style={[styles.title, { marginLeft: 6 }]}>
                                                {currentCategory}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity onPress={onClose}>
                                            <Ionicons name="close" size={26} color="#666" />
                                        </TouchableOpacity>
                                    </View>

                                    <FlatList
                                        data={aiOptions}
                                        keyExtractor={(item) => item.name}
                                        contentContainerStyle={{ padding: 20 }}
                                        renderItem={({ item }) => (
                                            <TouchableOpacity
                                                style={[
                                                    styles.venueCard,
                                                    selectedOption?.name === item.name && styles.selectedCard,
                                                ]}
                                                onPress={() => setSelectedOption(item)}
                                            >
                                                <Image source={{ uri: item.imageUrl }} style={styles.venueImage} />

                                                <View style={{ flex: 1, marginLeft: 12 }}>
                                                    <Text style={styles.venueName}>{item.name}</Text>
                                                    <Text style={styles.venueDesc}>{item.location}</Text>
                                                </View>

                                                {selectedOption?.name === item.name && (
                                                    <Ionicons name="checkmark-circle" size={24} color={ACCENT} />
                                                )}
                                            </TouchableOpacity>
                                        )}
                                    />

                                    <TouchableOpacity
                                        style={selectedOption ? styles.sendBtnEnabled : styles.sendBtn}
                                        disabled={!selectedOption}
                                        onPress={sendAISuggestionToChat}
                                    >
                                        <Text style={styles.sendText}>Send Idea</Text>
                                    </TouchableOpacity>
                                </>
                            )}
                        </View>
                    </TouchableWithoutFeedback>
                </View>
            </TouchableWithoutFeedback>
        </View>
    );
}

const styles = StyleSheet.create({
    overlay: {
        backgroundColor: "rgba(0,0,0,0.85)",
        zIndex: 1000,
    },
    panel: {
        height: "85%",
        backgroundColor: "#0A0A0A",
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        padding: 20,
        alignItems: "center",
    },
    title: {
        color: "white",
        fontSize: 22,
        fontFamily: "Avenir-Heavy",
    },
    subtitle: {
        color: "#777",
        fontSize: 14,
        marginHorizontal: 20,
        marginTop: -10,
        marginBottom: 10,
    },

    vibeCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#111",
        padding: 18,
        borderRadius: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#1A1A1A",
    },

    vibeCardPressed: {
        transform: [{ scale: 0.97 }],
        borderColor: ACCENT,
    },

    specialCard: {
        borderColor: "#2A2A2A",
    },

    vibeTitle: {
        color: "white",
        fontSize: 18,
        fontFamily: "Avenir-Heavy",
    },

    vibeDesc: {
        color: "#777",
        fontSize: 13,
        marginTop: 4,
    },

    venueCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#111",
        padding: 12,
        borderRadius: 18,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#222",
    },
    selectedCard: {
        borderColor: ACCENT,
    },
    venueImage: {
        width: 80,
        height: 80,
        borderRadius: 12,
    },
    venueName: {
        color: "white",
        fontSize: 16,
    },
    venueDesc: {
        color: "#888",
        fontSize: 13,
    },

    sendBtn: {
        backgroundColor: "#555",
        margin: 20,
        padding: 16,
        borderRadius: 12,
        alignItems: "center",
    },
    sendBtnEnabled: {
        backgroundColor: ACCENT,
        margin: 20,
        padding: 16,
        borderRadius: 12,
        alignItems: "center",
    },
    sendText: {
        color: "black",
        fontWeight: "bold",
    },

    thinkingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.92)",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 2000,
    },
    thinkingOrb: {
        width: 280,
        height: 280,
    },
    thinkingText: {
        color: "#999",
        marginTop: 20,
        fontSize: 26
    },
});