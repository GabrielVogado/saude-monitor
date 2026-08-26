import React, {useEffect, useState} from "react";
import {Alert, FlatList, Text, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import HospitalService from "../../hospitais/service/HospitalService";
import VisitaService from "../service/VisitaService";
import CSButton from "../../../components/CSButton";
import CSLoading from "../../../components/CSLoading";
import CSCard from "../../../components/CSCard";

/**
 * Check-in manual (E2-06): fallback quando o GPS está desligado ou a permissão de
 * localização foi negada. Lista hospitais ativos e registra a visita com
 * `origem = "MANUAL"` (sem validação de geofence no backend).
 */
export default function CheckinManualScreen({ navigation }) {
  const [hospitais, setHospitais] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    HospitalService.listar({ size: 50 })
      .then((data) => setHospitais(data?.content || data || []))
      .catch((e) => setErro(e.message))
      .finally(() => setCarregando(false));
  }, []);

  const fazerCheckin = async (hospital) => {
    setEnviando(true);
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
    } finally {
      setEnviando(false);
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
        { text: "Cancelar", style: "cancel", onPress: () => setEnviando(false) },
      ]
    );
  };

  const reenviarCheckinComCandidato = async (candidato) => {
    setEnviando(true);
    setErro(null);
    try {
      await VisitaService.checkin({
        hospitalId: candidato.hospitalId,
        origem: "MANUAL",
      });
      navigation.goBack();
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviando(false);
    }
  };

  if (carregando) {
    return <CSLoading />;
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "700", marginBottom: 4 }}>
        Estou em um hospital
      </Text>
      <Text style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>
        Selecione o hospital em que você está. Use esta opção quando o GPS estiver
        desligado ou a permissão de localização não estiver disponível.
      </Text>

      {erro && <Text style={{ color: "#b3261e", marginBottom: 12 }}>{erro}</Text>}

      <FlatList
        data={hospitais}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <CSCard style={{ marginBottom: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.nome}</Text>
            <Text style={{ fontSize: 12, color: "#666", marginBottom: 8 }}>
              {item.tipoUnidade || item.categoria || ""}
            </Text>
            <CSButton
              label="Estou aqui"
              onPress={() => fazerCheckin(item)}
              loading={enviando}
              variant="secondary"
            />
          </CSCard>
        )}
        ListEmptyComponent={
          <Text style={{ textAlign: "center", color: "#666", marginTop: 24 }}>
            Nenhum hospital cadastrado.
          </Text>
        }
      />
    </SafeAreaView>
  );
}
