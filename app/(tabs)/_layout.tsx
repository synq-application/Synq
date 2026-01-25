import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Image, Platform, StyleSheet, View } from "react-native";

const ACCENT = "#7DFFA6";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: ACCENT,
        tabBarInactiveTintColor: "rgba(255,255,255,0.4)",
        tabBarShowLabel: true,
        tabBarLabelStyle: { fontSize: 12, marginBottom: -5 },
      }}
    >
      <Tabs.Screen
        name="friends"
        options={{
          title: "Friends",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="people-outline" size={size} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="index"
        options={{
          title: "",
          tabBarShowLabel: false,
          tabBarIcon: ({ focused }) => (
            <View style={[styles.synqButton, focused && styles.synqButtonActive]}>
              <Image
                source={require("../../assets/SYNQ-2.png")}
                style={styles.synqIcon}
              />
            </View>
          ),
        }}
      />

      <Tabs.Screen
        name="me"
        options={{
          title: "Me",
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
    backgroundColor: "#081212",
    borderTopColor: "rgba(255,255,255,0.1)",
    borderTopWidth: StyleSheet.hairlineWidth,
    height: Platform.OS === "ios" ? 90 : 70,
    paddingBottom: Platform.OS === "ios" ? 25 : 10,
  },
  synqButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Platform.OS === "ios" ? 30 : 20,
    borderWidth: 2,
    borderColor: "#FFF",
    shadowColor: "#FFF",
    shadowOpacity: 0.6,
    shadowRadius: 12,
    elevation: 10,
  },

  synqButtonActive: {
    transform: [{ scale: 1.1 }],
    borderColor: ACCENT,
    shadowColor: ACCENT,
  },

  synqIcon: {
    width: 100,
    height: 80,
    resizeMode: "contain",
  },
});
