import {
  CLOSE_ICON_COLOR,
  CLOSE_ICON_NAME,
  CLOSE_ICON_SIZE,
  CLOSE_ICON_SIZE_INLINE,
} from "@/constants/Variables";
import { Ionicons } from "@expo/vector-icons";
import React from "react";

type Props = {
  size?: number;
  /** `inline` — search / field clear; `default` — sheets and modals. */
  variant?: "default" | "inline";
};

export default function CloseIcon({ size, variant = "default" }: Props) {
  const resolvedSize =
    size ?? (variant === "inline" ? CLOSE_ICON_SIZE_INLINE : CLOSE_ICON_SIZE);

  return (
    <Ionicons
      name={CLOSE_ICON_NAME}
      size={resolvedSize}
      color={CLOSE_ICON_COLOR}
    />
  );
}
