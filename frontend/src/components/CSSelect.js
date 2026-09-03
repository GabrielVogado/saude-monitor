import React, { useCallback, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Check, ChevronDown } from "lucide-react-native";
import { colors, radii, spacing, touchTarget, typography } from "../theme/tokens";

/**
 * Select do Design System: campo + Bottom Sheet nativo (modal simplificado).
 * `options` = [{ value, label }].
 */
export default function CSSelect({
  label,
  value,
  onSelect,
  options = [],
  placeholder = "Selecione",
  icon: Icon,
  error,
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  // ARQ-05: extraído do JSX e memoizado — inline, o renderItem nascia de novo a cada
  // abertura do seletor e a cada mudança de `value`, recriando todas as opções.
  const renderOption = useCallback(
    ({ item }) => {
      const isSelected = item.value === value;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
          onPress={() => {
            onSelect(item.value);
            setOpen(false);
          }}
          style={({ pressed }) => [styles.option, pressed && styles.pressed]}
        >
          <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
            {item.label}
          </Text>
          {isSelected ? <Check size={20} color={colors.secondary} /> : null}
        </Pressable>
      );
    },
    [value, onSelect]
  );

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label.toUpperCase()}</Text> : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [
          styles.field,
          error && styles.fieldError,
          pressed && styles.pressed,
        ]}
      >
        {Icon ? <Icon size={20} color={colors.outline} style={styles.leadingIcon} /> : null}
        <Text style={[styles.value, !selected && styles.placeholder]}>
          {selected ? selected.label : placeholder}
        </Text>
        <ChevronDown size={20} color={colors.outline} />
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.scrim} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <FlatList
              data={options}
              keyExtractor={(item) => String(item.value)}
              renderItem={renderOption}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.s5,
  },
  label: {
    ...typography.labelSm,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.s2,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: Math.max(56, touchTarget.min),
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.md,
    paddingHorizontal: spacing.s4,
  },
  fieldError: {
    borderWidth: 2,
    borderColor: colors.error,
  },
  leadingIcon: {
    marginRight: spacing.s2,
  },
  value: {
    flex: 1,
    ...typography.bodyLg,
    color: colors.onSurface,
  },
  placeholder: {
    color: colors.outline,
  },
  pressed: {
    opacity: 0.7,
  },
  error: {
    ...typography.bodySm,
    color: colors.onErrorContainer,
    marginTop: spacing.s1,
  },
  scrim: {
    flex: 1,
    backgroundColor: colors.overlayScrim,
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: radii.xxl,
    borderTopRightRadius: radii.xxl,
    paddingBottom: spacing.s8,
    maxHeight: "60%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.surfaceContainerHighest,
    marginVertical: spacing.s3,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 56,
    paddingHorizontal: spacing.s6,
  },
  optionLabel: {
    ...typography.bodyLg,
    color: colors.onSurface,
  },
  optionLabelSelected: {
    color: colors.secondary,
    fontWeight: "600",
  },
});
