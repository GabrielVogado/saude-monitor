import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, ShieldCheck } from "lucide-react-native";

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
          <ArrowLeft size={22} color="#075985" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacidade e Termos</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.badge}>
          <ShieldCheck size={20} color="#0085C7" />
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
  },
  backBtn: { marginRight: 12 },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  content: { padding: 20 },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 14,
    marginBottom: 18,
  },
  badgeText: { color: "#075985", fontSize: 14, fontWeight: "600", marginLeft: 10, flex: 1 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginTop: 14, marginBottom: 6 },
  paragraph: { fontSize: 14, lineHeight: 21, color: "#334155", marginBottom: 8 },
  version: { fontSize: 12, color: "#94A3B8", marginTop: 18, textAlign: "center" },
});
