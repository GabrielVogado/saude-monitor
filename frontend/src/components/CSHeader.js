import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArrowLeft } from "lucide-react-native";
import { colors, spacing, touchTarget, typography } from "../theme/tokens";

/**
 * Header padrão (sem borda inferior — regra "no-line").
 * Back opcional (CSIconButton 48), título centralizado e ação direita opcional.
 */
export default function CSHeader({ title, onBack, rightAction, subtitle }) {
  return (
    <View style={styles.container}>
      <View style={styles.side}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Voltar"
            onPress={onBack}
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          >
            <ArrowLeft size={24} color={colors.onSurfaceVariant} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      <View style={styles.side}>
        {rightAction || null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    paddingHorizontal: spacing.s2,
    backgroundColor: colors.surface,
  },
  side: {
    width: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  center: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: spacing.s2,
  },
  backBtn: {
    width: touchTarget.min,
    height: touchTarget.min,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    backgroundColor: colors.surfaceContainerHigh,
  },
  title: {
    ...typography.titleLg,
    color: colors.onSurface,
    textAlign: "center",
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
});
