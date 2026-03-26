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
      <Text style={styles.mainTitle}>Tap when you're free</Text>
      <TextInput
        style={styles.memoInput}
        value={memo}
        onChangeText={setMemo}
        placeholder="Optional memo: Let's grab a coffee!"
        placeholderTextColor="#444"
        blurOnSubmit
      />
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
