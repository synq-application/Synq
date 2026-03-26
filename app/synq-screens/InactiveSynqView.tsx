import { Ionicons } from "@expo/vector-icons";
import { Image as ExpoImage } from "expo-image";
import React from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  memo: string;
  setMemo: (text: string) => void;
  onStartSynq: () => void;
  styles: any;
};

export default function InactiveSynqView({
  memo,
  setMemo,
  onStartSynq,
  styles,
}: Props) {
  return (
    <View style={styles.inactiveCenter}>
      <Text style={styles.mainEyebrow}>Currently inactive</Text>
      <Text style={styles.mainSubtitle}>
        Tap the pulse to go visible to friends who are free right now.
      </Text>

      <View style={styles.inlineMetaRow}>
        <View style={styles.inlineMetaItem}>
          <Ionicons name="radio-outline" size={14} color="#2BFF88" />
          <Text style={styles.inlineMetaText}>Visible instantly</Text>
        </View>
        <View style={styles.inlineMetaDot} />
        <View style={styles.inlineMetaItem}>
          <Ionicons name="time-outline" size={14} color="#2BFF88" />
          <Text style={styles.inlineMetaText}>End anytime</Text>
        </View>
      </View>

      <View style={styles.memoCard}>
        <Text style={styles.memoLabel}>Add a quick memo (optional)</Text>
        <TextInput
          style={styles.memoInput}
          value={memo}
          onChangeText={setMemo}
          placeholder="Coffee? Walk? Quick bite?"
          placeholderTextColor="#6A6A6A"
          blurOnSubmit
        />
      </View>

      <TouchableOpacity
        onPress={onStartSynq}
        style={styles.pulseBox}
        activeOpacity={0.8}
      >
        <ExpoImage
          source={require("../../assets/pulse.gif")}
          style={styles.gifLarge}
          contentFit="contain"
          transition={0}
          cachePolicy="memory-disk"
        />
      </TouchableOpacity>
    </View>
  );
}
