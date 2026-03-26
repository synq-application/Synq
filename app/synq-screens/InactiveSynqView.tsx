import { Image as ExpoImage } from "expo-image";
import React from "react";
import { ACCENT } from "@/constants/Variables";
import {
  ActivityIndicator,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

type Props = {
  memo: string;
  setMemo: (text: string) => void;
  onStartSynq: () => void;
  isStartingSynq?: boolean;
  styles: any;
};

export default function InactiveSynqView({
  memo,
  setMemo,
  onStartSynq,
  isStartingSynq = false,
  styles,
}: Props) {
  return (
    <View style={styles.inactiveCenter}>
      <Text style={styles.mainSubtitle}>
        Tap the pulse to see friends who are free right now.
      </Text>

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
        disabled={isStartingSynq}
      >
        {isStartingSynq ? (
          <ActivityIndicator color={ACCENT} size="large" />
        ) : (
          <ExpoImage
            source={require("../../assets/pulse.gif")}
            style={styles.gifLarge}
            contentFit="contain"
            transition={0}
            cachePolicy="memory-disk"
          />
        )}
      </TouchableOpacity>
    </View>
  );
}
