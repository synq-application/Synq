import {
    ACCENT,
    BUTTON_RADIUS,
    PRIMARY_CTA_HEIGHT,
    PRIMARY_CTA_WIDTH,
    fonts,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React, { useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Keyboard,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

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
    setSelectedOption: (item: any | null) => void;
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
    const insets = useSafeAreaInsets();

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
                    <ExpoImage
                        source={require("../assets/pulse.gif")}
                        style={styles.thinkingOrb}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        transition={0}
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
                                <View style={styles.optionsView}>
                                    <View style={styles.header}>
                                        <TouchableOpacity onPress={onBack} style={styles.backButton}>
                                            <Ionicons name="chevron-back" size={22} color="#888" />
                                        </TouchableOpacity>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.title} numberOfLines={1}>
                                                {currentCategory}
                                            </Text>
                                        </View>
                                        <TouchableOpacity onPress={onClose}>
                                            <Ionicons name="close" size={26} color="#666" />
                                        </TouchableOpacity>
                                    </View>

                                    <FlatList
                                        style={styles.optionsList}
                                        data={aiOptions}
                                        keyExtractor={(item) => item.name}
                                        contentContainerStyle={{ padding: 20, paddingBottom: 8 }}
                                        renderItem={({ item }) => (
                                            <TouchableOpacity
                                                style={[
                                                    styles.venueCard,
                                                    selectedOption?.name === item.name && styles.selectedCard,
                                                ]}
                                                onPress={() =>
                                                    setSelectedOption(
                                                        selectedOption?.name === item.name ? null : item
                                                    )
                                                }
                                            >
                                                <ExpoImage
                                                    source={{ uri: item.imageUrl }}
                                                    style={styles.venueImage}
                                                    contentFit="cover"
                                                    cachePolicy="memory-disk"
                                                    transition={0}
                                                    recyclingKey={item.imageUrl}
                                                />

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

                                    <View style={[styles.sendFooter, { paddingBottom: Math.max(insets.bottom, 16) + 4 }]}>
                                        <TouchableOpacity
                                            style={[styles.sendBtn, !selectedOption && { opacity: 0.5 }]}
                                            disabled={!selectedOption}
                                            onPress={sendAISuggestionToChat}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={styles.sendText}>Send idea</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
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
    optionsView: {
        flex: 1,
    },
    optionsList: {
        flex: 1,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        padding: 20,
        alignItems: "center",
    },
    backButton: {
        marginRight: 12,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#1F1F1F",
        alignItems: "center",
        justifyContent: "center",
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

    sendFooter: {
        paddingHorizontal: 20,
        paddingTop: 6,
    },
    sendBtn: {
        alignSelf: "center",
        width: PRIMARY_CTA_WIDTH,
        height: PRIMARY_CTA_HEIGHT,
        backgroundColor: ACCENT,
        borderRadius: BUTTON_RADIUS,
        alignItems: "center",
        justifyContent: "center",
    },
    sendText: {
        fontSize: 16,
        color: "black",
        fontFamily: fonts.medium,
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