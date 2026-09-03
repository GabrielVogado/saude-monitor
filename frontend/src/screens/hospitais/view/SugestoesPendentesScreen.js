import React, { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CheckCircle, Clock, MapPin, MapPinOff, XCircle } from "lucide-react-native";
import { CSHeader, CSEmptyState, CSLoadingList, CSBadge } from "../../../components";
import { colors, spacing, typography } from "../../../theme/tokens";
import HospitalService from "../service/HospitalService";

const STATUS_FILTROS = [
  { value: "PENDENTE", label: "Pendentes" },
  { value: "APROVADA", label: "Aprovadas" },
  { value: "RECUSADA", label: "Recusadas" },
];

const STATUS_ICON = {
  PENDENTE: Clock,
  APROVADA: CheckCircle,
  RECUSADA: XCircle,
};

const STATUS_VARIANT = {
  PENDENTE: "warning",
  APROVADA: "positive",
  RECUSADA: "neutral",
};

/**
 * Fila de moderação de sugestões públicas de hospitais (E1-06).
 * Acessível apenas para administradores.
 */
export default function SugestoesPendentesScreen({ navigation }) {
  const [status, setStatus] = useState("PENDENTE");
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState(null);

  const carregar = useCallback(
    async (modo = "inicial") => {
      if (modo === "refresh") setRefreshing(true);
      else setCarregando(true);
      setErro(null);

      try {
        const resposta = await HospitalService.listarSugestoes({ status, size: 50 });
        const lista = resposta?.content || resposta || [];
        setDados(lista);
      } catch (e) {
        setErro(e.message || "Não foi possível carregar as sugestões.");
      } finally {
        setCarregando(false);
        setRefreshing(false);
      }
    },
    [status]
  );

  useEffect(() => {
    carregar();
  }, [carregar]);

  const abrirRevisao = (sugestao) => {
    navigation.navigate("RevisarSugestao", { sugestao });
  };

  const renderItem = ({ item }) => {
    const StatusIcon = STATUS_ICON[item.status] || Clock;
    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => abrirRevisao(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.nome}>{item.nome}</Text>
          <CSBadge
            label={statusLabel(item.status)}
            variant={STATUS_VARIANT[item.status] || "neutral"}
          />
        </View>

        <View style={styles.infoRow}>
          <MapPin size={16} color={colors.outline} />
          <Text style={styles.infoText}>
            {item.endereco?.logradouro}, {item.endereco?.cidade} — {item.endereco?.uf}
          </Text>
        </View>

        {item.observacao ? (
          <Text style={styles.observacao} numberOfLines={2}>
            {item.observacao}
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          <StatusIcon size={14} color={colors.outline} />
          <Text style={styles.dataText}>
            Enviada em {new Date(item.criadoEm).toLocaleDateString("pt-BR")}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderVazio = () => {
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

    return (
      <CSEmptyState
        icon={MapPinOff}
        title="Nenhuma sugestão"
        message={`Não há sugestões ${status.toLowerCase()}s no momento.`}
      />
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <CSHeader title="Moderação de sugestões" onBack={() => navigation.goBack()} />

      <View style={styles.filtros}>
        {STATUS_FILTROS.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.filtroChip, status === f.value && styles.filtroChipAtivo]}
            onPress={() => setStatus(f.value)}
          >
            <Text
              style={[
                styles.filtroTexto,
                status === f.value && styles.filtroTextoAtivo,
              ]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {carregando ? (
        <CSLoadingList count={3} />
      ) : (
        <FlatList
          data={dados}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
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

function statusLabel(status) {
  switch (status) {
    case "PENDENTE":
      return "Pendente";
    case "APROVADA":
      return "Aprovada";
    case "RECUSADA":
      return "Recusada";
    default:
      return status;
  }
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  filtros: {
    flexDirection: "row",
    gap: spacing.s2,
    padding: spacing.s4,
  },
  filtroChip: {
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainer,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  filtroChipAtivo: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filtroTexto: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  filtroTextoAtivo: {
    color: colors.onPrimary,
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: spacing.s4,
    paddingBottom: spacing.s6,
    gap: spacing.s3,
    flexGrow: 1,
  },
  card: {
    backgroundColor: colors.surfaceContainer,
    borderRadius: 12,
    padding: spacing.s4,
    gap: spacing.s3,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.s3,
  },
  nome: {
    ...typography.titleMd,
    color: colors.onSurface,
    flex: 1,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.s2,
  },
  infoText: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    flex: 1,
  },
  observacao: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    fontStyle: "italic",
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s2,
    marginTop: spacing.s1,
  },
  dataText: {
    ...typography.bodySm,
    color: colors.outline,
  },
});
