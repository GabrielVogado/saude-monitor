import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radii, shadows, spacing } from "../theme/tokens";

/**
 * Card do Design System. Variante "tonal" para blocos secundários (sem sombra).
 */
export default function CSCard({ children, tonal = false, style, ...props }) {
  return (
    <View
      style={[styles.card, tonal && styles.tonal, style]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: spacing.s5,
    ...shadows.cloud1,
  },
  tonal: {
    backgroundColor: colors.surfaceContainerLow,
    shadowOpacity: 0,
    elevation: 0,
  },
});
