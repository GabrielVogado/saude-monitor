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
 * Sugestão pública de hospital ainda não cadastrado (E1-05, P2).
 */
export default function SugerirHospitalScreen({ navigation }) {
  const [nome, setNome] = useState("");
  const [logradouro, setLogradouro] = useState("");
  const [cidade, setCidade] = useState("");
  const [uf, setUf] = useState("");
  const [observacao, setObservacao] = useState("");

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validar = () => {
    const e = {};
    if (!nome.trim()) e.nome = "Informe o nome do hospital.";
    if (!logradouro.trim()) e.logradouro = "Informe o endereço.";
    if (!cidade.trim()) e.cidade = "Informe a cidade.";
    if (!uf.trim()) e.uf = "Informe a UF.";
    return e;
  };

  const handleSubmit = async () => {
    const e = validar();
    setErrors(e);

    if (Object.keys(e).length > 0) {
      Alert.alert("Revise os campos", "Preencha os campos obrigatórios.");
      return;
    }

    setSubmitting(true);
    try {
      await HospitalService.sugerir({
        nome: nome.trim(),
        endereco: {
          logradouro: logradouro.trim(),
          cidade: cidade.trim(),
          uf: uf.trim().toUpperCase(),
        },
        observacao: observacao.trim(),
      });

      Alert.alert(
        "Sugestão enviada",
        "Obrigado! Sua sugestão foi registrada e será analisada pela equipe.",
        [{ text: "OK", onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert("Não foi possível enviar", error.message || "Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <CSHeader title="Sugerir hospital" onBack={() => navigation.goBack()} />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <CSCard style={styles.card}>
            <Text style={styles.description}>
              Encontrou um hospital que ainda não está no aplicativo? Conte para a gente.
            </Text>

            <CSTextField
              label="Nome do hospital"
              value={nome}
              onChangeText={setNome}
              placeholder="Ex.: Hospital Municipal"
              icon={Building2}
              error={errors.nome}
              autoCapitalize="words"
            />

            <CSTextField
              label="Endereço"
              value={logradouro}
              onChangeText={setLogradouro}
              placeholder="Rua, número"
              icon={MapPin}
              error={errors.logradouro}
              autoCapitalize="words"
            />

            <View style={styles.row}>
              <View style={styles.rowFlex}>
                <CSTextField
                  label="Cidade"
                  value={cidade}
                  onChangeText={setCidade}
                  placeholder="São Paulo"
                  error={errors.cidade}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.rowSmall}>
                <CSTextField
                  label="UF"
                  value={uf}
                  onChangeText={(v) => setUf(v.toUpperCase().slice(0, 2))}
                  placeholder="SP"
                  error={errors.uf}
                  autoCapitalize="characters"
                  maxLength={2}
                />
              </View>
            </View>

            <CSTextField
              label="Observações (opcional)"
              value={observacao}
              onChangeText={setObservacao}
              placeholder="Ex.: fica ao lado do metrô, atende urgência..."
              icon={MessageSquare}
              multiline
              maxLength={280}
            />

            <CSButton
              label="Enviar sugestão"
              onPress={handleSubmit}
              loading={submitting}
              disabled={submitting}
            />
          </CSCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  flex: { flex: 1 },
  scrollContent: {
    padding: spacing.s4,
    paddingBottom: spacing.s12,
  },
  card: {
    gap: spacing.s3,
  },
  description: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.s2,
  },
  row: {
    flexDirection: "row",
    gap: spacing.s3,
  },
  rowFlex: {
    flex: 1,
  },
  rowSmall: {
    width: 88,
  },
});
