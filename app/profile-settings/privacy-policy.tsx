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
  heavy: Platform.OS === "ios" ? "Avenir-Heavy" : "sans-serif-medium",
  medium: Platform.OS === "ios" ? "Avenir-Medium" : "sans-serif",
};

export default function PrivacyPolicyScreen() {
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

  const P = ({ children }: { children: React.ReactNode }) => (
    <Text style={styles.text}>{children}</Text>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Your privacy matters</Text>
          <Text style={styles.heroSubtitle}>
            Synq is designed to help you feel connected — not tracked.
          </Text>
        </View>

        <Section title="Our philosophy">
          <P>
            Synq is built around one core principle: connection over engagement.
            We collect only what’s necessary to help you connect with friends in
            real life.
          </P>
          <P>
            We do not sell your data. We do not monetize your attention.
          </P>
        </Section>

        <Section title="Information we collect">
          <P>
            When you use Synq, you may provide information such as your name,
            contact details, profile photo, interests, and messages sent within
            the app.
          </P>
          <P>
            We also collect limited technical data like device type, app version,
            and crash information to keep Synq running smoothly.
          </P>
        </Section>

        <Section title="How we use information">
          <P>
            Your information is used to operate Synq — creating your account,
            showing availability to friends, enabling messaging, and improving
            the experience.
          </P>
          <P>
            We do not use your data for targeted advertising.
          </P>
        </Section>

        <Section title="Location">
          <P>
            Location access is optional and only used for features you choose to
            enable, such as nearby hangout suggestions.
          </P>
          <P>
            You can disable location access at any time in your device settings.
          </P>
        </Section>

        <Section title="Messages">
          <P>
            Messages are used solely to facilitate communication between you and
            your friends.
          </P>
          <P>
            We do not read private messages except when required for safety or
            legal reasons.
          </P>
        </Section>

        <Section title="Your choices">
          <P>
            You can edit or delete your profile, control permissions, and delete
            your account at any time.
          </P>
          <P>
            When you delete your account, your data is removed within a
            reasonable timeframe unless required by law.
          </P>
        </Section>

        <Section title="Contact">
          <P>
            Questions or concerns? Reach us at{" "}
            <Text style={styles.bold}>synqapp@gmail.com</Text>
          </P>
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
    fontSize: 20,
    fontFamily: fonts.heavy,
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
    padding: 18,
    borderWidth: 1,
    borderColor: "#202020",
  },

  text: {
    color: "#EAEAEA",
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 10,
  },
  bold: {
    fontFamily: fonts.heavy,
    color: "white",
  },

  footerSpace: { height: 24 },
});
