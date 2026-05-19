import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  ACCENT,
  BG,
  BORDER,
  fonts,
  RADIUS_MD,
  SPACE_4,
  SURFACE,
  TYPE_BODY,
  TYPE_TITLE,
} from "../../constants/Variables";
import { auth } from "../../src/lib/firebase";
import { submitReport, type ReportReason } from "../../src/lib/moderation";
import AlertModal from "../alert-modal";

const REASONS: { id: ReportReason; label: string }[] = [
  { id: "harassment", label: "Harassment or bullying" },
  { id: "hate", label: "Hate or discrimination" },
  { id: "sexual", label: "Sexual or explicit content" },
  { id: "spam", label: "Spam or scam" },
  { id: "other", label: "Other safety concern" },
];

export default function SafetyReportScreen() {
  const [reportedUserId, setReportedUserId] = useState("");
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const handleSubmit = async () => {
    if (!auth.currentUser) {
      setAlertMessage("Sign in to submit a safety report.");
      setAlertVisible(true);
      return;
    }
    const uid = reportedUserId.trim();
    if (!uid || !reason) {
      setAlertMessage("Enter the user ID and select a reason.");
      setAlertVisible(true);
      return;
    }
    setSubmitting(true);
    try {
      await submitReport({
        reportedUserId: uid,
        contentType: "user",
        reason,
        details: details.trim() || undefined,
      });
      setAlertMessage("Report submitted. We aim to review within 24 hours.");
      setAlertVisible(true);
      setReportedUserId("");
      setReason(null);
      setDetails("");
    } catch {
      setAlertMessage("Could not submit report. Please try again.");
      setAlertVisible(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={22} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report a safety issue</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.lead}>
          Report objectionable content or abusive behavior. You can also report
          from a message (long-press) or a friend profile.
        </Text>

        <Text style={styles.label}>Reported user ID (optional if from profile)</Text>
        <TextInput
          style={styles.input}
          placeholder="Firebase user ID"
          placeholderTextColor="rgba(255,255,255,0.35)"
          value={reportedUserId}
          onChangeText={setReportedUserId}
          autoCapitalize="none"
        />

        {REASONS.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={[styles.reasonRow, reason === r.id && styles.reasonActive]}
            onPress={() => setReason(r.id)}
          >
            <Text style={styles.reasonText}>{r.label}</Text>
          </TouchableOpacity>
        ))}

        <TextInput
          style={[styles.input, styles.details]}
          placeholder="What happened? (optional)"
          placeholderTextColor="rgba(255,255,255,0.35)"
          value={details}
          onChangeText={setDetails}
          multiline
        />

        <TouchableOpacity
          style={[styles.submit, (submitting || !reason) && styles.submitDisabled]}
          disabled={submitting || !reason}
          onPress={handleSubmit}
        >
          <Text style={styles.submitText}>
            {submitting ? "Submitting…" : "Submit report"}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <AlertModal
        visible={alertVisible}
        message={alertMessage}
        onClose={() => {
          setAlertVisible(false);
          if (alertMessage.includes("submitted")) router.back();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACE_4,
    paddingVertical: 12,
  },
  backButton: {
    marginRight: 12,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#1F1F1F",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: TYPE_TITLE,
    fontFamily: fonts.heavy,
    color: "white",
  },
  scroll: { padding: SPACE_4, paddingBottom: 40 },
  lead: {
    color: "rgba(255,255,255,0.75)",
    fontFamily: fonts.medium,
    fontSize: TYPE_BODY,
    lineHeight: 22,
    marginBottom: 20,
  },
  label: {
    color: "rgba(255,255,255,0.55)",
    fontFamily: fonts.medium,
    fontSize: 13,
    marginBottom: 8,
  },
  input: {
    backgroundColor: SURFACE,
    borderRadius: RADIUS_MD,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    color: "white",
    fontFamily: fonts.medium,
    marginBottom: 16,
  },
  details: { minHeight: 100, textAlignVertical: "top" },
  reasonRow: {
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: SURFACE,
    borderWidth: 1,
    borderColor: BORDER,
  },
  reasonActive: { borderColor: ACCENT },
  reasonText: { color: "white", fontFamily: fonts.medium, fontSize: 15 },
  submit: {
    marginTop: 8,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: "#061006", fontFamily: fonts.heavy, fontSize: 16 },
});
