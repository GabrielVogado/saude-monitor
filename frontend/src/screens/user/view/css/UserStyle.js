import {StyleSheet} from 'react-native';
import {colors, shadows, spacing, radii, typography} from '../../../../theme';

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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: spacing.s5,
        paddingVertical: spacing.s5,
    },
    backBtn: {
        width: 48,
        height: 48,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerBackIcon: {
        transform: [{rotate: '180deg'}],
    },
    headerSpacer: {
        width: 48,
    },
    card: {
        backgroundColor: colors.surfaceContainerLowest,
        marginHorizontal: spacing.s5,
        borderRadius: radii.xxl,
        padding: spacing.s6,
        ...shadows.cloud1,
        alignItems: 'center',
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: radii.full,
        backgroundColor: colors.primaryFixed,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: spacing.s5,
    },
    innerIcon: {
        width: 60,
        height: 60,
        borderRadius: radii.full,
        backgroundColor: colors.primaryFixedDim,
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        ...typography.headlineSm,
        color: colors.onSurface,
        textAlign: 'center',
        marginBottom: spacing.s2,
    },
    subtitle: {
        ...typography.bodyMd,
        color: colors.onSurfaceVariant,
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: spacing.s8,
        paddingHorizontal: spacing.s3,
    },
    form: {
        width: '100%',
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: colors.onSurfaceVariant,
        marginBottom: spacing.s2,
        letterSpacing: 0.5,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceContainerLow,
        borderRadius: radii.lg,
        paddingHorizontal: spacing.s4,
        height: 60,
        marginBottom: spacing.s5,
        borderWidth: 1,
        borderColor: colors.outlineVariant,
    },
    inputIcon: {
        marginRight: spacing.s3,
    },
    input: {
        flex: 1,
        color: colors.onSurface,
        fontSize: 15,
    },
    termsContainer: {
        flexDirection: 'row',
        marginBottom: spacing.s8,
        paddingRight: spacing.s3,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: colors.outlineVariant,
        marginRight: spacing.s3,
        marginTop: 2,
    },
    checkboxActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    termsText: {
        flex: 1,
        fontSize: 13,
        color: colors.onSurfaceVariant,
        lineHeight: 18,
    },
    linkText: {
        fontWeight: '700',
        color: colors.primary,
    },
    registerButton: {
        backgroundColor: colors.primary,
        height: 60,
        borderRadius: radii.lg,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        ...shadows.primaryGlow,
    },
    registerButtonDisabled: {
        opacity: 0.7,
    },
    registerButtonText: {
        color: colors.onPrimary,
        fontSize: 16,
        fontWeight: '700',
    },
    registerButtonIcon: {
        marginLeft: spacing.s2,
    },
    complianceBox: {
        flexDirection: 'row',
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
        fontWeight: '700',
    },
    securityBadges: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.s5,
        marginTop: spacing.s8,
    },
    badgeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: colors.outline,
    },
    socialIcons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: spacing.s8,
        marginTop: spacing.s10,
    },
    iconWrapper: {
        alignItems: 'center',
        gap: spacing.s2,
    },
    socialBtn: {
        width: 48,
        height: 48,
        borderRadius: radii.xl,
        backgroundColor: colors.surfaceContainerLowest,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: colors.onSurface,
        shadowOffset: {width: 0, height: 2},
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    iconLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: colors.onSurfaceVariant,
        letterSpacing: 0.5,
    },
    simpleFooter: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
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