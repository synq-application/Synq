import { ACCENT } from "@/constants/Variables";
import { groupsPageStyles } from "@/src/components/friends/groupsListStyles";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";

const SECTION_ADD_GLYPH_SIZE = 14;

type Props = {
  title: string;
  onAdd: () => void;
  accessibilityLabel: string;
};

export default function GroupsSectionHeader({ title, onAdd, accessibilityLabel }: Props) {
  return (
    <View style={groupsPageStyles.sectionTitleRow}>
      <Text style={groupsPageStyles.sectionTitle}>{title}</Text>
      <TouchableOpacity
        style={groupsPageStyles.sectionAddBtn}
        onPress={onAdd}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        activeOpacity={0.82}
      >
        <Ionicons name="add" size={SECTION_ADD_GLYPH_SIZE} color={ACCENT} />
      </TouchableOpacity>
    </View>
  );
}
