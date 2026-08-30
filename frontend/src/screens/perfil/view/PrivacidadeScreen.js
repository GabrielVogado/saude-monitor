import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, ShieldCheck } from "lucide-react-native";
import { colors, typography, spacing, radii } from "../../../theme";

/**
 * Tela de Política de Privacidade / Termos de Uso (Épico 05 — E5-02).
 *
 * Critério de aceite: a política é acessível em até 2 toques a partir de qualquer
 * ponto, apresenta os termos em linguagem simples, menciona a LGPD e exibe a
 * versão vigente dos termos.
 */
export default function PrivacidadeScreen({ navigation }) {
  const voltar = () => {
    if (navigation?.goBack) navigation.goBack();
    else navigation?.navigate?.("Perfil");
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={voltar} accessibilityRole="button" accessibilityLabel="Voltar">
          <ArrowLeft size={22} color={colors.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacidade e Termos</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badge}>
          <ShieldCheck size={20} color={colors.primary} />
          <Text style={styles.badgeText}>
            Em conformidade com a LGPD (Lei 13.709/2018).
          </Text>
        </View>

        <Text style={styles.sectionTitle}>1. Quais dados tratamos</Text>
        <Text style={styles.paragraph}>
          Este aplicativo trata dados pessoais apenas para a finalidade de monitorar a
          experiência hospitalar e construir estatísticas públicas de qualidade (nota e
          tempo médio de atendimento). Esses dados incluem: localização (somente com seu
          consentimento), visitas a hospitais e informações de cadastro (nome, e-mail,
          telefone) quando você opta por criar uma conta.
        </Text>

        <Text style={styles.sectionTitle}>2. Base legal</Text>
        <Text style={styles.paragraph}>
          O tratamento de localização depende do seu consentimento explícito (art. 7º, I,
          LGPD). Você pode revogar esse consentimento a qualquer momento em
          Perfil → Dados e Privacidade, sem perder acesso ao restante do aplicativo.
        </Text>

        <Text style={styles.sectionTitle}>3. Dados públicos vs. pessoais</Text>
        <Text style={styles.paragraph}>
          As estatísticas exibidas por hospital (nota média, tempo de atendimento) são
          agregados públicos e não identificam você. Dados pessoais como nome, e-mail e
          telefone são usados apenas para autenticação e nunca aparecem nessas estatísticas.
        </Text>

        <Text style={styles.sectionTitle}>4. Seus direitos (LGPD)</Text>
        <Text style={styles.paragraph}>
          Você pode solicitar acesso, correção, anonimização ou exclusão dos seus dados
          pessoais. A exclusão de conta está disponível em Perfil → Dados e Privacidade,
          que remove seus dados pessoais e anonimiza os dados usados nas estatísticas.
        </Text>

        <Text style={styles.sectionTitle}>5. Contato</Text>
        <Text style={styles.paragraph}>
          Para exercer seus direitos de titular, entre em contato pelo suporte do
          aplicativo. Responderemos em até 15 dias úteis.
        </Text>

        <Text style={styles.version}>Versão 1.0 — vigente a partir da data de aceite.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// E6-02: cores migradas para os tokens do Design System v2.0.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceContainerLowest },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s3,
    borderBottomWidth: 1,
    borderColor: colors.outlineVariant,
  },
  backBtn: { marginRight: spacing.s3, minHeight: 48, minWidth: 48, justifyContent: "center" },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.onSurface },
  content: { padding: spacing.s5 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.primaryContainer,
    borderRadius: radii.md,
    padding: spacing.s3 + 2,
    marginBottom: spacing.s5,
  },
  badgeText: {
    color: colors.onPrimaryContainer,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: spacing.s3,
    flex: 1,
  },
  sectionTitle: {
    ...typography.titleMd,
    color: colors.onSurface,
    marginTop: spacing.s3 + 2,
    marginBottom: spacing.s2,
  },
  paragraph: {
    ...typography.bodyMd,
    lineHeight: 21,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.s2,
  },
  version: { fontSize: 12, color: colors.outline, marginTop: spacing.s5, textAlign: "center" },
});
