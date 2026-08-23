import React from "react";
import { Pressable, StyleSheet } from "react-native";
import { colors, touchTarget } from "../theme/tokens";

/**
 * Botão de ícone 48×48 (radius-full) para headers e ações compactas.
 */
export default function CSIconButton({
  icon: Icon,
  onPress,
  color = colors.onSurfaceVariant,
  size = 24,
  accessibilityLabel,
  style,
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && styles.pressed, style]}
    >
      <Icon size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: touchTarget.min / 2,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    backgroundColor: colors.surfaceContainerHigh,
  },
});
