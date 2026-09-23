import React from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { colors, radii, shadows, spacing, touchTarget, typography } from "../theme/tokens";

/**
 * Bottom-sheet de opções (ex.: escolher entre unidades sobrepostas no mapa,
 * BUG-11). Sem limite de itens — ao contrário do `Alert.alert`, que no Android
 * só exibe os 3 primeiros botões.
 */
export default function CSOptionSheet({ visible, title, options, onClose }) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Fechar">
        <Pressable style={styles.panel} testID="option-sheet" onPress={() => {}}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
            {(options || []).map((option) => (
              <Pressable
                key={option.key}
                accessibilityRole="button"
                accessibilityLabel={option.label}
                onPress={option.onPress}
                style={({ pressed }) => [styles.option, pressed && styles.pressed]}
              >
                <Text style={styles.optionLabel}>{option.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancelar"
            onPress={onClose}
            style={({ pressed }) => [styles.cancel, pressed && styles.pressed]}
          >
            <Text style={styles.cancelLabel}>Cancelar</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: colors.overlayScrim,
  },
  panel: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    paddingTop: spacing.s5,
    paddingBottom: spacing.s6,
    paddingHorizontal: spacing.s4,
    maxHeight: "70%",
    ...shadows.glass,
  },
  title: {
    ...typography.titleMd,
    color: colors.onSurface,
    marginBottom: spacing.s3,
    paddingHorizontal: spacing.s2,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    gap: spacing.s2,
  },
  option: {
    minHeight: touchTarget.min,
    justifyContent: "center",
    paddingHorizontal: spacing.s4,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainerLow,
  },
  optionLabel: {
    ...typography.bodyLg,
    color: colors.onSurface,
  },
  cancel: {
    minHeight: touchTarget.min,
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.s4,
    borderRadius: radii.md,
  },
  cancelLabel: {
    ...typography.labelLg,
    color: colors.onSurfaceVariant,
  },
  pressed: {
    opacity: 0.7,
  },
});
