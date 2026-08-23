import React, { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPinOff, Plus, Search } from "lucide-react-native";
import {
  CSHeader,
  CSHospitalCard,
  CSEmptyState,
  CSLoadingList,
  CSChip,
  CSTextField,
  CSIconButton,
} from "../../../components";
import { colors, spacing } from "../../../theme/tokens";
import HospitalService from "../service/HospitalService";
import { normalizeText } from "../../../utils/normalize";

const TIPO_FILTROS = [
  { value: "", label: "Todos" },
  { value: "PUBLICO", label: "Público" },
  { value: "PRIVADO", label: "Privado" },
  { value: "FILANTROPICO", label: "Filantrópico" },
];

/**
 * Listagem pública de hospitais ativos (E1-03).
 */
export default function HospitaisScreen({ navigation }) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState(null);

  const debounceRef = useRef(null);

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
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => carregar(), 400);
    return () => clearTimeout(debounceRef.current);
  }, [carregar]);

  const abrirDetalhe = (hospital) => {
    navigation.navigate("HospitalDetalhe", { id: hospital.id });
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
      <CSHeader
        title="Hospitais"
        rightAction={
          <CSIconButton
            icon={Plus}
            color={colors.primary}
            accessibilityLabel="Cadastrar hospital"
            onPress={() => navigation.navigate("HospitalForm", { mode: "create" })}
          />
        }
      />

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
            <CSHospitalCard hospital={item} onPress={() => abrirDetalhe(item)} />
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
