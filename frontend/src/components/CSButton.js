import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { colors, radii, shadows, spacing, touchTarget, typography } from "../theme/tokens";

const HEIGHT = {
  primary: 56,
  secondary: 52,
  tertiary: 48,
};

/**
 * Botão do Design System "Clinical Sanctuary".
 * Variantes: primary (gradiente/primary), secondary (ghost), tertiary (text-only).
 */
export default function CSButton({
  label,
  onPress,
  variant = "primary",
  disabled = false,
  loading = false,
  icon: Icon,
  iconSize = 20,
  style,
  accessibilityLabel,
  ...props
}) {
  const isDisabled = disabled || loading;
  const height = HEIGHT[variant] || 56;

  const colorText =
    variant === "primary" ? colors.onPrimary : colors.primary;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || label}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { minHeight: Math.max(height, touchTarget.min) },
        variant === "primary" && styles.primary,
        variant === "secondary" && styles.secondary,
        variant === "tertiary" && styles.tertiary,
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      {...props}
    >
      {loading ? (
        <ActivityIndicator size="small" color={colorText} />
      ) : (
        <>
          <Text style={[styles.label, { color: colorText }]}>{label}</Text>
          {Icon ? <Icon size={iconSize} color={colorText} /> : null}
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.s2,
    paddingHorizontal: spacing.s6,
  },
  primary: {
    backgroundColor: colors.primary,
    borderRadius: radii.xl,
    ...shadows.primaryGlow,
  },
  secondary: {
    backgroundColor: colors.surfaceContainerLow,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: "rgba(191,199,210,0.2)",
  },
  tertiary: {
    backgroundColor: "transparent",
    paddingHorizontal: spacing.s4,
  },
  label: {
    ...typography.labelLg,
    textAlign: "center",
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
  },
});
