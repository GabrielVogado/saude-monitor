import React, { useCallback, useState } from "react";
import {
  Alert,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { LogIn, MapPin, ShieldCheck, Trash2, UserPlus } from "lucide-react-native";
import PerfilService from "../service/PerfilService";
import LoginService from "../../auth/service/LoginService";
import CSLoading, { CSLoadingList } from "../../../components/CSLoading";
import CSEmptyState from "../../../components/CSEmptyState";
import { colors } from "../../../theme";
import styles from "./css/PerfilStyle";

/**
 * Tela Perfil → Dados e Privacidade (Épico 05 — E5-01, E5-02, E5-04).
 *
 * - E5-01: exibe e permite revogar a permissão de localização.
 * - E5-02: link à Política de Privacidade (2 toques a partir do app).
 * - E5-04: quando não há conta, orienta Cadastro/Login (conta é opcional).
 * - F0-05: botão de exclusão de conta (dados pessoais), com anonimização das
 *   estatísticas.
 *
 * E6-03/E6-04: acessibilidade (role/labels) e estados de loading/erro com retry.
 */
export default function PerfilScreen({ navigation }) {
  const [usuario, setUsuario] = useState(null);
  const [permissao, setPermissao] = useState("undetermined");
  const [carregando, setCarregando] = useState(false);
  const [carregandoInicial, setCarregandoInicial] = useState(true);
  const [erroInicial, setErroInicial] = useState(null);

  const carregar = useCallback(async () => {
    setCarregandoInicial(true);
    setErroInicial(null);
    try {
      const [u, p] = await Promise.all([
        PerfilService.usuarioLogado(),
        PerfilService.permissaoLocalizacao(),
      ]);
      setUsuario(u);
      setPermissao(p);
    } catch (e) {
      setErroInicial(e?.message || "Não foi possível carregar seu perfil.");
    } finally {
      setCarregandoInicial(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar])
  );

  const permissaoConcedida = permissao === "granted";

  // Rotas internas do PerfilStack (Login, Cadastro, Privacidade). Navega no próprio
  // stack — o antigo `getParent()` (Tab) não resolve essas rotas e "engolia" o toque.
  const irPara = (rota) => {
    navigation?.navigate?.(rota);
  };

  const solicitarPermissao = async () => {
    setCarregando(true);
    try {
      const status = await PerfilService.solicitarPermissaoLocalizacao();
      setPermissao(status);
      if (status === "granted") {
        Alert.alert("Permissão concedida", "O aplicativo poderá usar sua localização para detectar visitas.");
      } else {
        Alert.alert("Permissão negada", "Você pode continuar usando o app; apenas o monitoramento automático ficará desativado.");
      }
    } finally {
      setCarregando(false);
    }
  };

  const revogarPermissao = () => {
    Alert.alert(
      "Revogar permissão de localização",
      "Ao revogar, o monitoramento automático de visitas para. Você continua usando o restante do aplicativo normalmente.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Revogar",
          style: "destructive",
          onPress: async () => {
            try {
              // Expo/RN não expõe desligar programaticamente a permissão do sistema;
              // apontamos para as configurações do dispositivo (recomendado) e refletimos
              // o estado local. E5-01/05: revogação sem bloquear o acesso ao app.
              const status = await PerfilService.permissaoLocalizacao();
              setPermissao(status);
              Alert.alert(
                "Revogar no sistema",
                "Para desativar a permissão de localização, use as configurações de privacidade do dispositivo. Após alterar, volte a esta tela."
              );
            } catch (error) {
              Alert.alert("Erro", error.message);
            }
          },
        },
      ]
    );
  };

  const excluirConta = () => {
    Alert.alert(
      "Excluir conta e dados pessoais",
      "Seus dados pessoais (nome, e-mail, telefone) serão removidos, e suas visitas/feedbacks serão anonimizados. Esta ação é irreversível.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Excluir",
          style: "destructive",
          onPress: async () => {
            setCarregando(true);
            try {
              await LoginService.excluirConta();
              setUsuario(null);
              Alert.alert("Conta excluída", "Seus dados pessoais foram removidos com sucesso.");
            } catch (error) {
              Alert.alert("Falha ao excluir conta", error.message);
            } finally {
              setCarregando(false);
            }
          },
        },
      ]
    );
  };

  const deslogar = async () => {
    await PerfilService.deslogar();
    setUsuario(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Perfil e Privacidade</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {carregandoInicial && <CSLoadingList count={2} />}

        {!carregandoInicial && erroInicial && (
          <CSEmptyState
            icon={ShieldCheck}
            title="Não foi possível carregar"
            message={erroInicial}
            actionLabel="Tentar novamente"
            onAction={carregar}
          />
        )}

        {!carregandoInicial && !erroInicial && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Minha conta</Text>

              {usuario ? (
                <>
                  <View
                    style={styles.avatar}
                    accessible={false}
                    accessibilityElementsHidden
                  >
                    <Text style={styles.avatarText}>
                      {(usuario.nome || usuario.fullName || "U").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.userName}>{usuario.nome || usuario.fullName || "Usuário"}</Text>
                  <Text style={styles.userEmail}>{usuario.email || ""}</Text>

                  <TouchableOpacity
                    style={styles.buttonSecondary}
                    onPress={deslogar}
                    accessibilityRole="button"
                    accessibilityLabel="Sair da conta"
                  >
                    <Text style={styles.buttonTextSecondary}>Sair da conta</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <View style={styles.semAcesso}>
                  <ShieldCheck size={34} color={colors.outline} />
                  <Text style={styles.semAcessoTitle}>Conta opcional</Text>
                  <Text style={styles.semAcessoText}>
                    Criar uma conta é opcional — você pode usar o aplicativo sem se cadastrar.
                    Faça login para acessar seus dados e o histórico.
                  </Text>
                  <View style={styles.semAcessoActions}>
                    <TouchableOpacity
                      style={[styles.button, styles.actionButton]}
                      onPress={() => irPara("Login")}
                      accessibilityRole="button"
                      accessibilityLabel="Entrar"
                    >
                      <LogIn size={18} color={colors.onPrimary} />
                      <Text style={styles.buttonText}> Entrar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.buttonSecondary, styles.actionButton]}
                      onPress={() => irPara("Cadastro")}
                      accessibilityRole="button"
                      accessibilityLabel="Criar conta"
                    >
                      <UserPlus size={18} color={colors.onSurface} />
                      <Text style={styles.buttonTextSecondary}> Criar conta</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Dados e Privacidade</Text>

              <View style={styles.row}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <MapPin size={17} color={colors.primary} />
                  <Text style={[styles.rowLabel, { marginLeft: 8 }]}>Localização</Text>
                </View>
                <View style={[styles.status, permissaoConcedida ? styles.statusAtivo : styles.statusInativo]}>
                  <Text style={permissaoConcedida ? styles.statusAtivoText : styles.statusInativoText}>
                    {permissaoConcedida ? "Ativa" : "Desativada"}
                  </Text>
                </View>
              </View>

              {!permissaoConcedida ? (
                <TouchableOpacity
                  style={styles.button}
                  onPress={solicitarPermissao}
                  disabled={carregando}
                  accessibilityRole="button"
                  accessibilityLabel="Permitir localização"
                  accessibilityState={{ disabled: carregando }}
                >
                  <Text style={styles.buttonText}>Permitir localização</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.buttonSecondary}
                  onPress={revogarPermissao}
                  accessibilityRole="button"
                  accessibilityLabel="Revogar permissão de localização"
                >
                  <Text style={styles.buttonTextSecondary}>Revogar permissão de localização</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.footerNote}>
                A permissão é usada apenas para detectar automaticamente suas visitas a hospitais
                (geofencing). Negar ou revogar não bloqueia a consulta pública nem o restante do app.
              </Text>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Termos e dados pessoais</Text>
              <TouchableOpacity
                onPress={() => irPara("Privacidade")}
                accessibilityRole="button"
                accessibilityLabel="Ler Política de Privacidade e Termos de Uso"
              >
                <Text style={styles.link}>Ler Política de Privacidade e Termos de Uso</Text>
              </TouchableOpacity>

              {usuario && (
                <TouchableOpacity
                  style={styles.dangerButton}
                  onPress={excluirConta}
                  disabled={carregando}
                  accessibilityRole="button"
                  accessibilityLabel="Excluir conta e dados pessoais"
                  accessibilityState={{ disabled: carregando }}
                >
                  <Trash2 size={17} color={colors.error} />
                  <Text style={styles.dangerButtonText}> Excluir conta e dados pessoais</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}