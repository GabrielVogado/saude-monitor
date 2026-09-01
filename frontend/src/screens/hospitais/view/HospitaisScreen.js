import React, { useCallback, useEffect, useRef, useState } from "react";
import { Alert, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { MapPinOff, Search } from "lucide-react-native";
import {
  CSHeader,
  CSHospitalCard,
  CSEmptyState,
  CSLoadingList,
  CSChip,
  CSTextField,
} from "../../../components";
import { colors, spacing } from "../../../theme/tokens";
import HospitalService from "../service/HospitalService";
import VisitaService from "../../visitas/service/VisitaService";
import { normalizeText } from "../../../utils/normalize";

const TIPO_FILTROS = [
  { value: "", label: "Todos" },
  { value: "PUBLICO", label: "Público" },
  { value: "PRIVADO", label: "Privado" },
  { value: "FILANTROPICO", label: "Filantrópico" },
];

/**
 * Listagem pública de hospitais ativos (E1-03).
 *
 * Navegação revisada: cada card ganhou um botão compacto de check-in manual. Ao tocar
 * em "Check-in", o app registra a visita (origem MANUAL) e redireciona para o
 * `HospitalDetalhe`, que exibe o temporizador e o botão de checkout quando a visita
 * ativa é do modo manual. O corpo do card (fora do botão) continua abrindo o detalhe
 * como antes.
 */
export default function HospitaisScreen({ navigation }) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState(null);

  const [visitaAtiva, setVisitaAtiva] = useState(null);
  const [checkinEnviandoId, setCheckinEnviandoId] = useState(null);

  const debounceRef = useRef(null);
  const carregamentoInicialFeitoRef = useRef(false);

  const carregar = useCallback(async (modo = "inicial") => {
    if (modo === "refresh") setRefreshing(true);
    else setCarregando(true);
    setErro(null);

    try {
      // Normaliza a busca (acento/caixa) antes de enviar ao backend e de filtrar localmente.
      const termo = normalizeText(busca);
      const resposta = await HospitalService.listar({ busca: termo, tipo });
      const lista = resposta?.content || resposta || [];

      // Filtro defensivo no cliente: garante consistência acento/caixa mesmo que o
      // backend devolva itens fora do critério (ex.: dados legados sem normalização).
      const filtrados = termo
        ? lista.filter((hospital) => normalizeText(hospital?.nome).includes(termo))
        : lista;

      setDados(filtrados);
    } catch (e) {
      setErro(e.message || "Não foi possível carregar os hospitais.");
    } finally {
      setCarregando(false);
      setRefreshing(false);
    }
  }, [busca, tipo]);

  useEffect(() => {
    if (!carregamentoInicialFeitoRef.current) {
      carregamentoInicialFeitoRef.current = true;
      carregar();
      return undefined;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => carregar(), 400);
    return () => clearTimeout(debounceRef.current);
  }, [carregar]);

  // Reidrata a visita ativa ao focar a aba (e ao voltar do detalhe) para refletir o
  // estado do botão de check-in por hospital (modo anônimo via dispositivoId, §3.3).
  const atualizarVisitaAtiva = useCallback(() => {
    VisitaService.buscarAtiva()
      .then((data) => setVisitaAtiva(data?.visita || null))
      .catch(() => setVisitaAtiva(null));
  }, []);

  useFocusEffect(
    useCallback(() => {
      atualizarVisitaAtiva();
    }, [atualizarVisitaAtiva])
  );

  const abrirDetalhe = (hospital) => {
    navigation.navigate("HospitalDetalhe", { id: hospital.id });
  };

  const tratarConflitoGeofence = (conflito) => {
    setCheckinEnviandoId(null);
    Alert.alert(
      "Qual hospital é este?",
      conflito.message || "Encontramos mais de um hospital nesta localização.",
      [
        ...conflito.candidatos.map((candidato) => ({
          text: candidato.nome,
          onPress: () => fazerCheckin({ id: candidato.hospitalId, nome: candidato.nome }),
        })),
        { text: "Cancelar", style: "cancel" },
      ]
    );
  };

  const fazerCheckin = async (hospital) => {
    if (visitaAtiva) {
      if (visitaAtiva.hospitalId === hospital.id) {
        navigation.navigate("HospitalDetalhe", { id: hospital.id });
      } else {
        Alert.alert(
          "Check-in ativo",
          "Finalize o check-in atual antes de iniciar uma visita em outro hospital."
        );
      }
      return;
    }

    setCheckinEnviandoId(hospital.id);
    setErro(null);
    try {
      const resposta = await VisitaService.checkin({
        hospitalId: hospital.id,
        origem: "MANUAL",
      });
      setVisitaAtiva({ ...resposta, origem: "MANUAL" });
      // Redireciona ao detalhe do hospital, que exibe o temporizador + checkout
      // (específico do check-in manual).
      setCheckinEnviandoId(null);
      navigation.navigate("HospitalDetalhe", { id: hospital.id });
    } catch (e) {
      setCheckinEnviandoId(null);
      if (e.status === 409 && e.data?.candidatos?.length) {
        tratarConflitoGeofence(e.data);
        return;
      }
      Alert.alert("Check-in", e.message || "Não foi possível fazer o check-in.");
    }
  };

  const renderVazio = () => {
    const temFiltro = busca.trim() || tipo;

    if (erro) {
      return (
        <CSEmptyState
          icon={MapPinOff}
          title="Algo deu errado"
          message={erro}
          actionLabel="Tentar novamente"
          onAction={() => carregar()}
        />
      );
    }

    if (temFiltro) {
      return (
        <CSEmptyState
          icon={MapPinOff}
          title="Nenhum hospital encontrado"
          message="Tente ajustar a busca ou o filtro."
        />
      );
    }

    return (
      <CSEmptyState
        icon={MapPinOff}
        title="Nenhum hospital por aqui"
        message="Sugira um hospital que ainda não esteja cadastrado."
        actionLabel="Sugerir hospital"
        onAction={() => navigation.navigate("SugerirHospital")}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <CSHeader title="Hospitais" />

      <View style={styles.searchArea}>
        <CSTextField
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar hospital por nome"
          icon={Search}
        />

        <View style={styles.chipsRow}>
          {TIPO_FILTROS.map((f) => (
            <CSChip
              key={f.value || "todos"}
              label={f.label}
              selected={tipo === f.value}
              onPress={() => setTipo(f.value)}
            />
          ))}
        </View>
      </View>

      {carregando ? (
        <CSLoadingList count={3} />
      ) : (
        <FlatList
          data={dados}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <CSHospitalCard
              hospital={item}
              onPress={() => abrirDetalhe(item)}
              onCheckin={() => fazerCheckin(item)}
              checkinLoading={checkinEnviandoId === item.id}
              checkinAtivo={visitaAtiva?.hospitalId === item.id}
              checkinDesabilitado={
                (checkinEnviandoId !== null && checkinEnviandoId !== item.id) ||
                (visitaAtiva !== null && visitaAtiva.hospitalId !== item.id)
              }
            />
          )}
          ListEmptyComponent={renderVazio}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => carregar("refresh")}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  searchArea: {
    padding: spacing.s4,
    gap: spacing.s3,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s2,
  },
  listContent: {
    paddingHorizontal: spacing.s4,
    paddingBottom: spacing.s6,
    gap: spacing.s4,
    flexGrow: 1,
  },
});
