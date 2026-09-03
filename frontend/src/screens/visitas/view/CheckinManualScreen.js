import React, {useEffect, useState} from "react";
import {Alert, FlatList, StyleSheet, Text, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import HospitalService from "../../hospitais/service/HospitalService";
import VisitaService from "../service/VisitaService";
import CSButton from "../../../components/CSButton";
import { CSLoading } from "../../../components/CSLoading";
import CSCard from "../../../components/CSCard";
import CSEmptyState from "../../../components/CSEmptyState";
import {colors, typography, spacing} from "../../../theme";

/**
 * Check-in manual (E2-06): fallback quando o GPS está desligado ou a permissão de
 * localização foi negada. Lista hospitais ativos e registra a visita com
 * `origem = "MANUAL"` (sem validação de geofence no backend).
 *
 * E6-02/E6-03/E6-04: tokens do DS, acessibilidade e estados de erro/retry + empty.
 */
export default function CheckinManualScreen({ navigation }) {
  const [hospitais, setHospitais] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviandoId, setEnviandoId] = useState(null);
  const [erro, setErro] = useState(null);

  const carregar = () => {
    setCarregando(true);
    setErro(null);
    HospitalService.listar({ size: 50 })
      .then((data) => setHospitais(data?.content || data || []))
      .catch((e) => setErro(e.message || "Não foi possível carregar os hospitais."))
      .finally(() => setCarregando(false));
  };

  useEffect(() => {
    carregar();
  }, []);

  const fazerCheckin = async (hospital) => {
    setEnviandoId(hospital.id);
    setErro(null);
    try {
      await VisitaService.checkin({
        hospitalId: hospital.id,
        origem: "MANUAL",
      });
      navigation.goBack();
    } catch (e) {
      if (e.status === 409 && e.data?.candidatos?.length) {
        tratarConflitoGeofence(e.data);
        return;
      }
      setErro(e.message);
      setEnviandoId(null);
    }
  };

  /**
   * Conflito de geofences sobrepostos (E2-04/RN-05): o backend não cria a visita e
   * devolve `candidatos` (hospitais empatados em distância, ≤10m). Pergunta em 1 toque
   * qual deles é o correto e reenvia o check-in com o `hospitalId` escolhido.
   */
  const tratarConflitoGeofence = (conflito) => {
    Alert.alert(
      "Qual hospital é este?",
      conflito.message || "Encontramos mais de um hospital nesta localização.",
      [
        ...conflito.candidatos.map((candidato) => ({
          text: candidato.nome,
          onPress: () => reenviarCheckinComCandidato(candidato),
        })),
        { text: "Cancelar", style: "cancel", onPress: () => setEnviandoId(null) },
      ]
    );
  };

  const reenviarCheckinComCandidato = async (candidato) => {
    setEnviandoId(candidato.hospitalId);
    setErro(null);
    try {
      await VisitaService.checkin({
        hospitalId: candidato.hospitalId,
        origem: "MANUAL",
      });
      navigation.goBack();
    } catch (e) {
      setErro(e.message);
      setEnviandoId(null);
    }
  };

  if (carregando) {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel="Carregando hospitais" style={{ flex: 1 }}>
        <CSLoading />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Estou em um hospital</Text>
      <Text style={styles.subtitle}>
        Selecione o hospital em que você está. Use esta opção quando o GPS estiver
        desligado ou a permissão de localização não estiver disponível.
      </Text>

      {erro && (
        <CSEmptyState
          title="Algo deu errado"
          message={erro}
          actionLabel="Tentar novamente"
          onAction={carregar}
        />
      )}

      {!erro && (
        <FlatList
          data={hospitais}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CSCard style={styles.card}>
              <Text style={styles.hospitalNome}>{item.nome}</Text>
              <Text style={styles.hospitalInfo}>
                {item.tipoUnidade || item.categoria || ""}
              </Text>
              <CSButton
                label="Estou aqui"
                onPress={() => fazerCheckin(item)}
                loading={enviandoId === item.id}
                disabled={enviandoId !== null}
                variant="secondary"
              />
            </CSCard>
          )}
          ListEmptyComponent={
            <CSEmptyState
              title="Nenhum hospital cadastrado"
              message="Não há hospitais ativos disponíveis para check-in manual no momento."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.s4,
    backgroundColor: colors.surface,
  },
  title: {
    ...typography.headlineSm,
    color: colors.onSurface,
    marginBottom: spacing.s1,
  },
  subtitle: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.s4,
  },
  card: {
    marginBottom: spacing.s2,
  },
  hospitalNome: {
    ...typography.titleMd,
    color: colors.onSurface,
  },
  hospitalInfo: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.s2,
  },
});