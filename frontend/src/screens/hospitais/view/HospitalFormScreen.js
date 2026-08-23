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
import { Building2, Mail, MapPin, Phone } from "lucide-react-native";
import { CSBadge, CSButton, CSCard, CSHeader, CSSelect, CSTextField } from "../../../components";
import { colors, spacing, typography } from "../../../theme/tokens";
import HospitalService from "../service/HospitalService";
import GeofenceEditor from "./GeofenceEditor";
import {
  cnpjValido,
  emailValido,
  mascararCep,
  mascararCnpj,
  telefoneValido,
} from "../../../utils/format";
import { coordenadasParaGeoJson, geojsonParaCoordenadas } from "../../../utils/geojson";

const TIPO_OPTIONS = [
  { value: "PUBLICO", label: "Público" },
  { value: "PRIVADO", label: "Privado" },
  { value: "FILANTROPICO", label: "Filantrópico" },
];

/**
 * Formulário administrativo de cadastro (E1-01) / edição e desativação (E1-04)
 * com desenho do geofence (E1-02).
 */
export default function HospitalFormScreen({ navigation, route }) {
  const isEdit = route?.params?.mode === "edit";
  const initial = route?.params?.hospital || null;

  const [nome, setNome] = useState(initial?.nome || "");
  const [cnpj, setCnpj] = useState(initial?.cnpj || "");
  const [tipo, setTipo] = useState(initial?.tipo || "");
  const [logradouro, setLogradouro] = useState(initial?.endereco?.logradouro || "");
  const [cidade, setCidade] = useState(initial?.endereco?.cidade || "");
  const [uf, setUf] = useState(initial?.endereco?.uf || "");
  const [cep, setCep] = useState(initial?.endereco?.cep || "");
  const [telefone, setTelefone] = useState(initial?.contato?.telefone || "");
  const [email, setEmail] = useState(initial?.contato?.email || "");
  const [vertices, setVertices] = useState(() => geojsonParaCoordenadas(initial?.geofence));
  const [ativo, setAtivo] = useState(initial?.ativo ?? true);

  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const validar = () => {
    const e = {};
    if (!nome.trim()) e.nome = "Informe o nome do hospital.";
    if (!cnpjValido(cnpj)) e.cnpj = "Informe um CNPJ válido (XX.XXX.XXX/XXXX-XX).";
    if (!tipo) e.tipo = "Selecione o tipo.";
    if (!logradouro.trim()) e.logradouro = "Informe o logradouro.";
    if (!cidade.trim()) e.cidade = "Informe a cidade.";
    if (!uf.trim()) e.uf = "Informe a UF.";
    if (telefone && !telefoneValido(telefone)) e.telefone = "Formato: (XX) XXXXX-XXXX.";
    if (email && !emailValido(email)) e.email = "Informe um e-mail válido.";
    if (vertices.length < 3) e.geofence = "Desenhe um polígono com pelo menos 3 vértices.";
    return e;
  };

  const montarPayload = () => {
    const geofence = vertices.length >= 3 ? coordenadasParaGeoJson(vertices) : null;

    return {
      nome: nome.trim(),
      cnpj,
      tipo,
      endereco: {
        logradouro: logradouro.trim(),
        cidade: cidade.trim(),
        uf: uf.trim().toUpperCase(),
        cep: cep.trim(),
      },
      contato: { telefone: telefone.trim(), email: email.trim() },
      ...(geofence ? { geofence } : {}),
    };
  };

  const handleSubmit = async () => {
    const e = validar();
    setErrors(e);

    if (Object.keys(e).length > 0) {
      Alert.alert("Revise os campos", "Alguns campos precisam de atenção.");
      return;
    }

    setSubmitting(true);
    try {
      if (isEdit) {
        await HospitalService.atualizar(initial.id, montarPayload());
        Alert.alert("Sucesso", "Hospital atualizado com sucesso.");
      } else {
        await HospitalService.cadastrar(montarPayload());
        Alert.alert("Sucesso", "Hospital cadastrado com sucesso.");
      }
      navigation.goBack();
    } catch (error) {
      Alert.alert("Não foi possível salvar", error.message || "Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatus = async () => {
    if (!isEdit) return;

    setSubmitting(true);
    try {
      await HospitalService.alterarStatus(initial.id, !ativo);
      setAtivo(!ativo);
    } catch (error) {
      Alert.alert("Não foi possível alterar o status", error.message || "Tente novamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <CSHeader
        title={isEdit ? "Editar hospital" : "Cadastrar hospital"}
        onBack={() => navigation.goBack()}
        rightAction={
          isEdit ? (
            <CSBadge
              label={ativo ? "Ativo" : "Inativo"}
              variant={ativo ? "positive" : "neutral"}
            />
          ) : null
        }
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <CSCard style={styles.section}>
            <Text style={styles.sectionTitle}>Dados cadastrais</Text>

            <CSTextField
              label="Nome do hospital"
              value={nome}
              onChangeText={setNome}
              placeholder="Ex.: Hospital Santa Casa"
              icon={Building2}
              error={errors.nome}
              autoCapitalize="words"
            />

            <CSTextField
              label="CNPJ"
              value={cnpj}
              onChangeText={(v) => setCnpj(mascararCnpj(v))}
              placeholder="XX.XXX.XXX/XXXX-XX"
              icon={Building2}
              error={errors.cnpj}
              keyboardType="numeric"
              maxLength={18}
            />

            <CSSelect
              label="Tipo"
              value={tipo}
              onSelect={setTipo}
              options={TIPO_OPTIONS}
              placeholder="Selecione o tipo"
              icon={Building2}
              error={errors.tipo}
            />
          </CSCard>

          <CSCard style={styles.section}>
            <Text style={styles.sectionTitle}>Endereço</Text>

            <CSTextField
              label="Logradouro"
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
              label="CEP"
              value={cep}
              onChangeText={(v) => setCep(mascararCep(v))}
              placeholder="00000-000"
              icon={MapPin}
              keyboardType="numeric"
              maxLength={9}
            />
          </CSCard>

          <CSCard style={styles.section}>
            <Text style={styles.sectionTitle}>Contato</Text>

            <CSTextField
              label="Telefone"
              value={telefone}
              onChangeText={setTelefone}
              placeholder="(11) 3333-0000"
              icon={Phone}
              error={errors.telefone}
              keyboardType="phone-pad"
            />

            <CSTextField
              label="E-mail"
              value={email}
              onChangeText={setEmail}
              placeholder="contato@hospital.com.br"
              icon={Mail}
              error={errors.email}
              keyboardType="email-address"
            />
          </CSCard>

          <CSCard style={styles.section}>
            <Text style={styles.sectionTitle}>Área de cobertura (geofence)</Text>
            <Text style={styles.sectionHelper}>
              Desenhe o polígono da área do hospital tocando no mapa. O polígono é salvo como
              GeoJSON Polygon.
            </Text>
            <GeofenceEditor value={vertices} onChange={setVertices} />
            {errors.geofence ? <Text style={styles.geofenceError}>{errors.geofence}</Text> : null}
          </CSCard>

          {isEdit ? (
            <View style={styles.statusRow}>
              <CSButton
                label={ativo ? "Desativar hospital" : "Ativar hospital"}
                variant="secondary"
                onPress={handleStatus}
                loading={submitting}
                disabled={submitting}
              />
            </View>
          ) : null}

          <CSButton
            label={isEdit ? "Salvar alterações" : "Cadastrar hospital"}
            onPress={handleSubmit}
            loading={submitting}
            disabled={submitting}
          />
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
    gap: spacing.s4,
    paddingBottom: spacing.s12,
  },
  section: {
    gap: spacing.s3,
  },
  sectionTitle: {
    ...typography.titleMd,
    color: colors.onSurface,
  },
  sectionHelper: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
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
  geofenceError: {
    ...typography.bodySm,
    color: colors.onErrorContainer,
  },
  statusRow: {
    marginBottom: spacing.s2,
  },
});
