import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../theme/tokens";
import CSButton from "./CSButton";

/**
 * Empty State padrão: ícone em círculo + título + texto + CTA opcional.
 */
export default function CSEmptyState({
  icon: Icon,
  title,
  message,
  actionLabel,
  onAction,
}) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle}>
        {Icon ? <Icon size={32} color={colors.primary} /> : null}
      </View>

      {title ? <Text style={styles.title}>{title}</Text> : null}
      {message ? <Text style={styles.message}>{message}</Text> : null}

      {actionLabel && onAction ? (
        <View style={styles.action}>
          <CSButton label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.s8,
    paddingVertical: spacing.s12,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.s5,
  },
  title: {
    ...typography.headlineSm,
    color: colors.onSurface,
    textAlign: "center",
    marginBottom: spacing.s2,
  },
  message: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
  action: {
    marginTop: spacing.s5,
  },
});
