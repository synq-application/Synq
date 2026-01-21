import { ACCENT, BG, fonts, synqSvg, TEXT } from "@/constants/Variables";
import { FirebaseRecaptchaVerifierModal } from "expo-firebase-recaptcha";
import { router } from "expo-router";
import { signInWithPhoneNumber } from "firebase/auth";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SvgXml } from "react-native-svg";
import { app, auth, firebaseConfig } from "../../src/lib/firebase";

const { width, height } = Dimensions.get("window");

export default function Phone() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [confirm, setConfirm] = useState<any>(null);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const inputs = useRef<(TextInput | null)[]>([]);
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (code.join("").length === 6) verifyCode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const handlePhoneNumberChange = (text: string) => {
    const formattedText = text.replace(/\D/g, "").slice(0, 10);
    setPhoneNumber(formattedText);
  };

  const handleChange = (text: string, index: number) => {
    const cleanText = text.replace(/\D/g, "");

    if (cleanText.length > 1) {
      const otpArray = cleanText.slice(0, 6).split("");
      const newCode = ["", "", "", "", "", ""];
      otpArray.forEach((char, i) => (newCode[i] = char));
      setCode(newCode);
      Keyboard.dismiss();
      return;
    }

    const newCode = [...code];
    newCode[index] = cleanText;
    setCode(newCode);
    if (cleanText && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && index > 0 && !code[index]) {
      inputs.current[index - 1]?.focus();
    }
  };

  const sendVerificationCode = async () => {
    if (!recaptchaVerifier.current) return;

    const digits = phoneNumber.replace(/\D/g, "");
    if (digits.length !== 10) {
      Alert.alert("Invalid phone", "Please enter a 10-digit phone number.");
      return;
    }

    const cc = countryCode.startsWith("+") ? countryCode : `+${countryCode}`;
    const formattedPhoneNumber = `${cc}${digits}`;

    try {
      setLoading(true);
      const confirmation = await signInWithPhoneNumber(
        auth,
        formattedPhoneNumber,
        recaptchaVerifier.current as any
      );
      setConfirm(confirmation);
      setIsCodeSent(true);
      setCode(["", "", "", "", "", ""]);
    } catch (error: any) {
      Alert.alert("Error", error?.message ?? "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    const fullCode = code.join("");
    if (fullCode.length !== 6 || loading) return;

    try {
      setLoading(true);
      await confirm.confirm(fullCode);
    } catch (error: any) {
      Alert.alert("Error", "Invalid code. Please try again.");
      setCode(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const maskedPhone =
    phoneNumber.length === 10
      ? `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}`
      : "your number";

  const recaptchaConfig = (app as any)?.options ?? firebaseConfig;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.root}>
        <View pointerEvents="none" style={styles.bgSvgWrap}>
          <SvgXml xml={synqSvg} width="120%" height="120%" />
        </View>
        <FirebaseRecaptchaVerifierModal
          ref={recaptchaVerifier}
          firebaseConfig={recaptchaConfig}
          attemptInvisibleVerification
        />

        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} activeOpacity={0.7}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.container}
        >
          {!isCodeSent ? (
            <View style={styles.innerContent}>
              <Text style={styles.title}>What’s your{"\n"}number?</Text>
              <View style={styles.divider} />

              <View style={styles.inputRow}>
                <View style={styles.countryWrapper}>
                  <TextInput
                    value={countryCode}
                    onChangeText={setCountryCode}
                    style={styles.countryInput}
                    keyboardType="phone-pad"
                    placeholder="+1"
                    placeholderTextColor="rgba(255,255,255,0.25)"
                  />
                </View>

                <View style={styles.phoneWrapper}>
                  <TextInput
                    value={phoneNumber}
                    onChangeText={handlePhoneNumberChange}
                    style={styles.phoneInput}
                    keyboardType="phone-pad"
                    placeholder="555 555 0100"
                    placeholderTextColor="rgba(255,255,255,0.20)"
                    autoFocus={false}
                  />
                </View>
              </View>

              <Text style={styles.helper}>
                We’ll text you a code to verify your account.
              </Text>

              <TouchableOpacity
                onPress={sendVerificationCode}
                style={[
                  styles.primaryButton,
                  (loading || phoneNumber.length < 10) && styles.disabledButton,
                ]}
                disabled={loading || phoneNumber.length < 10}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#061006" />
                ) : (
                  <Text style={styles.primaryButtonText}>Send Code</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.push("/(auth)/email")} style={styles.linkBtn}>
                <Text style={styles.linkText}>Sign up with email instead</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.innerContent}>
              <Text style={styles.titleCenter}>Enter code</Text>
              <View style={[styles.divider, { alignSelf: "center", width: "62%" }]} />
              <Text style={styles.subtitleCenter}>Sent to {maskedPhone}</Text>

              <View style={styles.otpRow}>
                {code.map((digit, index) => (
                  <TextInput
                    key={index}
                    ref={(el) => (inputs.current[index] = el)}
                    value={digit}
                    onChangeText={(text) => handleChange(text, index)}
                    onKeyPress={(e) => handleKeyPress(e, index)}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    autoComplete={Platform.OS === "android" ? "sms-otp" : "one-time-code"}
                    maxLength={6}
                    style={[styles.otpBox, digit !== "" && styles.otpBoxFilled]}
                  />
                ))}
              </View>

              <TouchableOpacity
                onPress={() => {
                  setIsCodeSent(false);
                  setConfirm(null);
                  setCode(["", "", "", "", "", ""]);
                }}
                style={styles.linkBtn}
              >
                <Text style={styles.linkText}>Wrong number or didn’t get a code?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={verifyCode}
                style={[
                  styles.primaryButton,
                  { marginTop: 26 },
                  (loading || code.join("").length < 6) && styles.disabledButton,
                ]}
                disabled={loading || code.join("").length < 6}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#061006" />
                ) : (
                  <Text style={styles.primaryButtonText}>Continue</Text>
                )}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  bgSvgWrap: {
    position: "absolute",
    top: -40,
    left: -40,
    right: -40,
    bottom: -40,
    opacity: 0.35,
    transform: [{ rotate: "-8deg" }],
  },
  backBtn: { position: "absolute", top: 60, left: 22, zIndex: 10 },
  backText: { fontSize: 16, color: ACCENT, fontFamily: fonts.book },
  container: { flex: 1, paddingHorizontal: 22 },
  innerContent: { width: "100%", marginTop: height * 0.20 },
  title: {
    color: TEXT,
    fontSize: 38,
    fontFamily: fonts.heavy,
    lineHeight: 46,
    letterSpacing: 0.2,
  },
  divider: {
    marginTop: 14,
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    width: "78%",
  },
  titleCenter: {
    color: TEXT,
    fontSize: 30,
    fontFamily: fonts.heavy,
    textAlign: "center",
    letterSpacing: 0.2,
  },
  subtitleCenter: {
    color: "rgba(255,255,255,0.55)",
    fontSize: 15,
    textAlign: "center",
    marginTop: 10,
    fontFamily: fonts.book,
  },
  inputRow: { flexDirection: "row", marginTop: 28, height: 58 },
  countryWrapper: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    marginRight: 10,
    width: 74,
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  countryInput: {
    color: TEXT,
    textAlign: "center",
    fontSize: 16,
    fontFamily: fonts.medium,
  },
  phoneWrapper: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  phoneInput: {
    color: TEXT,
    fontSize: 16,
    fontFamily: fonts.medium,
    letterSpacing: 0.8,
  },
  helper: {
    color: "rgba(255,255,255,0.45)",
    fontSize: 13,
    marginTop: 18,
    fontFamily: fonts.book,
    lineHeight: 18,
  },
  primaryButton: {
    backgroundColor: ACCENT,
    height: 56,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 26,
  },
  primaryButtonText: {
    color: "#061006",
    fontSize: 18,
    fontFamily: fonts.heavy,
    letterSpacing: 0.2,
  },
  disabledButton: { backgroundColor: "rgba(125, 255, 166, 0.30)" },
  otpRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 34 },
  otpBox: {
    width: width / 8.5,
    height: 58,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 18,
    textAlign: "center",
    fontSize: 22,
    color: TEXT,
    fontFamily: fonts.heavy,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  otpBoxFilled: {
    borderColor: ACCENT,
    backgroundColor: "rgba(125, 255, 166, 0.06)",
  },
  linkBtn: { marginTop: 18, alignSelf: "center" },
  linkText: { color: ACCENT, fontSize: 15, fontFamily: fonts.medium },
});
