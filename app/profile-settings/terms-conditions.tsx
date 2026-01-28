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

export default function TermsScreen() {
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

  const Bullet = ({ children }: { children: React.ReactNode }) => (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletDot}>•</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Terms & Conditions</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>Synq Terms</Text>
          <Text style={styles.heroSubtitle}>
            Last updated: January 2026
          </Text>
        </View>

        <Section title="1. Agreement">
          <P>
            These Terms & Conditions govern your use of Synq.
            By accessing or using Synq, you agree to these Terms.
          </P>
        </Section>

        <Section title="2. Eligibility">
          <P>
            You must be at least 13 years old to use Synq. If you are under the age
            required in your country to consent to online services, you may use Synq
            only with a parent or guardian’s consent.
          </P>
        </Section>

        <Section title="3. Your account">
          <P>
            You are responsible for maintaining the confidentiality of your account and
            for all activity that occurs under it. You agree to provide accurate
            information and keep it up to date.
          </P>
          <P>
            We may suspend or terminate accounts that violate these Terms or that we
            reasonably believe create risk or harm to Synq or other users.
          </P>
        </Section>

        <Section title="4. How Synq works">
          <P>
            Synq helps you coordinate real-life plans by showing availability and enabling
            messaging. Availability and certain features may be optional, and you control
            what you share through in-app settings.
          </P>
        </Section>

        <Section title="5. Community expectations">
          <P>Use Synq respectfully. You agree not to:</P>
          <View style={styles.bullets}>
            <Bullet>Harass, bully, threaten, or impersonate others.</Bullet>
            <Bullet>Share unlawful, hateful, or sexually explicit content.</Bullet>
            <Bullet>Use Synq to spam, scam, or solicit others.</Bullet>
            <Bullet>Attempt to access accounts, data, or systems you do not own.</Bullet>
            <Bullet>Reverse engineer, disrupt, or interfere with the App.</Bullet>
          </View>
        </Section>

        <Section title="6. User content">
          <P>
            You own the content you post or send (like messages, photos, and profile info).
            You grant Synq a limited license to host, store, and display that content only
            as needed to operate the App.
          </P>
          <P>
            You are responsible for your content and for ensuring you have the rights to
            share it.
          </P>
        </Section>

        <Section title="7. Privacy">
          <P>
            Your privacy matters. Our Privacy Policy explains what data we collect and how
            it’s used. By using Synq, you agree to our Privacy Policy.
          </P>
        </Section>

        <Section title="8. Safety & real-world meetups">
          <P>
            Synq is not responsible for offline interactions. Use good judgment when meeting
            people in person.
          </P>
          <View style={styles.bullets}>
            <Bullet>Meet in public places and tell a friend your plans.</Bullet>
            <Bullet>Trust your instincts and leave if you feel unsafe.</Bullet>
          </View>
        </Section>

        <Section title="9. Termination">
          <P>
            You may stop using Synq at any time. We may suspend or terminate your access if
            you violate these Terms, if required by law, or to protect users and the platform.
          </P>
        </Section>

        <Section title="10. Disclaimers">
          <P>
            Synq is provided “as is” without warranties of any kind. We do not guarantee the
            App will be uninterrupted, secure, or error-free.
          </P>
        </Section>

        <Section title="11. Limitation of liability">
          <P>
            To the fullest extent permitted by law, Synq will not be liable for indirect,
            incidental, special, consequential, or punitive damages, or any loss of data,
            profits, or goodwill arising from your use of the App.
          </P>
        </Section>

        <Section title="12. Changes to these terms">
          <P>
            We may update these Terms from time to time. If we make material changes, we’ll
            update the “Last updated” date and may provide additional notice in the App.
          </P>
        </Section>

        <Section title="13. Contact">
          <P>
            Questions about these Terms? Email{" "}
            <Text style={styles.bold}>synqapp@gmail.com</Text>.
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
  bold: { fontFamily: fonts.heavy, color: "white" },

  bullets: { marginTop: 6 },
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
