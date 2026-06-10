import { formatVenueAddressDisplay } from "@/app/helpers";
import {
    ACCENT,
    BUTTON_RADIUS,
    PRIMARY_CTA_HEIGHT,
    PRIMARY_CTA_WIDTH,
    fonts,
} from "@/constants/Variables";
import BackButton from "@/src/components/BackButton";
import CloseButton from "@/src/components/CloseButton";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
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

const CATEGORY_EMOJI: Record<string, string> = {
    Drinks: "🍸",
    Dinner: "🍽️",
    "Coffee Spots": "☕",
    Outdoors: "🌳",
    "Surprise Me": "✨",
};

type Props = {
    visible: boolean;
    onClose: () => void;
    onBack: () => void;
    onSelectVibe: (label: string) => void;
    isAILoading: boolean;
    showOptionsList: boolean;
    aiOptions: any[];
    selectedOption: any;
    setSelectedOption: (item: any | null) => void;
    sendAISuggestionToChat: () => void;
    currentCategory: string;
    errorMessage?: string | null;
};

export default function ExploreModal({
    visible,
    onClose,
    onBack,
    onSelectVibe,
    isAILoading,
    showOptionsList,
    aiOptions,
    selectedOption,
    setSelectedOption,
    sendAISuggestionToChat,
    currentCategory,
    errorMessage,
}: Props) {
    const [pressed, setPressed] = useState<string | null>(null);
    const insets = useSafeAreaInsets();
    const categoryEmoji = CATEGORY_EMOJI[currentCategory] || "✨";

    if (!visible) return null;

    const vibes = [
        {
            label: "Drinks",
            desc: "Bars, cocktails & happy hour",
            emoji: "🍸",
        },
        {
            label: "Dinner",
            desc: "Restaurants worth the trip",
            emoji: "🍽️",
        },
        {
            label: "Coffee Spots",
            desc: "Cafes, pastries & slow mornings",
            emoji: "☕",
        },
        {
            label: "Outdoors",
            desc: "Parks, trails & fresh air",
            emoji: "🌳",
        },
        {
            label: "Surprise Me",
            desc: "We'll pick something for you",
            emoji: "✨",
            special: true,
        },
    ];

    return (
        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
            <TouchableWithoutFeedback
                onPress={() => {
                    if (isAILoading) return;
                    onClose();
                }}
            >
                <View style={{ flex: 1, justifyContent: "flex-end" }}>
                    <TouchableWithoutFeedback>
                        <View style={styles.panel}>
                            {errorMessage ? (
                                <View style={styles.errorBanner}>
                                    <Ionicons name="alert-circle" size={20} color="#FF8A84" />
                                    <Text style={styles.errorBannerText}>{errorMessage}</Text>
                                    {!isAILoading && !showOptionsList ? (
                                        <Text style={styles.errorHintText}>
                                            Pick a vibe below to try again.
                                        </Text>
                                    ) : null}
                                </View>
                            ) : null}

                            {!showOptionsList ? (
                                <>
                                    <View style={styles.header}>
                                        <Text style={styles.title}>What’s the vibe?</Text>
                                        <CloseButton onPress={onClose} />
                                    </View>

                                    <Text style={styles.subtitle}>
                                        Pick the energy you’re feeling
                                    </Text>

                                    <ScrollView contentContainerStyle={{ padding: 20 }}>

                                        {vibes.map((item) => {
                                            const isPressed = pressed === item.label;
                                            const vibeDisabled = isAILoading;

                                            return (
                                                <TouchableOpacity
                                                    key={item.label}
                                                    activeOpacity={0.9}
                                                    disabled={vibeDisabled}
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
                                                        vibeDisabled && styles.vibeCardDisabled,
                                                    ]}
                                                >
                                                    <Text style={styles.vibeEmoji}>{item.emoji}</Text>

                                                    <View style={styles.vibeTextWrap}>
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

                                    </ScrollView>
                                </>
                            ) : (
                                <View style={styles.optionsView}>
                                    <View style={styles.header}>
                                        <BackButton onPress={onBack} style={styles.backButton} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.title} numberOfLines={1}>
                                                {currentCategory}
                                            </Text>
                                        </View>
                                        <CloseButton onPress={onClose} />
                                    </View>

                                    {aiOptions.length === 0 ? (
                                        <View style={styles.emptyOptions}>
                                            <Text style={styles.emptyOptionsText}>
                                                No spots found for this vibe. Try another.
                                            </Text>
                                        </View>
                                    ) : (
                                        <FlatList
                                            style={styles.optionsList}
                                            data={aiOptions}
                                            keyExtractor={(item, index) =>
                                                `${item.name}-${item.address || item.location || index}`
                                            }
                                            contentContainerStyle={{ padding: 20, paddingBottom: 8 }}
                                            renderItem={({ item }) => {
                                                const isSelected =
                                                    selectedOption?.name === item.name;

                                                return (
                                                    <TouchableOpacity
                                                        style={[
                                                            styles.venueCard,
                                                            isSelected && styles.selectedCard,
                                                        ]}
                                                        onPress={() =>
                                                            setSelectedOption(
                                                                isSelected ? null : item
                                                            )
                                                        }
                                                    >
                                                        <Text style={styles.vibeEmoji}>
                                                            {categoryEmoji}
                                                        </Text>

                                                        <View style={styles.vibeTextWrap}>
                                                            <Text style={styles.venueName}>
                                                                {item.name}
                                                            </Text>
                                                            <Text
                                                                style={styles.venueDesc}
                                                                numberOfLines={2}
                                                            >
                                                                {formatVenueAddressDisplay(
                                                                    item.address || item.location || ""
                                                                )}
                                                            </Text>
                                                        </View>

                                                        {isSelected ? (
                                                            <Ionicons
                                                                name="checkmark-circle"
                                                                size={24}
                                                                color={ACCENT}
                                                            />
                                                        ) : null}
                                                    </TouchableOpacity>
                                                );
                                            }}
                                        />
                                    )}

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
    errorBanner: {
        marginHorizontal: 20,
        marginTop: 16,
        marginBottom: 4,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: "rgba(255,69,58,0.12)",
        borderWidth: 1,
        borderColor: "rgba(255,69,58,0.35)",
        alignItems: "center",
        gap: 8,
    },
    errorBannerText: {
        color: "#FF8A84",
        fontSize: 14,
        fontFamily: fonts.medium,
        lineHeight: 20,
        textAlign: "center",
    },
    errorHintText: {
        color: "rgba(255,138,132,0.75)",
        fontSize: 13,
        fontFamily: fonts.medium,
        textAlign: "center",
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
    backButton: { marginRight: 12 },
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

    vibeCardDisabled: {
        opacity: 0.45,
    },

    specialCard: {
        borderColor: "#2A2A2A",
    },

    vibeEmoji: {
        fontSize: 28,
        marginRight: 14,
    },

    vibeTextWrap: {
        flex: 1,
        marginRight: 8,
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
        padding: 18,
        borderRadius: 20,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "#1A1A1A",
    },
    selectedCard: {
        borderColor: ACCENT,
    },
    venueName: {
        color: "white",
        fontSize: 18,
        fontFamily: "Avenir-Heavy",
    },
    venueDesc: {
        color: "#777",
        fontSize: 13,
        marginTop: 4,
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

    emptyOptions: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 32,
    },
    emptyOptionsText: {
        color: "#888",
        fontSize: 15,
        fontFamily: fonts.medium,
        textAlign: "center",
        lineHeight: 22,
    },
});
