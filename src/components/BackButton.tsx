import { navigationBackBtn } from "@/constants/Variables";
import React from "react";
import {
  TouchableOpacity,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import BackIcon from "./BackIcon";

type Props = {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  activeOpacity?: number;
};

export default function BackButton({
  onPress,
  style,
  accessibilityLabel = "Go back",
  activeOpacity = 0.7,
}: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[navigationBackBtn, style]}
      activeOpacity={activeOpacity}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <BackIcon />
    </TouchableOpacity>
  );
}
