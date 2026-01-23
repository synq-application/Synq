import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const ACCENT = "#7DFFA6";
const BACKGROUND = "black";
const SURFACE = "#161616";

const fonts = {
  black: Platform.OS === "ios" ? "Avenir-Black" : "sans-serif-condensed",
  heavy: Platform.OS === "ios" ? "Avenir-Heavy" : "sans-serif-medium",
  medium: Platform.OS === "ios" ? "Avenir-Medium" : "sans-serif",
};

export default function AboutUsScreen() {
  const Section = ({
    title,
    children,
  }: {
    title: string;
    children: React.ReactNode;
  }) => (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>About</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Synq</Text>
          <Text style={styles.heroSubtitle}>
            A social tool for spontaneous moments of genuine connection with friends.
          </Text>
        </View>

        <Section title="Our mission">
          <View style={styles.copyBlock}>
            <Text style={styles.copyText}>
              Synq is built around one idea: connection over engagement.
            </Text>
            <Text style={[styles.copyText, { marginTop: 10 }]}>
              In a fast-paced world with unpredictable schedules, we’re overwhelmed by content we
              don’t care about—and no one wants to add yet another commitment to their calendar.
            </Text>
            <Text style={[styles.copyText, { marginTop: 10 }]}>
              What if technology didn’t only connect us—but helped us feel connected? Synq isn’t
              just another social app. It’s a tool for presence, spontaneity, and real-world
              connection.
            </Text>
            <Text style={[styles.copyText, { marginTop: 10 }]}>
              Synq reimagines how people come together—enabling serendipitous moments of authentic
              social fulfillment. Let’s Synq.
            </Text>
          </View>
        </Section>

        <Section title="How Synq works">
          <View style={styles.bullets}>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                Tap <Text style={styles.bold}>Synq</Text> when you’re open.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                See friends who are also open and start something simple.
              </Text>
            </View>
            <View style={styles.bulletRow}>
              <Text style={styles.bulletDot}>•</Text>
              <Text style={styles.bulletText}>
                Keep it lightweight—no pressure, no calendar commitment.
              </Text>
            </View>
          </View>
        </Section>

        <View style={styles.footerSpace} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BACKGROUND },
  header: {
    height: 72,
    backgroundColor: ACCENT,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: fonts.heavy,
    color: "black",
    marginLeft: 6,
  },

  scrollContent: { paddingBottom: 40 },

  hero: {
    margin: 20,
    backgroundColor: SURFACE,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#202020",
  },
  heroTitle: {
    fontSize: 28,
    fontFamily: fonts.black,
    color: "white",
    marginBottom: 6,
  },
  heroSubtitle: {
    fontSize: 14.5,
    fontFamily: fonts.medium,
    color: "#BDBDBD",
    lineHeight: 20,
  },

  section: { marginTop: 6 },
  sectionTitle: {
    color: "#666",
    fontSize: 14,
    fontFamily: fonts.medium,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginLeft: 25,
    marginBottom: 10,
    marginTop: 10,
  },
  card: {
    backgroundColor: SURFACE,
    marginHorizontal: 20,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#202020",
  },

  copyBlock: { padding: 18 },
  copyText: {
    color: "#EAEAEA",
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 22,
  },
  bold: { fontFamily: fonts.heavy, color: "white" },

  bullets: { padding: 18 },
  bulletRow: { flexDirection: "row", marginBottom: 10 },
  bulletDot: { color: ACCENT, marginRight: 10, fontSize: 18, lineHeight: 22 },
  bulletText: {
    color: "#EAEAEA",
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  footerSpace: { height: 24 },
});
