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
    backgroundColor: "#081212",
    borderTopWidth: 0,
    height: Platform.OS === "ios" ? 85 : 70,
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    borderRadius: 25,
    paddingBottom: Platform.OS === "ios" ? 25 : 10,
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
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    position: 'absolute',
    top: -20,
    borderWidth: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 15,
    borderColor: "#FFF",
    shadowColor: "#FFF",
    elevation: 15,
  },
  synqButtonActive: {
    transform: [{ scale: 1.1 }],
    borderColor: ACCENT,
    shadowColor: ACCENT,
  },
  synqIcon: {
    width: 100,
    height: 80,
    resizeMode: 'contain',
  }
});