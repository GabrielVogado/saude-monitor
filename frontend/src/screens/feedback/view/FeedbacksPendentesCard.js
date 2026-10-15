import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { MessageSquareText } from "lucide-react-native";
import CSButton from "../../../components/CSButton";
import { colors, radii, shadows, spacing, typography } from "../../../theme/tokens";
import {
  JANELA_MS,
  dispensarFeedback,
  listarPendencias,
  sincronizarPendenciasDoServidor,
} from "../service/FeedbackNotificationService";

/**
 * Intervalo mínimo entre consultas ao servidor: trocar de aba e voltar à Home não
 * precisa repetir a chamada autenticada; a lista local continua sendo lida sempre.
 */
const INTERVALO_SINCRONIZACAO_MS = 2 * 60 * 1000;
let ultimaSincronizacao = 0;

function doisDigitos(n) {
  return String(n).padStart(2, "0");
}

/**
 * "hoje às 14:30" / "amanhã às 09:05" — o prazo é sempre de até 24h à frente.
 * Formatação manual (hora local) para não depender do Intl do motor JS.
 */
export function descreverPrazo(saidaEm, agora = Date.now()) {
  const prazo = new Date(new Date(saidaEm).getTime() + JANELA_MS);
  if (Number.isNaN(prazo.getTime())) return null;
  const hoje = new Date(agora);
  const mesmoDia =
    prazo.getFullYear() === hoje.getFullYear() &&
    prazo.getMonth() === hoje.getMonth() &&
    prazo.getDate() === hoje.getDate();
  return `${mesmoDia ? "hoje" : "amanhã"} às ${doisDigitos(prazo.getHours())}:${doisDigitos(prazo.getMinutes())}`;
}

/**
 * Avaliações pendentes na Home (E3-03/RN-09, pedido do PO em 04/10/2026).
 *
 * Mostra as visitas encerradas que ainda aceitam feedback, para o usuário que não
 * respondeu na hora, perdeu a notificação ou ficou com o celular descarregado. Cada
 * item abre o formulário; "Agora não" tira a visita da lista sem avaliar. Some sozinho
 * quando não há pendência.
 */
/** Só para testes: zera o intervalo entre sincronizações. */
export function __reiniciarSincronizacao() {
  ultimaSincronizacao = 0;
}

export default function FeedbacksPendentesCard() {
  const navigation = useNavigation();
  const [pendencias, setPendencias] = useState([]);
  // Dispensadas nesta tela: uma leitura que já estava em andamento quando o usuário
  // tocou "Agora não" não pode trazer a visita de volta.
  const dispensadas = useRef(new Set());

  const carregar = useCallback(async () => {
    const mostrar = (lista) =>
      setPendencias(lista.filter((p) => !dispensadas.current.has(p.visitaId)));
    try {
      mostrar(await listarPendencias());
      // Servidor depois: a lista local aparece na hora, e o que só o servidor sabe
      // (visita encerrada com o celular desligado) entra quando a resposta chegar.
      if (Date.now() - ultimaSincronizacao >= INTERVALO_SINCRONIZACAO_MS) {
        ultimaSincronizacao = Date.now();
        await sincronizarPendenciasDoServidor();
        mostrar(await listarPendencias());
      }
    } catch {
      // Lista é conveniência: falha aqui não pode quebrar a Home.
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      // `carregar` engole a falha de propósito (a lista é conveniência): disparo intencional.
      void carregar();
    }, [carregar])
  );

  // Volta ao primeiro plano sem trocar de tela (ex.: celular religado com o app já na
  // Home): a Home não ganha foco de novo, então recarrega aqui.
  useEffect(() => {
    const inscricao = AppState.addEventListener("change", (estado) => {
      if (estado === "active") void carregar();
    });
    return () => inscricao.remove();
  }, [carregar]);

  const avaliar = (pendencia) => {
    navigation.navigate("Feedback", {
      screen: "FeedbackForm",
      params: { visitaId: pendencia.visitaId, hospitalNome: pendencia.hospitalNome },
    });
  };

  const dispensar = async (pendencia) => {
    dispensadas.current.add(pendencia.visitaId);
    setPendencias((atual) => atual.filter((p) => p.visitaId !== pendencia.visitaId));
    await dispensarFeedback(pendencia.visitaId).catch(() => {});
  };

  if (pendencias.length === 0) {
    return null;
  }

  return (
    <View style={styles.card} accessibilityRole="summary">
      <View style={styles.cabecalho}>
        <MessageSquareText
          size={20}
          color={colors.primary}
          importantForAccessibility="no"
          accessibilityElementsHidden
        />
        <Text style={styles.titulo} accessibilityRole="header">
          {pendencias.length === 1 ? "Avaliação pendente" : `${pendencias.length} avaliações pendentes`}
        </Text>
      </View>
      <Text style={styles.subtitulo}>
        Ainda dá tempo de contar como foi. Leva menos de 1 minuto.
      </Text>

      {pendencias.map((pendencia) => {
        const nome = pendencia.hospitalNome || "Sua visita";
        const prazo = descreverPrazo(pendencia.saidaEm);
        return (
          <View key={pendencia.visitaId} style={styles.item}>
            <Text style={styles.hospital} numberOfLines={2}>
              {nome}
            </Text>
            {prazo ? <Text style={styles.prazo}>Responda até {prazo}</Text> : null}
            <View style={styles.acoes}>
              <CSButton
                label="Avaliar"
                variant="primary"
                accessibilityLabel={`Avaliar ${nome}`}
                onPress={() => avaliar(pendencia)}
                style={styles.botaoAvaliar}
              />
              <Pressable
                onPress={() => dispensar(pendencia)}
                accessibilityRole="button"
                accessibilityLabel={`Agora não, dispensar avaliação de ${nome}`}
                hitSlop={8}
                style={styles.botaoDispensar}
              >
                <Text style={styles.textoDispensar}>Agora não</Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.lg,
    padding: spacing.s4,
    marginBottom: spacing.s5,
    ...shadows.cloud1,
  },
  cabecalho: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s2,
    marginBottom: spacing.s1,
  },
  titulo: {
    ...typography.titleMd,
    color: colors.onSurface,
  },
  subtitulo: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.s3,
  },
  item: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineVariant,
    paddingTop: spacing.s3,
    marginTop: spacing.s2,
  },
  hospital: {
    ...typography.labelLg,
    color: colors.onSurface,
  },
  prazo: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: spacing.s1,
  },
  acoes: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s4,
    marginTop: spacing.s3,
  },
  botaoAvaliar: {
    flex: 1,
  },
  botaoDispensar: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.s2,
  },
  textoDispensar: {
    ...typography.labelLg,
    color: colors.primary,
  },
});
