import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, radii, spacing, typography } from "../theme/tokens";

const VARIANTS = {
  positive: { bg: colors.secondaryContainer, fg: colors.onSecondaryContainer },
  urgent: { bg: colors.errorContainer, fg: colors.onErrorContainer },
  warning: { bg: colors.tertiaryContainer, fg: colors.onTertiaryContainer },
  info: { bg: colors.primaryContainer, fg: colors.onPrimaryContainer },
  neutral: { bg: colors.surfaceVariant, fg: colors.onSurfaceVariant },
};

/**
 * Badge/pill do Design System. Variantes: positive, urgent, warning, info, neutral.
 */
export default function CSBadge({ label, variant = "neutral", icon: Icon, style }) {
  const tone = VARIANTS[variant] || VARIANTS.neutral;

  return (
    <View style={[styles.badge, { backgroundColor: tone.bg }, style]}>
      {Icon ? <Icon size={14} color={tone.fg} /> : null}
      <Text style={[styles.label, { color: tone.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s1,
    height: 32,
    paddingHorizontal: spacing.s3,
    borderRadius: radii.sm,
    alignSelf: "flex-start",
  },
  label: {
    ...typography.labelMd,
  },
});
