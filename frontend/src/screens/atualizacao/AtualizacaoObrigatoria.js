import React, { useCallback, useEffect, useState } from "react";
import { AppState, Linking, StyleSheet, View } from "react-native";
import { Download } from "lucide-react-native";
import { CSEmptyState } from "../../components";
import { colors } from "../../theme";
import ConfiguracaoRemota, { obterEnderecosDaLoja, isAtualizacaoObrigatoria } from "../../services/ConfiguracaoRemota";

/**
 * Tela de atualização obrigatória (APP-03).
 *
 * Confere a versão mínima ao abrir o app e sempre que ele volta ao primeiro plano. Abaixo
 * da mínima, o app inteiro dá lugar a esta tela, com o botão para a loja; o geofencing e a
 * fila offline continuam no fundo. Sem rede ou sem resposta, o app segue normal: a
 * conferência nunca impede o uso por falha dela mesma.
 */
export default function AtualizacaoObrigatoria({ children }) {
  const [bloqueado, setBloqueado] = useState(false);

  const conferirVersao = useCallback(async () => {
    try {
      const configuracao = await ConfiguracaoRemota.obterConfiguracao();
      setBloqueado(isAtualizacaoObrigatoria(configuracao));
    } catch {
      // Mantém o que já se sabia: sem rede, nem bloqueia nem libera quem já estava bloqueado.
    }
  }, []);

  useEffect(() => {
    void conferirVersao();
    const inscricao = AppState.addEventListener("change", (estado) => {
      if (estado === "active") {
        void conferirVersao();
      }
    });
    return () => inscricao.remove();
  }, [conferirVersao]);

  const abrirLoja = useCallback(async () => {
    const [app, web] = obterEnderecosDaLoja();
    try {
      await Linking.openURL(app);
    } catch {
      await Linking.openURL(web).catch(() => {});
    }
  }, []);

  if (!bloqueado) {
    return children;
  }

  return (
    <View style={styles.tela} accessibilityViewIsModal>
      <CSEmptyState
        icon={Download}
        title="Atualize o Radar Saúde"
        message="Esta versão do app não é mais aceita. Instale a versão nova na loja para continuar."
        actionLabel="Atualizar agora"
        onAction={abrirLoja}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tela: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
});
