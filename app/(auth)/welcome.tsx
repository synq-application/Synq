import { router } from "expo-router";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";

const ACCENT = "#7DFFA6";

export default function Welcome() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>SYNQ</Text>
      
      <Text style={styles.subtitle}>
        A social tool that connects you with available friends for spontaneous time together.
      </Text>

      <Pressable
        onPress={() => router.push("/(auth)/phone")}
        style={styles.button}
      >
        <Text style={styles.buttonText}>Create Account</Text>
      </Pressable>

      <View style={styles.signInContainer}>
        <Text style={styles.footerText}>Already have an account? </Text>
        <Pressable onPress={() => router.push("/(auth)/login")}>
          <Text style={styles.linkText}>Sign in here</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  title: {
    color: "white",
    fontSize: 48,
    letterSpacing: -1.5,
    // "Avenir-Black" is the heaviest weight available
    fontFamily: Platform.OS === "ios" ? "Avenir-Black" : "sans-serif-condensed",
  },
  subtitle: {
    marginTop: 12,
    fontSize: 17,
    textAlign: "center",
    color: "rgba(255,255,255,0.7)",
    lineHeight: 24,
    // "Avenir-Medium" provides good readability for body text
    fontFamily: Platform.OS === "ios" ? "Avenir-Medium" : "sans-serif",
  },
  button: {
    marginTop: 32,
    backgroundColor: ACCENT,
    paddingVertical: 16,
    width: "100%",
    borderRadius: 16,
    alignItems: "center",
  },
  buttonText: {
    fontSize: 16,
    color: "black",
    // "Avenir-Heavy" is slightly less thick than Black, perfect for buttons
    fontFamily: Platform.OS === "ios" ? "Avenir-Heavy" : "sans-serif-medium",
  },
  signInContainer: {
    flexDirection: "row",
    marginTop: 20,
  },
  footerText: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Avenir-Book" : "sans-serif",
  },
  linkText: {
    color: ACCENT,
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Avenir-Heavy" : "sans-serif-medium",
  },
});