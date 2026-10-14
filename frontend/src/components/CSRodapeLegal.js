import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Lock, ShieldCheck, Users } from "lucide-react-native";
import { colors, radii, spacing } from "../theme/tokens";
import { abrirLinkLegal, URL_TERMOS_USO } from "../config/linksLegais";

/**
 * Aviso de LGPD exibido dentro do formulário de login e de cadastro.
 */
export function CSAvisoLgpd() {
  return (
    <View style={styles.complianceBox}>
      <View style={styles.complianceIcon}>
        <ShieldCheck size={18} color={colors.primary} />
      </View>
      <Text style={styles.complianceText}>
        A nota e o tempo de cada hospital são calculados sem mostrar quem respondeu, seguindo a{" "}
        <Text style={styles.complianceHighlight}>LGPD</Text>.
      </Text>
    </View>
  );
}

/**
 * Selos de segurança e links de Termos e Privacidade no fim das telas de login e cadastro.
 * Termos abre a página publicada; Privacidade abre a tela do app via `onPrivacidade`.
 */
export default function CSRodapeLegal({ onPrivacidade, linkStyle }) {
  return (
    <>
      <View style={styles.securityBadges}>
        <View style={styles.badgeItem}>
          <ShieldCheck size={14} color={colors.onSurfaceVariant} />
          <Text style={styles.badgeText}>LGPD</Text>
        </View>
        <View style={styles.badgeItem}>
          <Lock size={14} color={colors.onSurfaceVariant} />
          <Text style={styles.badgeText}>Conexão criptografada</Text>
        </View>
        <View style={styles.badgeItem}>
          <Users size={14} color={colors.onSurfaceVariant} />
          <Text style={styles.badgeText}>Estatísticas sem identificar você</Text>
        </View>
      </View>

      <View style={styles.simpleFooter}>
        <TouchableOpacity
          onPress={() => abrirLinkLegal(URL_TERMOS_USO)}
          accessibilityRole="link"
          accessibilityLabel="Termos de Uso"
        >
          <Text style={[styles.link, linkStyle]}>Termos</Text>
        </TouchableOpacity>
        <View style={styles.dot} />
        <TouchableOpacity
          onPress={onPrivacidade}
          accessibilityRole="link"
          accessibilityLabel="Política de Privacidade"
        >
          <Text style={[styles.link, linkStyle]}>Privacidade</Text>
        </TouchableOpacity>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
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
    flexWrap: "wrap",
    justifyContent: "center",
    rowGap: spacing.s2,
    columnGap: spacing.s5,
    marginTop: spacing.s8,
    paddingHorizontal: spacing.s4,
  },
  badgeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.onSurfaceVariant,
  },
  simpleFooter: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: spacing.s8,
    gap: spacing.s3,
  },
  link: {
    fontWeight: "700",
    color: colors.primary,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.outlineVariant,
  },
});
