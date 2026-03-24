import { ACCENT } from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
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
    if (!visible) return null;

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
                                            <Ionicons name="close-circle" size={28} color="#444" />
                                        </TouchableOpacity>
                                    </View>

                                    <ScrollView contentContainerStyle={{ padding: 20 }}>
                                        {[
                                            { label: "Night Out", icon: "wine" },
                                            { label: "Dinner", icon: "restaurant" },
                                            { label: "Chill", icon: "cafe" },
                                            { label: "Outdoors", icon: "leaf" },
                                            { label: "Surprise Me", icon: "flash" },
                                        ].map((item) => (
                                            <TouchableOpacity
                                                key={item.label}
                                                style={styles.vibeCard}
                                                onPress={() => {
                                                    Keyboard.dismiss();
                                                    onSelectVibe(item.label);
                                                }}
                                            >
                                                <View style={styles.vibeIcon}>
                                                    <Ionicons name={item.icon as any} size={24} color={ACCENT} />
                                                </View>

                                                <Text style={styles.vibeText}>{item.label}</Text>

                                                <Ionicons name="chevron-forward" size={18} color="#666" />
                                            </TouchableOpacity>
                                        ))}

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
                                            <Ionicons name="close-circle" size={28} color="#444" />
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
        fontSize: 20,
        fontFamily: "Avenir-Heavy",
    },
    vibeCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#111",
        padding: 18,
        borderRadius: 20,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: "#222",
    },
    vibeIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#1C1C1E",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    vibeText: {
        flex: 1,
        color: "white",
        fontSize: 16,
        fontFamily: "Avenir-Heavy",
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
        width: 180,
        height: 180,
    },
    thinkingText: {
        color: "#999",
        marginTop: 20,
    },
});