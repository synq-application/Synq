import React from "react";
import {
    Image,
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
      <Text style={styles.mainTitle}>Ready to activate Synq?</Text>
      <TextInput
        style={styles.memoInput}
        value={memo}
        onChangeText={setMemo}
        placeholder="Optional memo: Happy Hour anyone?"
        placeholderTextColor="#444"
        blurOnSubmit
      />
      <TouchableOpacity
        onPress={onStartSynq}
        style={styles.pulseBox}
        activeOpacity={0.8}
      >
        <Image
          source={require("../../assets/pulse.gif")}
          style={styles.gifLarge}
          resizeMode="contain"
        />
        <Text style={styles.tapToActivate}>
          Tap when you're free to meet up
        </Text>
      </TouchableOpacity>
    </View>
  );
}
