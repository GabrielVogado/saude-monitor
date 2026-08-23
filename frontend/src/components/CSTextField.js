import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors, radii, spacing, touchTarget, typography } from "../theme/tokens";

/**
 * Campo de texto do Design System (anatomia: label + container + input + helper).
 */
export default function CSTextField({
  label,
  value,
  onChangeText,
  placeholder,
  icon: Icon,
  trailing,
  helper,
  error,
  keyboardType,
  autoCapitalize = "none",
  secureTextEntry = false,
  multiline = false,
  maxLength,
  style,
  ...props
}) {
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.error
    : focused
    ? colors.primary
    : "transparent";

  return (
    <View style={[styles.wrapper, style]}>
      {label ? <Text style={styles.label}>{label.toUpperCase()}</Text> : null}

      <View
        style={[
          styles.container,
          multiline && styles.containerMultiline,
          { borderWidth: 2, borderColor },
        ]}
      >
        {Icon ? <Icon size={20} color={colors.outline} style={styles.leadingIcon} /> : null}

        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.outline}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          secureTextEntry={secureTextEntry}
          multiline={multiline}
          maxLength={maxLength}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={label}
          {...props}
        />

        {trailing || null}
      </View>

      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
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
  container: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: Math.max(56, touchTarget.min),
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.md,
    paddingHorizontal: spacing.s4,
  },
  containerMultiline: {
    alignItems: "flex-start",
    paddingVertical: spacing.s3,
  },
  leadingIcon: {
    marginRight: spacing.s2,
  },
  input: {
    flex: 1,
    ...typography.bodyLg,
    color: colors.onSurface,
    paddingVertical: 0,
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: "top",
  },
  helper: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: spacing.s1,
  },
  error: {
    ...typography.bodySm,
    color: colors.onErrorContainer,
    marginTop: spacing.s1,
  },
});
