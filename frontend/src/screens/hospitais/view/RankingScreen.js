import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Trophy } from "lucide-react-native";
import {
  CSHeader,
  CSHospitalCard,
  CSEmptyState,
  CSLoadingList,
  CSChip,
} from "../../../components";
import { colors, spacing, typography } from "../../../theme/tokens";
import HospitalService from "../service/HospitalService";

const ORDENS = [
  { value: "NOTA", label: "Melhor nota" },
  { value: "TEMPO", label: "Menor tempo" },
];

const TIPO_FILTROS = [
  { value: "", label: "Todos" },
  { value: "PUBLICO", label: "Público" },
  { value: "PRIVADO", label: "Privado" },
  { value: "FILANTROPICO", label: "Filantrópico" },
];

const TAMANHO_PAGINA = 20;

/**
 * Ranking público de hospitais (E4-05).
 *
 * Consome `GET /api/v1/hospitais/ranking`, que já devolve a lista ordenada
 * globalmente (nota desc ou tempo asc) com os hospitais sem amostra suficiente
 * (RN-15) ao final. A tela não reordena nada no cliente: apenas troca `ordem`/`tipo`
 * e pagina de forma incremental conforme o usuário rola.
 */
export default function RankingScreen({ navigation }) {
  const [ordem, setOrdem] = useState("NOTA");
  const [tipo, setTipo] = useState("");
  const [dados, setDados] = useState([]);
  const [pagina, setPagina] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(
    async (modo = "inicial") => {
      if (modo === "refresh") setRefreshing(true);
      else setCarregando(true);
      setErro(null);

      try {
        const resposta = await HospitalService.ranking({
          ordem,
          tipo,
          page: 0,
          size: TAMANHO_PAGINA,
        });
        setDados(resposta?.content || []);
        setPagina(resposta?.page ?? 0);
        setTotalPaginas(resposta?.totalPages ?? 0);
      } catch (e) {
        setErro(e.message || "Não foi possível carregar o ranking.");
        setDados([]);
      } finally {
        setCarregando(false);
        setRefreshing(false);
      }
    },
    [ordem, tipo]
  );

  // Recarrega do zero sempre que o critério de ordenação ou o filtro mudam —
  // a posição no ranking é global, então paginar em cima da lista antiga mentiria.
  useEffect(() => {
    carregar();
  }, [carregar]);

  const carregarMais = async () => {
    if (carregando || carregandoMais || pagina + 1 >= totalPaginas) {
      return;
    }

    setCarregandoMais(true);
    try {
      const proxima = pagina + 1;
      const resposta = await HospitalService.ranking({
        ordem,
        tipo,
        page: proxima,
        size: TAMANHO_PAGINA,
      });
      setDados((atual) => [...atual, ...(resposta?.content || [])]);
      setPagina(resposta?.page ?? proxima);
      setTotalPaginas(resposta?.totalPages ?? totalPaginas);
    } catch (e) {
      setErro(e.message || "Não foi possível carregar mais hospitais.");
    } finally {
      setCarregandoMais(false);
    }
  };

  const renderVazio = () => {
    if (erro) {
      return (
        <CSEmptyState
          icon={Trophy}
          title="Algo deu errado"
          message={erro}
          actionLabel="Tentar novamente"
          onAction={() => carregar()}
        />
      );
    }

    return (
      <CSEmptyState
        icon={Trophy}
        title="Ranking ainda em formação"
        message="Assim que os hospitais tiverem avaliações suficientes, eles aparecem aqui."
      />
    );
  };

  const legenda =
    ordem === "NOTA"
      ? "Ordenado pela nota média das avaliações."
      : "Ordenado pelo menor tempo mediano de atendimento.";

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <CSHeader
        title="Ranking de hospitais"
        onBack={navigation?.goBack ? () => navigation.goBack() : undefined}
      />

      <View style={styles.filtros}>
        <View style={styles.chipsRow}>
          {ORDENS.map((o) => (
            <CSChip
              key={o.value}
              label={o.label}
              accessibilityLabel={`Ordenar por ${o.label.toLowerCase()}`}
              selected={ordem === o.value}
              onPress={() => setOrdem(o.value)}
            />
          ))}
        </View>

        <View style={styles.chipsRow}>
          {TIPO_FILTROS.map((f) => (
            <CSChip
              key={f.value || "todos"}
              label={f.label}
              accessibilityLabel={`Filtrar por ${f.label.toLowerCase()}`}
              selected={tipo === f.value}
              onPress={() => setTipo(f.value)}
            />
          ))}
        </View>

        <Text style={styles.legenda}>{legenda}</Text>
      </View>

      {carregando ? (
        <CSLoadingList count={3} />
      ) : (
        <FlatList
          data={dados}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => (
            <View style={styles.linha}>
              <View style={styles.posicao}>
                <Text style={styles.posicaoTexto}>{index + 1}º</Text>
              </View>
              <View style={styles.cardWrapper}>
                <CSHospitalCard
                  hospital={item}
                  onPress={() => navigation.navigate("HospitalDetalhe", { id: item.id })}
                />
              </View>
            </View>
          )}
          ListEmptyComponent={renderVazio}
          ListFooterComponent={
            carregandoMais ? (
              <ActivityIndicator
                style={styles.rodape}
                color={colors.primary}
                accessibilityLabel="Carregando mais hospitais"
              />
            ) : null
          }
          onEndReachedThreshold={0.4}
          onEndReached={carregarMais}
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
  filtros: {
    paddingHorizontal: spacing.s4,
    paddingBottom: spacing.s3,
    gap: spacing.s3,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s2,
  },
  legenda: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  listContent: {
    paddingHorizontal: spacing.s4,
    paddingBottom: spacing.s6,
    gap: spacing.s4,
    flexGrow: 1,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s3,
  },
  posicao: {
    minWidth: 32,
    alignItems: "center",
  },
  posicaoTexto: {
    ...typography.titleMd,
    color: colors.primary,
  },
  cardWrapper: { flex: 1 },
  rodape: { paddingVertical: spacing.s4 },
});
