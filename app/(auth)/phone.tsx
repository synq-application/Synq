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
import { SvgXml } from 'react-native-svg';
import { app, auth, firebaseConfig } from "../../src/lib/firebase";

const { width, height } = Dimensions.get('window');
const ACCENT = "#7DFFA6";

const synqSvg = `
  <svg width="390" height="565" viewBox="0 0 390 565" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path fill-rule="evenodd" clip-rule="evenodd" d="M315.808 523.349C309.142 527.14 300.865 522.325 300.865 514.656V302.238C300.865 298.642 302.796 295.322 305.923 293.545L463.367 204.029C470.033 200.239 478.31 205.053 478.31 212.722V360.975C478.31 362.753 478.783 364.498 479.682 366.032L504.916 409.08C506.747 412.203 506.747 416.072 504.916 419.195L483.3 456.065C480.533 460.784 474.488 462.404 469.732 459.701L453.672 450.573C450.608 448.831 446.852 448.831 443.788 450.574L315.808 523.349ZM349.216 338.697C349.216 335.101 351.147 331.782 354.273 330.004L422.996 290.928C429.662 287.138 437.939 291.953 437.939 299.621V377.51C437.939 381.106 436.008 384.425 432.881 386.203L364.159 425.278C357.493 429.069 349.216 424.254 349.216 416.585V338.697Z" fill="#FFFFFF" fill-opacity="0.05"/>
  </svg>
`;

const fonts = {
  black: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif-condensed',
  heavy: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif-medium',
  medium: Platform.OS === 'ios' ? 'Avenir-Medium' : 'sans-serif',
  book: Platform.OS === 'ios' ? 'Avenir-Book' : 'sans-serif',
};

export default function Phone() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [countryCode, setCountryCode] = useState("+1");
  const [confirm, setConfirm] = useState<any>(null);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const inputs = useRef<(TextInput | null)[]>([]);
  const recaptchaVerifier = useRef<FirebaseRecaptchaVerifierModal>(null);
  const [loading, setLoading] = useState(false);

  // Auto-verify when code is full
  useEffect(() => {
    if (code.join("").length === 6) {
      verifyCode();
    }
  }, [code]);

  const handlePhoneNumberChange = (text: string) => {
    const formattedText = text.replace(/\D/g, "").slice(0, 10);
    setPhoneNumber(formattedText);
  };

  const handleChange = (text: string, index: number) => {
    // 1. Handle Autofill (multiple characters at once)
    const cleanText = text.replace(/\D/g, "");
    
    if (cleanText.length > 1) {
      const otpArray = cleanText.slice(0, 6).split("");
      const newCode = ["", "", "", "", "", ""];
      otpArray.forEach((char, i) => {
        newCode[i] = char;
      });
      setCode(newCode);
      Keyboard.dismiss();
      return;
    }

    // 2. Handle Single Character Input
    const newCode = [...code];
    newCode[index] = cleanText;
    setCode(newCode);

    if (cleanText && index < 5) {
      inputs.current[index + 1]?.focus();
    }
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
      const confirmation = await signInWithPhoneNumber(auth, formattedPhoneNumber, recaptchaVerifier.current as any);
      setConfirm(confirmation);
      setIsCodeSent(true);
      setCode(["", "", "", "", "", ""]);
      setTimeout(() => inputs.current[0]?.focus(), 250);
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

  const maskedPhone = phoneNumber.length === 10 ? `(${phoneNumber.slice(0, 3)}) ${phoneNumber.slice(3, 6)}-${phoneNumber.slice(6, 10)}` : "your number";
  const recaptchaConfig = (app as any)?.options ?? firebaseConfig;

  return (
    <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <View style={styles.root}>
        <View style={styles.svgBackground}>
          <SvgXml xml={synqSvg} width={width * 1.2} height={height} />
        </View>

        <FirebaseRecaptchaVerifierModal 
          ref={recaptchaVerifier} 
          firebaseConfig={recaptchaConfig} 
          attemptInvisibleVerification 
        />

        <TouchableOpacity onPress={() => router.back()} style={styles.close}>
          <Text style={styles.closeText}>Back</Text>
        </TouchableOpacity>

        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.container}
        >
          {!isCodeSent ? (
            <View style={styles.innerContent}>
              <Text style={styles.title}>What’s your{"\n"}number?</Text>
              
              <View style={styles.inputRow}>
                <View style={styles.countryWrapper}>
                  <TextInput
                    value={countryCode}
                    onChangeText={setCountryCode}
                    style={styles.countryInput}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.phoneWrapper}>
                  <TextInput
                    value={phoneNumber}
                    onChangeText={handlePhoneNumberChange}
                    style={styles.phoneInput}
                    keyboardType="phone-pad"
                    placeholder="555 555 0100"
                    placeholderTextColor="rgba(255,255,255,0.2)"
                    autoFocus
                  />
                </View>
              </View>

              <Text style={styles.helper}>
                We'll text you a code to verify your account.
              </Text>

              <TouchableOpacity
                onPress={sendVerificationCode}
                style={[styles.primaryButton, (!phoneNumber || loading) && styles.disabledButton]}
                disabled={loading || phoneNumber.length < 10}
              >
                {loading ? <ActivityIndicator color="black" /> : <Text style={styles.primaryButtonText}>Send Code</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.innerContent}>
              <Text style={styles.titleCenter}>Enter code</Text>
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
                    textContentType="oneTimeCode" // Essential for iOS
                    autoComplete={Platform.OS === 'android' ? 'sms-otp' : 'one-time-code'}
                    maxLength={6} // Allow the first box to catch the 6-digit autofill string
                    style={[styles.otpBox, digit !== "" && styles.otpBoxFilled]}
                  />
                ))}
              </View>

              <TouchableOpacity
                onPress={() => { setIsCodeSent(false); setConfirm(null); }}
                style={styles.resendBtn}
              >
                <Text style={styles.linkText}>Wrong number or didn't get a code?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={verifyCode}
                style={[styles.primaryButton, { marginTop: 40 }, (code.join("").length < 6 || loading) && styles.disabledButton]}
                disabled={loading || code.join("").length < 6}
              >
                {loading ? <ActivityIndicator color="black" /> : <Text style={styles.primaryButtonText}>Continue</Text>}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "black" },
  svgBackground: { ...StyleSheet.absoluteFillObject, opacity: 0.5, left: -20 },
  close: { position: "absolute", top: 60, left: 25, zIndex: 10 },
  closeText: { fontSize: 16, color: ACCENT, fontFamily: fonts.heavy },
  container: { flex: 1, paddingHorizontal: 30 },
  innerContent: { width: '100%', marginTop: height * 0.24 },
  title: { color: "white", fontSize: 42, fontFamily: fonts.black, lineHeight: 50 },
  titleCenter: { color: "white", fontSize: 32, fontFamily: fonts.black, textAlign: "center" },
  subtitleCenter: { color: "rgba(255,255,255,0.5)", fontSize: 16, textAlign: "center", marginTop: 8, fontFamily: fonts.medium },
  inputRow: { flexDirection: "row", marginTop: 30, height: 60 },
  countryWrapper: { backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, marginRight: 10, width: 70, justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  countryInput: { color: "white", textAlign: "center", fontSize: 18, fontFamily: fonts.heavy },
  phoneWrapper: { flex: 1, backgroundColor: "rgba(255,255,255,0.05)", borderRadius: 12, justifyContent: 'center', paddingHorizontal: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  phoneInput: { color: "white", fontSize: 18, fontFamily: fonts.heavy, letterSpacing: 1 },
  helper: { color: "rgba(255,255,255,0.4)", fontSize: 13, marginTop: 20, fontFamily: fonts.book, lineHeight: 18 },
  primaryButton: { backgroundColor: ACCENT, height: 58, borderRadius: 12, justifyContent: "center", alignItems: "center", marginTop: 30 },
  primaryButtonText: { color: "black", fontSize: 18, fontFamily: fonts.black },
  disabledButton: { backgroundColor: 'rgba(125, 255, 166, 0.3)' },
  otpRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 50 },
  otpBox: { width: width / 8.5, height: 60, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 12, textAlign: "center", fontSize: 24, color: "white", fontFamily: fonts.black, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  otpBoxFilled: { borderColor: ACCENT, backgroundColor: 'rgba(125, 255, 166, 0.05)' },
  resendBtn: { marginTop: 25, alignSelf: 'center' },
  linkText: { color: ACCENT, fontSize: 14, fontFamily: fonts.heavy },
});