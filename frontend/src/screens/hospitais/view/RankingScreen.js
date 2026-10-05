import React, { useCallback, useState } from "react";
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
import { useRankingHospitais } from "../hooks/useHospitais";

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

/**
 * Ranking público de hospitais (E4-05).
 *
 * Consome `GET /api/v1/hospitais/ranking`, que já devolve a lista ordenada
 * globalmente (nota desc ou tempo asc) com os hospitais sem amostra suficiente
 * (RN-15) ao final. A tela não reordena nada no cliente: apenas troca `ordem`/`tipo`
 * e pagina de forma incremental conforme o usuário rola (`useRankingHospitais`).
 */
export default function RankingScreen({ navigation }) {
  const [ordem, setOrdem] = useState("NOTA");
  const [tipo, setTipo] = useState("");
  const [atualizando, setAtualizando] = useState(false);

  // Cada critério (ordem/tipo) é uma chave própria: a posição no ranking é global, então
  // trocar o critério recomeça da primeira página, e uma página pedida sob o critério
  // anterior é descartada pela biblioteca (antes: `geracaoRef` e `buscandoMaisRef`).
  const { data, error, isPending, isFetchingNextPage, hasNextPage, fetchNextPage, refetch } =
    useRankingHospitais({ ordem, tipo });
  const dados = data ?? [];
  const erro = error && !data ? error.message || "Não foi possível carregar o ranking." : null;

  const atualizar = useCallback(async () => {
    setAtualizando(true);
    try {
      await refetch();
    } finally {
      setAtualizando(false);
    }
  }, [refetch]);

  const carregarMais = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      // A falha de uma página seguinte mantém a lista já visível; rolar até o fim de
      // novo tenta outra vez.
      // `cancelRefetch: false`: um segundo `onEndReached` antes do próximo render (fling
      // rápido) reaproveita a página em voo em vez de cancelá-la e pedir de novo.
      fetchNextPage({ cancelRefetch: false }).catch(() => {});
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const abrirDetalhe = useCallback(
    (hospital) => {
      navigation.navigate("HospitalDetalhe", { id: hospital.id });
    },
    [navigation]
  );

  // ARQ-05: mesma correção da HospitaisScreen — o renderItem inline recriava a
  // navegação por item a cada render, anulando o React.memo do CSHospitalCard.
  const renderItem = useCallback(
    ({ item, index }) => (
      <View style={styles.linha}>
        <View style={styles.posicao}>
          <Text style={styles.posicaoTexto}>{index + 1}º</Text>
        </View>
        <View style={styles.cardWrapper}>
          <CSHospitalCard hospital={item} onPress={abrirDetalhe} />
        </View>
      </View>
    ),
    [abrirDetalhe]
  );

  // Mesma correcao do ListEmptyComponent aplicada na HospitaisScreen.
  const renderVazio = useCallback(() => {
    if (erro) {
      return (
        <CSEmptyState
          icon={Trophy}
          title="Algo deu errado"
          message={erro}
          actionLabel="Tentar novamente"
          onAction={() => refetch()}
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
  }, [erro, refetch]);

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

      {isPending ? (
        <CSLoadingList count={3} />
      ) : (
        <FlatList
          data={dados}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderVazio}
          ListFooterComponent={
            isFetchingNextPage ? (
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
              refreshing={atualizando}
              onRefresh={atualizar}
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
