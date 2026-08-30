import { StyleSheet } from "react-native";
import { colors, typography, spacing, radii } from "../../../../theme";

// E6-02: cores hardcoded migradas para os tokens do Design System v2.0.
export default StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

  header: {
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s3 + 2,
    backgroundColor: colors.surfaceContainerLowest,
    borderBottomWidth: 1,
    borderColor: colors.outlineVariant,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { ...typography.titleLg, color: colors.onSurface },

  content: { padding: spacing.s4 },

  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.lg,
    padding: spacing.s5,
    marginBottom: spacing.s4,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
  },
  cardTitle: { ...typography.titleLg, color: colors.onSurface, marginBottom: spacing.s3 },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.s3,
  },
  avatarText: { color: colors.onPrimary, fontSize: 26, fontWeight: "700" },
  userName: { ...typography.titleLg, color: colors.onSurface },
  userEmail: { ...typography.bodyMd, color: colors.onSurfaceVariant, marginTop: 2 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.s3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.outlineVariant,
  },
  rowLabel: { ...typography.bodyLg, color: colors.onSurface, fontWeight: "500" },
  rowValue: { ...typography.bodyMd, color: colors.onSurfaceVariant },

  semAcesso: { alignItems: "center", paddingVertical: spacing.s5 },
  semAcessoTitle: { ...typography.titleLg, color: colors.onSurface, marginTop: spacing.s3, marginBottom: spacing.s2 },
  semAcessoText: { ...typography.bodyMd, color: colors.onSurfaceVariant, textAlign: "center", marginBottom: spacing.s4 },

  button: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.s3,
    paddingHorizontal: spacing.s4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.s2,
    marginTop: spacing.s2,
    minHeight: 48,
  },
  buttonSecondary: {
    backgroundColor: colors.surfaceContainerHigh,
    borderRadius: radii.md,
    paddingVertical: spacing.s3,
    paddingHorizontal: spacing.s4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.s2,
    marginTop: spacing.s2,
    minHeight: 48,
  },
  buttonText: { color: colors.onPrimary, ...typography.bodyLg, fontWeight: "600" },
  buttonTextSecondary: { color: colors.onSurface, ...typography.bodyLg, fontWeight: "600" },

  dangerButton: {
    backgroundColor: colors.errorContainer,
    borderRadius: radii.md,
    paddingVertical: spacing.s3,
    paddingHorizontal: spacing.s4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.s2,
    marginTop: spacing.s2,
    minHeight: 48,
  },
  dangerButtonText: { color: colors.onErrorContainer, ...typography.bodyLg, fontWeight: "600" },

  status: { borderRadius: radii.xs, paddingHorizontal: spacing.s2, paddingVertical: 3 },
  statusAtivo: { backgroundColor: colors.successBg },
  statusAtivoText: { color: colors.onSecondary, ...typography.labelMd, fontWeight: "700" },
  statusInativo: { backgroundColor: colors.surfaceContainerHigh },
  statusInativoText: { color: colors.onSurfaceVariant, ...typography.labelMd, fontWeight: "700" },

  link: { color: colors.primary, ...typography.bodyMd, fontWeight: "600" },

  footerNote: { ...typography.bodySm, color: colors.onSurfaceVariant, marginTop: spacing.s3, lineHeight: 17 },
});