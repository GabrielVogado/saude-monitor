import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Building2, MapPin, MessageSquare } from "lucide-react-native";
import { CSButton, CSCard, CSHeader, CSTextField } from "../../../components";
import { colors, spacing, typography } from "../../../theme/tokens";
import HospitalService from "../service/HospitalService";

/**
 * Tela de revisão de uma sugestão pública de hospital (E1-06).
 * Permite aprovar (abrindo o formulário completo de hospital) ou rejeitar (com motivo).
 */
export default function RevisarSugestaoScreen({ navigation, route }) {
  const { sugestao } = route.params || {};

  const [motivo, setMotivo] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  if (!sugestao) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <CSHeader title="Revisar sugestão" onBack={() => navigation.goBack()} />
        <View style={styles.center}>
          <Text style={styles.muted}>Sugestão não encontrada.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const validarMotivo = () => {
    const e = {};
    if (!motivo.trim() || motivo.trim().length < 5) {
      e.motivo = "Informe um motivo com pelo menos 5 caracteres.";
    }
    return e;
  };

  const handleAprovar = () => {
    navigation.navigate("HospitalForm", {
      mode: "create",
      sugestao: {
        id: sugestao.id,
        nome: sugestao.nome,
        endereco: sugestao.endereco,
      },
    });
  };

  const handleRejeitar = async () => {
    const e = validarMotivo();
    setErrors(e);

    if (Object.keys(e).length > 0) {
      Alert.alert("Revise o campo", "Informe o motivo da rejeição.");
      return;
    }

    setSubmitting(true);
    try {
      await HospitalService.rejeitarSugestao(sugestao.id, motivo.trim());
      Alert.alert("Sucesso", "Sugestão rejeitada com sucesso.", [
        { text: "OK", onPress: () => navigation.navigate("SugestoesPendentes") },
      ]);
    } catch (error) {
      Alert.alert("Não foi possível rejeitar", error.message || "Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const isPendente = sugestao.status === "PENDENTE";
  const isAprovada = sugestao.status === "APROVADA";
  const isRecusada = sugestao.status === "RECUSADA";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <CSHeader title="Revisar sugestão" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <CSCard style={styles.card}>
            <Text style={styles.label}>Nome do hospital</Text>
            <View style={styles.infoRow}>
              <Building2 size={18} color={colors.outline} />
              <Text style={styles.infoText}>{sugestao.nome}</Text>
            </View>

            <Text style={styles.label}>Endereço informado</Text>
            <View style={styles.infoRow}>
              <MapPin size={18} color={colors.outline} />
              <Text style={styles.infoText}>
                {sugestao.endereco?.logradouro}, {sugestao.endereco?.cidade} —{" "}
                {sugestao.endereco?.uf}
              </Text>
            </View>

            {sugestao.observacao ? (
              <>
                <Text style={styles.label}>Observação</Text>
                <View style={styles.infoRow}>
                  <MessageSquare size={18} color={colors.outline} />
                  <Text style={styles.infoText}>{sugestao.observacao}</Text>
                </View>
              </>
            ) : null}

            <Text style={styles.meta}>
              Enviada em {new Date(sugestao.criadoEm).toLocaleString("pt-BR")}
            </Text>

            {isAprovada && sugestao.hospitalId ? (
              <Text style={styles.meta}>Hospital vinculado: {sugestao.hospitalId}</Text>
            ) : null}

            {isRecusada && sugestao.motivoRecusa ? (
              <>
                <Text style={styles.label}>Motivo da rejeição</Text>
                <Text style={styles.infoText}>{sugestao.motivoRecusa}</Text>
              </>
            ) : null}
          </CSCard>

          {isPendente ? (
            <CSCard style={styles.card}>
              <Text style={styles.sectionTitle}>Ações</Text>

              <CSButton
                label="Aprovar e cadastrar hospital"
                onPress={handleAprovar}
                disabled={submitting}
              />

              <Text style={styles.ou}>ou</Text>

              <CSTextField
                label="Motivo da rejeição"
                value={motivo}
                onChangeText={setMotivo}
                placeholder="Explique por que a sugestão não será aceita..."
                icon={MessageSquare}
                multiline
                maxLength={500}
                error={errors.motivo}
              />

              <CSButton
                label="Rejeitar sugestão"
                variant="secondary"
                onPress={handleRejeitar}
                loading={submitting}
                disabled={submitting}
              />
            </CSCard>
          ) : (
            <CSCard style={styles.card}>
              <Text style={styles.sectionTitle}>Status</Text>
              <Text style={styles.infoText}>
                Esta sugestão já foi {isAprovada ? "aprovada" : "rejeitada"} e não pode ser
                alterada.
              </Text>
            </CSCard>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.s4,
  },
  scrollContent: {
    padding: spacing.s4,
    gap: spacing.s4,
    paddingBottom: spacing.s12,
  },
  card: {
    gap: spacing.s3,
  },
  label: {
    ...typography.bodySm,
    color: colors.outline,
    marginTop: spacing.s2,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.s2,
  },
  infoText: {
    ...typography.bodyMd,
    color: colors.onSurface,
    flex: 1,
  },
  meta: {
    ...typography.bodySm,
    color: colors.outline,
    marginTop: spacing.s2,
  },
  sectionTitle: {
    ...typography.titleMd,
    color: colors.onSurface,
  },
  ou: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    textAlign: "center",
  },
  muted: {
    ...typography.bodyMd,
    color: colors.outline,
  },
});
