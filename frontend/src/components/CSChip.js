import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { Check } from "lucide-react-native";
import { colors, radii, spacing, touchTarget, typography } from "../theme/tokens";

/**
 * Chip selecionável (filtros, opções). Alvo de toque >= 48dp.
 */
export default function CSChip({
  label,
  selected = false,
  onPress,
  icon: Icon,
  style,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected && styles.selected,
        pressed && styles.pressed,
        style,
      ]}
    >
      {selected && !Icon ? <Check size={14} color={colors.onSecondaryContainer} /> : null}
      {Icon ? <Icon size={16} color={selected ? colors.onSecondaryContainer : colors.onSurfaceVariant} /> : null}
      <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s1,
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.s4,
    borderRadius: radii.full,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  selected: {
    backgroundColor: colors.secondaryContainer,
    borderColor: colors.secondaryContainer,
  },
  label: {
    ...typography.labelMd,
    color: colors.onSurfaceVariant,
  },
  labelSelected: {
    color: colors.onSecondaryContainer,
  },
  pressed: {
    opacity: 0.7,
  },
});
