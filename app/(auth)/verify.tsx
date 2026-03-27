import { router, useLocalSearchParams } from "expo-router";
import { PhoneAuthProvider, signInWithCredential } from "firebase/auth";
import { useMemo, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from "react-native";

import { BG, BUTTON_RADIUS } from "@/constants/Variables";
import AlertModal from "../alert-modal";
import { auth } from "../../src/lib/firebase";

export default function Verify() {
  const { verificationId, phone } = useLocalSearchParams<{ verificationId?: string; phone?: string }>();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");

  const canVerify = useMemo(() => (verificationId && code.replace(/\D/g, "").length >= 6 && !loading), [verificationId, code, loading]);

  const verify = async () => {
    if (!verificationId) return;

    try {
      setLoading(true);
      const credential = PhoneAuthProvider.credential(verificationId, code);
      await signInWithCredential(auth, credential);

      // ✅ signed in
      router.replace("/(tabs)");
    } catch (err: any) {
      if (__DEV__) {
        console.error("verify error", err);
      }
      setAlertMessage(err?.message ?? "Please try again.");
      setAlertVisible(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.inner}>
          <Text style={styles.title}>Enter code</Text>
          <Text style={styles.subtitle}>Sent to {phone ?? "your phone"}.</Text>

          <TextInput
            value={code}
            onChangeText={setCode}
            placeholder="123456"
            placeholderTextColor="rgba(255,255,255,0.4)"
            keyboardType="number-pad"
            style={styles.input}
            maxLength={6}
          />

          <Pressable disabled={!canVerify} onPress={verify} style={[styles.button, !canVerify && styles.buttonDisabled]}>
            <Text style={styles.buttonText}>{loading ? "Verifying..." : "Verify"}</Text>
          </Pressable>

          <Pressable onPress={() => router.back()} style={{ marginTop: 14 }}>
            <Text style={styles.back}>Back</Text>
          </Pressable>
        </View>
        <AlertModal
          visible={alertVisible}
          title="Invalid code"
          message={alertMessage}
          onClose={() => setAlertVisible(false)}
        />
      </KeyboardAvoidingView>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG },
  inner: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 28, fontWeight: "700", color: "white" },
  subtitle: { marginTop: 10, fontSize: 16, color: "rgba(255,255,255,0.7)" },
  input: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    borderRadius: BUTTON_RADIUS,
    paddingVertical: 14,
    paddingHorizontal: 16,
    color: "white",
    fontSize: 18,
    letterSpacing: 4,
  },
  button: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: BUTTON_RADIUS,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.6)",
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: "white", fontSize: 16, fontWeight: "600" },
  back: { color: "rgba(255,255,255,0.7)", fontSize: 14 },
});
