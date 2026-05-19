import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import { Tabs } from "expo-router";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { ACCENT, SPACE_2, SPACE_3, SPACE_4, SPACE_5, TAB_BAR_BG, TYPE_CAPTION, fonts } from "../../constants/Variables";

const SYNQ_ICON = require("../../assets/SYNQ-2.png");

export default function TabsLayout() {
  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: "rgba(255,255,255,0.4)",
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: TYPE_CAPTION, marginBottom: -SPACE_2, fontFamily: fonts.medium, letterSpacing: 0.2 },
      }}
    >
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarAccessibilityLabel: "Friends",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          title: "",
          tabBarShowLabel: true,
          tabBarAccessibilityLabel: "Synq home",
          tabBarIcon: ({ focused }) => (
            <View style={[styles.synqButton, focused && styles.synqButtonActive]}>
              <ExpoImage
                source={SYNQ_ICON}
                style={styles.synqIcon}
                contentFit="contain"
                transition={0}
                cachePolicy="memory-disk"
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="me"
        options={{
          title: "Me",
          tabBarAccessibilityLabel: "Me, profile and settings",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: TAB_BAR_BG,
    borderTopColor: "rgba(0, 255, 133, 0.18)",
    borderTopWidth: StyleSheet.hairlineWidth,
    height: Platform.OS === "ios" ? 92 : 74,
    paddingBottom: Platform.OS === "ios" ? SPACE_5 : SPACE_3,
    paddingHorizontal: SPACE_4,
  },
  synqButton: {
    width: 59,
    height: 59,
    borderRadius: 29.5,
    backgroundColor: TAB_BAR_BG,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Platform.OS === "ios" ? 30 : 20,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.85)",
    shadowColor: "#FFF",
    shadowOpacity: 0.32,
    shadowRadius: 7,
    elevation: 6,
  },

  synqButtonActive: {
    transform: [{ scale: 1.05 }],
    borderColor: "rgba(0,255,133,0.85)",
    shadowColor: ACCENT,
    shadowOpacity: 0.28,
    shadowRadius: 8,
  },

  synqIcon: {
    width: 92,
    height: 74,
  },
});
