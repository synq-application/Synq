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
        // This ensures the labels don't shift when the center icon is large
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
          title: "", // Empty string to prevent text overlap
          tabBarIcon: ({ focused }) => (
            <View style={[
              styles.synqButton, 
              focused && styles.synqButtonActive
            ]}>
              <Image 
                source={require('../../assets/SYNQ-2.png')} 
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
    backgroundColor: "#081212", // Slightly off-black for depth
    borderTopWidth: 0,
    height: Platform.OS === "ios" ? 85 : 70,
    position: 'absolute', // Makes the bar float
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 25, // Rounded corners for a modern look
    paddingBottom: Platform.OS === "ios" ? 25 : 10,
    // Bar Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 5,
  },
  synqButton: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#000", // Dark base
    justifyContent: "center",
    alignItems: "center",
    position: 'absolute',
    top: -20, // Lifted higher
    borderWidth: 2,
    borderColor: ACCENT, // Border acts as the "inner" glow
    // The "All Around" Glow Effect
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 }, // 0 offset makes it glow everywhere
    shadowOpacity: 0.8,
    shadowRadius: 15,
    elevation: 15,
  },
  synqButtonActive: {
    transform: [{ scale: 1.1 }], 
    borderColor: "#FFF",
    shadowColor: "#FFF",
  },
  synqIcon: {
    width: 100,
    height: 80,
    resizeMode: 'contain',
  }
});