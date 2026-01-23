import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useMemo, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

const ACCENT = "#7DFFA6";
const BACKGROUND = "black";
const SURFACE = "#161616";

const fonts = {
  heavy: Platform.OS === "ios" ? "Avenir-Heavy" : "sans-serif-medium",
  medium: Platform.OS === "ios" ? "Avenir-Medium" : "sans-serif",
  black: Platform.OS === "ios" ? "Avenir-Black" : "sans-serif-condensed",
};

const FEEDBACK_EMAIL = "synqapp@gmail.com";

export default function FeedbackScreen() {
  const [type, setType] = useState<"Feedback" | "Bug" | "Feature Request">("Feedback");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState(""); 

  const subject = useMemo(() => `Synq ${type}`, [type]);

  const canSubmit = message.trim().length >= 10;

  const submit = async () => {
    if (!canSubmit) {
      Alert.alert("Add a bit more", "Please include at least 10 characters of feedback.");
      return;
    }

    const bodyLines = [
      `Type: ${type}`,
      email.trim() ? `Contact: ${email.trim()}` : `Contact: (not provided)`,
      "",
      "Message:",
      message.trim(),
      "",
      "—",
      `Platform: ${Platform.OS}`,
    ];

    const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(bodyLines.join("\n"))}`;

    try {
      const supported = await Linking.canOpenURL(mailto);
      if (!supported) {
        Alert.alert(
          "Email not available",
          "No email app is configured on this device."
        );
        return;
      }
      await Linking.openURL(mailto);
      Alert.alert("Thanks!", "Your email app opened with your feedback ready to send.");
      setMessage("");
      setEmail("");
      setType("Feedback");
    } catch {
      Alert.alert("Something went wrong", "We couldn’t open your email app.");
    }
  };

  const TypeChip = ({
    label,
  }: {
    label: "Feedback" | "Bug" | "Feature Request";
  }) => {
    const active = type === label;
    return (
      <TouchableOpacity
        onPress={() => setType(label)}
        activeOpacity={0.85}
        style={[styles.chip, active && styles.chipActive]}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={26} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feedback</Text>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 8 : 0}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.heroTitle}>Help us build Synq</Text>
            <Text style={styles.heroSubtitle}>
              Share feedback, report a bug, or suggest a feature. This will open your email app and
              send to <Text style={styles.bold}>synqapp@gmail.com</Text>.
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Type</Text>
            <View style={styles.chipRow}>
              <TypeChip label="Feedback" />
              <TypeChip label="Bug" />
              <TypeChip label="Feature Request" />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your email (optional)</Text>
            <View style={styles.card}>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder=""
                placeholderTextColor="#666"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Message</Text>
            <View style={styles.card}>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Tell us what you think…"
                placeholderTextColor="#666"
                multiline
                textAlignVertical="top"
                style={[styles.input, styles.textarea]}
              />
            </View>
          </View>

          <TouchableOpacity
            onPress={submit}
            activeOpacity={0.9}
            style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          >
            <Text style={styles.submitText}>Submit</Text>
            <Ionicons name="send" size={18} color="black" />
          </TouchableOpacity>

          <View style={styles.footerSpace} />
        </ScrollView>
      </KeyboardAvoidingView>
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
  bold: { fontFamily: fonts.heavy, color: "white" },

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

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginHorizontal: 20,
  },
  chip: {
    borderRadius: 999,
    paddingVertical: 9,
    paddingHorizontal: 12,
    backgroundColor: "#101010",
    borderWidth: 1,
    borderColor: "#242424",
  },
  chipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  chipText: {
    color: "#DADADA",
    fontFamily: fonts.medium,
    fontSize: 13,
  },
  chipTextActive: {
    color: "black",
    fontFamily: fonts.heavy,
  },

  card: {
    backgroundColor: SURFACE,
    marginHorizontal: 20,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#202020",
  },

  input: {
    color: "white",
    fontFamily: fonts.medium,
    fontSize: 15,
    paddingVertical: 8,
  },
  textarea: {
    minHeight: 140,
  },
  helperText: {
    marginTop: 8,
    color: "#8C8C8C",
    fontFamily: fonts.medium,
    fontSize: 12.5,
    lineHeight: 18,
  },

  submitBtn: {
    marginTop: 18,
    marginHorizontal: 20,
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitText: {
    color: "black",
    fontFamily: fonts.black,
    fontSize: 16,
  },

  footerSpace: { height: 24 },
});
