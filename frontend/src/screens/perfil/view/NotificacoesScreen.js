import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Bell, BellOff } from "lucide-react-native";
import CSHeader from "../../../components/CSHeader";
import CSButton from "../../../components/CSButton";
import PerfilService from "../service/PerfilService";
import {
  solicitarPermissaoNotificacao,
  statusPermissaoNotificacao,
} from "../../../services/NotificacaoPermissao";
import { colors, radii, spacing, typography } from "../../../theme/tokens";

/**
 * Perfil → Notificações (E6-05 — opt-in dedicado).
 *
 * Até aqui a permissão só era pedida no meio do fluxo de check-out (E3-01), quando o
 * usuário mal sabia por quê. Esta tela explica a finalidade antes de pedir e permite
 * mudar de ideia depois, com a decisão auditada no backend (E5-05 / art. 8º §5º
 * da LGPD).
 *
 * Nem o SO nem o app desligam a permissão programaticamente: quando ela já foi
 * decidida, encaminhamos às configurações do sistema e resincronizamos no retorno
 * (`AppState`).
 */
export default function NotificacoesScreen({ navigation }) {
  const [permissao, setPermissao] = useState("undetermined");
  const [carregando, setCarregando] = useState(true);
  const [processando, setProcessando] = useState(false);
  const [erro, setErro] = useState(null);

  const permissaoRef = useRef(permissao);
  permissaoRef.current = permissao;

  const concedida = permissao === "granted";

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErro(null);
    try {
      setPermissao(await statusPermissaoNotificacao());
    } catch (e) {
      setErro(e?.message || "Não foi possível verificar a permissão de notificações.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  /** Relê a permissão e audita a decisão apenas quando ela mudou de fato. */
  const sincronizar = useCallback(async () => {
    try {
      const status = await statusPermissaoNotificacao();
      if (status === permissaoRef.current) {
        return;
      }
      setPermissao(status);
      await PerfilService.atualizarConsentimento({ notificacoes: status === "granted" });
    } catch {
      // A permissão do SO já vale no dispositivo; a próxima volta ao app tenta de novo.
    }
  }, []);

  useEffect(() => {
    const inscricao = AppState.addEventListener("change", (estado) => {
      if (estado === "active") {
        sincronizar();
      }
    });
    return () => inscricao?.remove?.();
  }, [sincronizar]);

  const ativar = async () => {
    setProcessando(true);
    setErro(null);
    try {
      const autorizado = await solicitarPermissaoNotificacao();
      setPermissao(autorizado ? "granted" : "denied");
      await PerfilService.atualizarConsentimento({ notificacoes: autorizado });

      // O sistema só pergunta uma vez: se já foi negada, o caminho é as configurações.
      if (!autorizado) {
        await Linking.openSettings();
      }
    } catch (e) {
      setErro(
        e?.message ||
          "Não foi possível ativar as notificações. Tente pelas configurações do dispositivo."
      );
    } finally {
      setProcessando(false);
    }
  };

  const desativar = async () => {
    setProcessando(true);
    setErro(null);
    try {
      // Registra a decisão antes de sair do app: mesmo que o usuário não conclua nas
      // configurações do SO, a manifestação de vontade já vale (art. 8º §5º).
      await PerfilService.atualizarConsentimento({ notificacoes: false });
      await Linking.openSettings();
    } catch {
      setErro(
        "Não foi possível abrir as configurações. Desative as notificações do aplicativo nas configurações do dispositivo."
      );
    } finally {
      setProcessando(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <CSHeader title="Notificações" onBack={() => navigation?.goBack?.()} />

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <View style={styles.statusRow}>
            <View style={styles.iconCircle}>
              {concedida ? (
                <Bell size={20} color={colors.primary} />
              ) : (
                <BellOff size={20} color={colors.onSurfaceVariant} />
              )}
            </View>
            <Text style={styles.cardTitle}>Lembretes de avaliação</Text>
            <View style={[styles.badge, concedida ? styles.badgeAtivo : styles.badgeInativo]}>
              <Text style={concedida ? styles.badgeTextAtivo : styles.badgeTextInativo}>
                {carregando ? "Verificando" : concedida ? "Ativas" : "Desativadas"}
              </Text>
            </View>
          </View>

          <Text style={styles.paragrafo}>
            Depois que você sai de um hospital, enviamos um único convite para avaliar o
            atendimento — e, se não responder, um lembrete. Sua avaliação é anônima e
            ajuda quem vai precisar do mesmo serviço.
          </Text>

          <Text style={styles.paragrafo}>
            É opcional: sem as notificações, você continua podendo avaliar pelo próprio
            aplicativo e usar todo o restante normalmente.
          </Text>

          {concedida ? (
            <CSButton
              label="Desativar notificações"
              variant="secondary"
              loading={processando}
              onPress={desativar}
              accessibilityLabel="Desativar notificações"
            />
          ) : (
            <CSButton
              label="Ativar notificações"
              loading={processando}
              disabled={carregando}
              onPress={ativar}
              accessibilityLabel="Ativar notificações"
            />
          )}

          {erro ? (
            <Text style={styles.erro} accessibilityLiveRegion="polite">
              {erro}
            </Text>
          ) : null}
        </View>

        <Text style={styles.rodape}>
          Você pode mudar essa escolha a qualquer momento, aqui ou nas configurações do
          seu dispositivo.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  content: { padding: spacing.s4, gap: spacing.s4 },
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.outlineVariant,
    padding: spacing.s4,
    gap: spacing.s3,
  },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.s2 },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { ...typography.titleMd, color: colors.onSurface, flex: 1 },
  badge: {
    borderRadius: radii.xs,
    paddingHorizontal: spacing.s2,
    paddingVertical: 3,
  },
  badgeAtivo: { backgroundColor: colors.primaryContainer },
  badgeInativo: { backgroundColor: colors.surfaceContainerHigh },
  badgeTextAtivo: { ...typography.labelMd, color: colors.onPrimaryContainer, fontWeight: "700" },
  badgeTextInativo: { ...typography.labelMd, color: colors.onSurfaceVariant, fontWeight: "700" },
  paragrafo: { ...typography.bodyMd, color: colors.onSurfaceVariant, lineHeight: 20 },
  erro: { ...typography.bodySm, color: colors.error },
  rodape: { ...typography.bodySm, color: colors.onSurfaceVariant, textAlign: "center" },
});
