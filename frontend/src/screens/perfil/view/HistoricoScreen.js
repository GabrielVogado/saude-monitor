import React, { useCallback, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Building2, History, MessageSquareText, Star } from "lucide-react-native";
import CSHeader from "../../../components/CSHeader";
import CSEmptyState from "../../../components/CSEmptyState";
import { CSLoadingList } from "../../../components/CSLoading";
import VisitaService from "../../visitas/service/VisitaService";
import FeedbackService from "../../feedback/service/FeedbackService";
import PerfilService from "../service/PerfilService";
import { formatarDuracao, formatarData } from "../../../utils/format";
import { colors, spacing, typography, radii } from "../../../theme/tokens";

const ABA_VISITAS = "visitas";
const ABA_FEEDBACKS = "feedbacks";

const STATUS_LABEL = {
  EM_ATENDIMENTO: "Em atendimento",
  SUSPEITA: "Suspeita",
  FINALIZADA: "Finalizada",
  EXPIRADA: "Expirada",
  GPS_INTERROMPIDO: "GPS interrompido",
  SEM_FEEDBACK: "Sem feedback",
};

const ORIGEM_LABEL = {
  GEOFENCE: "Automática",
  MANUAL: "Manual",
};

/**
 * Histórico do usuário logado (E5-03/RN-22 — "apenas os seus").
 *
 * Tela dentro da aba Perfil (PerfilStack). Consome os endpoints já implementados
 * no backend (`GET /api/v1/contas/visitas` e `/api/v1/contas/feedbacks`, §3.5).
 * Exige sessão: se não houver usuário logado, orienta o login (area logada).
 *
 * RN-07: visitas < 2min permanecem no histórico pessoal (`visitaValida = false`),
 * apenas excluídas das estatísticas públicas.
 */
export default function HistoricoScreen({ navigation }) {
  const [aba, setAba] = useState(ABA_VISITAS);
  const [visitas, setVisitas] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [semSessao, setSemSessao] = useState(false);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      const usuario = await PerfilService.usuarioLogado();
      if (!usuario) {
        setSemSessao(true);
        setCarregando(false);
        return;
      }
      setSemSessao(false);
      const [v, f] = await Promise.all([
        VisitaService.listarHistorico({ page: 0, size: 100 }),
        FeedbackService.listarHistorico({ page: 0, size: 100 }),
      ]);
      setVisitas(v?.content || []);
      setFeedbacks(f?.content || []);
    } catch (e) {
      setErro(e?.message || "Não foi possível carregar seu histórico.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const irParaLogin = () => navigation?.navigate?.("Login");

  const renderItemVisita = ({ item }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemIconRow}>
        <View style={styles.itemIconCircle}>
          <Building2 size={18} color={colors.primary} />
        </View>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {item.hospitalNome || "Hospital"}
        </Text>
      </View>

      <Text style={styles.itemDate}>
        {formatarData(item.entrada)}
        {item.saida ? ` · ${formatarDuracao(item.duracaoMinutos)} de permanência` : ""}
      </Text>

      <View style={styles.chipsRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {STATUS_LABEL[item.status] || item.status}
          </Text>
        </View>
        <View style={[styles.badge, styles.badgeSecondary]}>
          <Text style={styles.badgeTextSecondary}>
            {ORIGEM_LABEL[item.origem] || item.origem}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderItemFeedback = ({ item }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemIconRow}>
        <View style={styles.itemIconCircle}>
          <MessageSquareText size={18} color={colors.primary} />
        </View>
        <Text style={styles.itemTitle} numberOfLines={1}>
          Avaliação
        </Text>
      </View>

      <Text style={styles.itemDate}>{formatarData(item.criadoEm)}</Text>

      <View style={styles.feedbackMeta}>
        {typeof item.nota === "number" ? (
          <View style={styles.notaRow}>
            <Star size={14} color={colors.ratingFilled} fill={colors.ratingFilled} />
            <Text style={styles.notaText}>{item.nota.toFixed(1).replace(".", ",")} / 5</Text>
          </View>
        ) : null}
        {item.comentario ? (
          <Text style={styles.comentario} numberOfLines={2}>
            {item.comentario}
          </Text>
        ) : null}
      </View>
    </View>
  );

  const currentItens = aba === ABA_VISITAS ? visitas : feedbacks;

  const renderVazio = () => {
    if (erro) {
      return (
        <CSEmptyState
          icon={History}
          title="Não foi possível carregar"
          message={erro}
          actionLabel="Tentar novamente"
          onAction={carregar}
        />
      );
    }
    return (
      <CSEmptyState
        icon={History}
        title={aba === ABA_VISITAS ? "Nenhuma visita ainda" : "Nenhuma avaliação ainda"}
        message={
          aba === ABA_VISITAS
            ? "Suas visitas a hospitais aparecerão aqui."
            : "Suas avaliações pós-saída aparecerão aqui."
        }
      />
    );
  };

  if (semSessao) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <CSHeader title="Histórico" onBack={() => navigation?.goBack?.()} />
        <View style={styles.semAcessoContainer}>
          <CSEmptyState
            icon={History}
            title="Área logada"
            message="Faça login para ver seu histórico de visitas e avaliações."
            actionLabel="Fazer login"
            onAction={irParaLogin}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <CSHeader title="Histórico" onBack={() => navigation?.goBack?.()} />

      <View style={styles.segmentContainer}>
        {[
          { key: ABA_VISITAS, label: "Visitas" },
          { key: ABA_FEEDBACKS, label: "Avaliações" },
        ].map((s) => {
          const ativo = aba === s.key;
          return (
            <Pressable
              key={s.key}
              style={[styles.segment, ativo && styles.segmentAtivo]}
              onPress={() => setAba(s.key)}
              accessibilityRole="button"
              accessibilityState={{ selected: ativo }}
              accessibilityLabel={`Histórico de ${s.label.toLowerCase()}`}
            >
              <Text style={[styles.segmentText, ativo && styles.segmentTextAtivo]}>
                {s.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {carregando ? (
        <CSLoadingList count={3} />
      ) : (
        <FlatList
          data={currentItens}
          keyExtractor={(item) => item.id}
          key={aba}
          renderItem={aba === ABA_VISITAS ? renderItemVisita : renderItemFeedback}
          ListEmptyComponent={renderVazio}
          contentContainerStyle={styles.listContent}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  semAcessoContainer: { flex: 1, justifyContent: "center" },

  segmentContainer: {
    flexDirection: "row",
    gap: spacing.s2,
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s3,
  },
  segment: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.s3,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainerHigh,
    minHeight: 48,
    justifyContent: "center",
  },
  segmentAtivo: { backgroundColor: colors.primary },
  segmentText: { ...typography.labelLg, color: colors.onSurfaceVariant },
  segmentTextAtivo: { color: colors.onPrimary },

  listContent: {
    paddingHorizontal: spacing.s4,
    paddingBottom: spacing.s6,
    gap: spacing.s3,
    flexGrow: 1,
  },
  itemCard: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.lg,
    padding: spacing.s4,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    gap: spacing.s2,
  },
  itemIconRow: { flexDirection: "row", alignItems: "center", gap: spacing.s2 },
  itemIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  itemTitle: { ...typography.titleMd, color: colors.onSurface, flex: 1 },
  itemDate: { ...typography.bodySm, color: colors.onSurfaceVariant },

  chipsRow: { flexDirection: "row", gap: spacing.s2, flexWrap: "wrap", marginTop: spacing.s1 },
  badge: {
    backgroundColor: colors.primaryContainer,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.s2,
    paddingVertical: 3,
  },
  badgeText: { color: colors.onPrimaryContainer, ...typography.labelMd, fontWeight: "700" },
  badgeSecondary: { backgroundColor: colors.surfaceContainerHigh },
  badgeTextSecondary: { color: colors.onSurfaceVariant, ...typography.labelMd, fontWeight: "700" },

  feedbackMeta: { gap: spacing.s2, marginTop: spacing.s1 },
  notaRow: { flexDirection: "row", alignItems: "center", gap: spacing.s1 },
  notaText: { ...typography.bodyMd, color: colors.onSurface, fontWeight: "600" },
  comentario: { ...typography.bodySm, color: colors.onSurfaceVariant, lineHeight: 18 },
});
