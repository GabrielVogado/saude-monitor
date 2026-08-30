import {StyleSheet} from "react-native";
import {colors, typography, spacing, radii} from "../../../../theme";

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.surface,
    },
    content: {
        flex: 1,
        justifyContent: "flex-start",
        alignItems: "flex-start",
        paddingHorizontal: spacing.s5,
        paddingTop: spacing.s8,
    },
    errorBox: {
        width: "100%",
        backgroundColor: colors.errorContainer,
        borderRadius: radii.md,
        padding: spacing.s4,
        marginBottom: spacing.s5,
    },
    errorText: {
        ...typography.bodyMd,
        color: colors.onErrorContainer,
        marginBottom: spacing.s3,
    },
    actionsRow: {
        flexDirection: "row",
        gap: spacing.s3,
        marginBottom: spacing.s5,
        width: "100%",
    },
    actionButton: {
        flex: 1,
    },
    headline: {
        ...typography.headlineMd,
        color: colors.onSurface,
        textAlign: "left",
        marginBottom: spacing.s4,
        letterSpacing: 1,
    },
    highlight: {
        color: colors.primary,
        fontWeight: "700",
    },
    description: {
        ...typography.bodyMd,
        color: colors.onSurfaceVariant,
        textAlign: "left",
        marginBottom: spacing.s5,
        lineHeight: typography.bodyLg.lineHeight,
    },
    topicsContainer: {
        marginBottom: spacing.s5,
        width: "100%",
    },
    topicBlock: {
        marginBottom: spacing.s4,
    },
    topicHeader: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: spacing.s1 + 1,
    },
    topicIcon: {
        width: 20,
        height: 20,
        marginRight: spacing.s2,
        resizeMode: "contain",
    },
    topicTitle: {
        ...typography.titleMd,
        color: colors.onSurface,
    },
    topicDescription: {
        ...typography.bodySm,
        color: colors.onSurfaceVariant,
        lineHeight: 18,
    },
    imagePlaceholder: {
        width: "100%",
        height: 150,
        backgroundColor: colors.surfaceContainerLowest,
        borderRadius: radii.lg,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: spacing.s8,
        overflow: "hidden",
    },
    homeImage: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
        backgroundColor: colors.surfaceContainerLowest,
    },
});

export default styles;