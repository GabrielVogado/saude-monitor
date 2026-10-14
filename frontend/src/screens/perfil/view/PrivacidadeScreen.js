import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, ShieldCheck } from "lucide-react-native";
import { colors, typography, spacing, radii } from "../../../theme";
import {
  abrirLinkLegal,
  EMAIL_PRIVACIDADE,
  URL_POLITICA_PRIVACIDADE,
  URL_TERMOS_USO,
  VERSAO_TERMOS,
} from "../../../config/linksLegais";


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

        <Text style={styles.sectionTitle}>1. Quem cuida dos seus dados</Text>
        <Text style={styles.paragraph}>
          O responsável (controlador) é Gabriel Vogado, desenvolvedor do Radar Saúde. Para
          qualquer assunto sobre seus dados, escreva para {EMAIL_PRIVACIDADE}.
        </Text>

        <Text style={styles.sectionTitle}>2. Quais dados tratamos</Text>
        <Text style={styles.paragraph}>
          Localização do aparelho, com o app aberto e, se você permitir, também com o app
          fechado ou fora de uso, para registrar sua chegada e saída de hospitais; as
          visitas (hospital, horários e duração); as avaliações que você responder; e, se
          criar uma conta, nome, e-mail e telefone. Não vendemos seus dados nem os usamos
          para publicidade.
        </Text>

        <Text style={styles.sectionTitle}>3. Dado de saúde e base legal</Text>
        <Text style={styles.paragraph}>
          Saber que alguém esteve num hospital pode revelar informação de saúde, que a LGPD
          trata como dado sensível. Por isso localização, visitas e avaliações só são
          tratadas com o seu consentimento específico (art. 11, I), que você pode retirar a
          qualquer momento em Perfil → Dados e Privacidade, sem perder o acesso ao restante
          do aplicativo.
        </Text>

        <Text style={styles.sectionTitle}>4. O que é público</Text>
        <Text style={styles.paragraph}>
          A nota média e o tempo de atendimento de cada hospital são calculados com as
          visitas e avaliações de todos e não identificam ninguém. Seu histórico e seus
          comentários só aparecem para você.
        </Text>

        <Text style={styles.sectionTitle}>5. Seus direitos</Text>
        <Text style={styles.paragraph}>
          Você pode acessar, corrigir, exportar ou excluir seus dados. A exclusão de conta
          fica em Perfil → Dados e Privacidade e apaga seus dados pessoais, o identificador
          do aparelho, as posições de GPS das visitas e seus comentários. Respondemos pedidos
          por e-mail em até 15 dias.
        </Text>

        <TouchableOpacity
          style={styles.link}
          onPress={() => abrirLinkLegal(URL_POLITICA_PRIVACIDADE)}
          accessibilityRole="link"
          accessibilityLabel="Ler a Política de Privacidade completa"
        >
          <Text style={styles.linkText}>Ler a Política de Privacidade completa</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.link}
          onPress={() => abrirLinkLegal(URL_TERMOS_USO)}
          accessibilityRole="link"
          accessibilityLabel="Ler os Termos de Uso"
        >
          <Text style={styles.linkText}>Ler os Termos de Uso</Text>
        </TouchableOpacity>

        <Text style={styles.version}>Versão {VERSAO_TERMOS}, vigente desde 14/10/2026.</Text>
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
  link: { minHeight: 48, justifyContent: "center", marginTop: spacing.s2 },
  linkText: { ...typography.bodyMd, color: colors.primary, fontWeight: "600" },
  version: { fontSize: 12, color: colors.outline, marginTop: spacing.s5, textAlign: "center" },
});
