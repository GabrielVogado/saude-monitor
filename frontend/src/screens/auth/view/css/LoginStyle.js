import {StyleSheet} from "react-native";
import {colors, shadows, spacing, radii, typography} from "../../../../theme";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.surface,
    },
    keyboardAvoidingView: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: spacing.s10,
    },
    header: {
        alignItems: "center",
        paddingHorizontal: spacing.s5,
        paddingVertical: spacing.s5,
    },
    headerTitle: {
        ...typography.titleLg,
        fontWeight: "800",
        color: colors.primary,
        letterSpacing: -0.5,
    },
    card: {
        backgroundColor: colors.surfaceContainerLowest,
        marginHorizontal: spacing.s5,
        borderRadius: radii.xxl,
        padding: spacing.s6,
        ...shadows.cloud1,
        alignItems: "center",
    },
    imageContainer: {
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: colors.primaryFixed,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.s5,
        overflow: "hidden",
    },
    doctorImage: {
        width: 80,
        height: 80,
        resizeMode: "contain",
    },
    title: {
        ...typography.headlineSm,
        color: colors.onSurface,
        textAlign: "center",
        marginBottom: spacing.s2,
    },
    subtitle: {
        ...typography.bodyMd,
        color: colors.onSurfaceVariant,
        textAlign: "center",
        lineHeight: 20,
        marginBottom: spacing.s8,
        paddingHorizontal: spacing.s3,
    },
    form: {
        width: "100%",
    },
    label: {
        fontSize: 12,
        fontWeight: "700",
        color: colors.onSurfaceVariant,
        marginBottom: spacing.s2,
        letterSpacing: 0.5,
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: colors.surfaceContainerLow,
        borderRadius: radii.lg,
        paddingHorizontal: spacing.s4,
        height: 60,
        marginBottom: spacing.s5,
        borderWidth: 1,
        borderColor: colors.outlineVariant,
    },
    inputIcon: {
        width: 22,
        height: 22,
        marginRight: spacing.s3,
        tintColor: colors.outline,
        resizeMode: "contain",
    },
    input: {
        flex: 1,
        color: colors.onSurface,
        fontSize: 15,
    },
    optionsContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: spacing.s6 + 4,
    },
    checkboxContainer: {
        flexDirection: "row",
        alignItems: "center",
        minHeight: 48,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: colors.outlineVariant,
        marginRight: spacing.s3,
    },
    checkboxActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    optionText: {
        fontSize: 13,
        color: colors.onSurfaceVariant,
    },
    link: {
        fontSize: 13,
        color: colors.primary,
        fontWeight: "600",
    },
    loginButton: {
        backgroundColor: colors.primary,
        height: 60,
        borderRadius: radii.lg,
        justifyContent: "center",
        alignItems: "center",
        ...shadows.primaryGlow,
    },
    loginButtonDisabled: {
        opacity: 0.6,
    },
    loginButtonText: {
        color: colors.onPrimary,
        fontSize: 16,
        fontWeight: "700",
    },
    complianceBox: {
        flexDirection: "row",
        backgroundColor: colors.surfaceContainerHigh,
        borderRadius: radii.lg,
        padding: spacing.s4,
        marginTop: spacing.s6,
        gap: spacing.s3,
    },
    complianceIcon: {
        marginTop: 2,
    },
    complianceText: {
        flex: 1,
        fontSize: 11,
        color: colors.onSurfaceVariant,
        lineHeight: 16,
    },
    complianceHighlight: {
        fontWeight: "700",
    },
    securityBadges: {
        flexDirection: "row",
        justifyContent: "center",
        gap: spacing.s5,
        marginTop: spacing.s8,
    },
    badgeItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: "600",
        color: colors.outline,
    },
    socialIcons: {
        flexDirection: "row",
        justifyContent: "center",
        gap: spacing.s8,
        marginTop: spacing.s10,
    },
    iconWrapper: {
        alignItems: "center",
        gap: spacing.s2,
    },
    socialBtn: {
        width: 48,
        height: 48,
        borderRadius: radii.xl,
        backgroundColor: colors.surfaceContainerLowest,
        justifyContent: "center",
        alignItems: "center",
        shadowColor: colors.onSurface,
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    iconLabel: {
        fontSize: 10,
        fontWeight: "700",
        color: colors.onSurfaceVariant,
        letterSpacing: 0.5,
    },
    simpleFooter: {
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        marginTop: spacing.s8,
        gap: spacing.s3,
    },
    simpleFooterLink: {
        fontSize: 12,
        color: colors.onSurfaceVariant,
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.outlineVariant,
    },
});

export default styles;