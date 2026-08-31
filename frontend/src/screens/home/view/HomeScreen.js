import React, {useCallback, useEffect, useRef, useState} from "react";
import {Alert, Image, Text, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {useFocusEffect} from "@react-navigation/native";
import styles from "./css/HomeStyle";
import VisitaService from "../../visitas/service/VisitaService";
import {iniciarGeofencing, sincronizarVisitaAtiva} from "../../visitas/service/GeofencingTaskService";
import {iniciarHeartbeat, pararHeartbeat} from "../../visitas/service/HeartbeatService";
import {agendarFeedback} from "../../feedback/service/FeedbackNotificationService";
import CSGeoStatusCard from "../../../components/CSGeoStatusCard";
import CSButton from "../../../components/CSButton";
import CSLoading from "../../../components/CSLoading";

const DOZE_HORAS_MS = 12 * 60 * 60 * 1000;

export default function HomeScreen({ navigation }) {
    const [visitaAtiva, setVisitaAtiva] = useState(null);
    const [carregandoVisita, setCarregandoVisita] = useState(true);
    const [erroVisita, setErroVisita] = useState(null);
    const promptTipoExibidoRef = useRef(false);

    useEffect(() => {
        // Inicializa o geofencing nativo (F-03/ADR-002) uma vez, no ciclo de vida global do
        // app — mesmo padrão de inicialização usado hoje pelo `GeoLocalizacaoService`.
        iniciarGeofencing().catch(() => {
            // Sem permissão de localização em background: o usuário ainda pode usar o
            // check-in manual (`CheckinManualScreen`); nada a fazer aqui.
        });
    }, []);

    const carregarVisitaAtiva = useCallback(() => {
        setCarregandoVisita(true);
        setErroVisita(null);
        VisitaService.buscarAtiva()
            .then((data) => setVisitaAtiva(data?.visita || null))
            .catch(() => {
                setErroVisita("Não foi possível consultar sua visita ativa.");
                setVisitaAtiva(null);
            })
            .finally(() => setCarregandoVisita(false));
    }, []);

    // Relê a visita ativa sempre que a Home ganha foco (ex.: ao voltar do check-in
    // manual/do mapa) — no modo anônimo isso reidrata o card pelo dispositivoId (§3.3).
    useFocusEffect(
        useCallback(() => {
            carregarVisitaAtiva();
        }, [carregarVisitaAtiva])
    );

    useEffect(() => {
        sincronizarVisitaAtiva(visitaAtiva?.id);

        if (visitaAtiva?.id && visitaAtiva.status !== "GPS_INTERROMPIDO") {
            iniciarHeartbeat(visitaAtiva.id);
        } else {
            pararHeartbeat();
        }

        if (!visitaAtiva) {
            promptTipoExibidoRef.current = false;
        }
    }, [visitaAtiva]);

    // Prompt de tipo de permanência (E2-10/RN-24): ao voltar para a Home com uma visita
    // ativa há mais de 12h e ainda sem `tipoPermanencia`, pergunta em 1 toque se é
    // observação ou internação. Optou-se por `Alert.alert` ao focar a tela (em vez de
    // agendar uma notificação local com `expo-notifications`) por ser o padrão já usado
    // em todo o app para confirmações (ex.: `CheckinManualScreen`, `LoginScreen`) e por
    // não depender de o app estar em background no momento exato das 12h.
    useFocusEffect(
        useCallback(() => {
            if (
                !visitaAtiva ||
                visitaAtiva.tipoPermanencia ||
                visitaAtiva.status === "GPS_INTERROMPIDO" ||
                promptTipoExibidoRef.current
            ) {
                return;
            }

            const entrada = visitaAtiva.entrada ? new Date(visitaAtiva.entrada).getTime() : null;
            if (entrada && Date.now() - entrada >= DOZE_HORAS_MS) {
                promptTipoExibidoRef.current = true;
                abrirPromptTipoPermanencia();
            }
        }, [visitaAtiva])
    );

    const definirTipoPermanencia = async (tipo) => {
        if (!visitaAtiva) return;
        try {
            await VisitaService.definirTipoPermanencia(visitaAtiva.id, tipo);
            setVisitaAtiva((anterior) => (anterior ? { ...anterior, tipoPermanencia: tipo } : anterior));
        } catch {
            // usuário pode tentar novamente pelo botão "Estou em observação ou internado" no card
        }
    };

    const abrirPromptTipoPermanencia = () => {
        Alert.alert(
            "Tipo de permanência",
            "Você está em observação ou internado?",
            [
                { text: "Observação", onPress: () => definirTipoPermanencia("OBSERVACAO") },
                { text: "Internação", onPress: () => definirTipoPermanencia("INTERNACAO") },
            ]
        );
    };

    const encerrarVisita = async () => {
        if (!visitaAtiva) return;
        try {
            await VisitaService.checkout(visitaAtiva.id, { encerramentoManual: true });
            // Épico 03 — E3-01: agenda o pedido de feedback ~1–5 min após a saída.
            agendarFeedback({
                visitaId: visitaAtiva.id,
                hospitalId: visitaAtiva.hospitalId,
                hospitalNome: visitaAtiva.hospitalNome || visitaAtiva.hospital?.nome,
                saidaEm: new Date().toISOString(),
            });
            setVisitaAtiva(null);
        } catch {
            // mantém o card; erro é tratado pelo usuário ao tentar novamente
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {/* E6-04: estado de carregamento da visita ativa */}
                {carregandoVisita && (
                    <View accessibilityRole="progressbar" accessibilityLabel="Carregando visita ativa">
                        <CSLoading height={120} radius={16} />
                    </View>
                )}

                {/* E6-04: estado de erro com retry */}
                {!carregandoVisita && erroVisita && (
                    <View style={styles.errorBox}>
                        <Text style={styles.errorText}>{erroVisita}</Text>
                        <CSButton label="Tentar novamente" onPress={carregarVisitaAtiva} variant="secondary" />
                    </View>
                )}

                {!carregandoVisita && !erroVisita && visitaAtiva && (
                    <CSGeoStatusCard
                        visita={visitaAtiva}
                        onEncerrar={encerrarVisita}
                        onSinalizarTipo={abrirPromptTipoPermanencia}
                    />
                )}

                {/* E6-01: acessos rápidos (antes no Drawer) — check-in manual e mapa */}
                <View style={styles.actionsRow}>
                    <CSButton
                        label="Check-in manual"
                        onPress={() => navigation?.navigate?.("CheckinManual")}
                        variant="secondary"
                        style={styles.actionButton}
                    />
                    <CSButton
                        label="Ver mapa"
                        onPress={() => navigation?.navigate?.("Geolocalizacao")}
                        variant="tertiary"
                        style={styles.actionButton}
                    />
                </View>

                {/* Headline destacada */}
                <Text style={styles.headline}>
                    MONITORE A EXPERIÊNCIA{" "}
                    <Text style={styles.highlight}>HOSPITALAR</Text>{" "}
                    EM TEMPO REAL
                </Text>

                {/* Texto explicativo */}
                <Text style={styles.description}>
                    Nosso sistema oferece visibilidade total sobre a jornada do paciente.
                    Visualize lotação, tempos de espera e realize check-in/check-out
                    automáticos através de geolocalização precisa (GPS, BLE, beacons),
                    integrando dashboards em tempo real para uma gestão hospitalar eficiente.
                </Text>

                {/* Tópicos com ícones e descrição (E6-03: imagens decorativas ocultas do leitor) */}
                <View style={styles.topicsContainer}>
                    <View style={styles.topicBlock}>
                        <View style={styles.topicHeader}>
                            <Image
                                source={require("../../../../assets/img/grafico-de-pizza.png")}
                                style={styles.topicIcon}
                                importantForAccessibility="no"
                                accessibilityElementsHidden
                            />
                            <Text style={styles.topicTitle}>Analytics de Lotação</Text>
                        </View>
                        <Text style={styles.topicDescription}>
                            Veja lotação e tempo de espera por setor do hospital em dashboards dinâmicos.
                        </Text>
                    </View>

                    <View style={styles.topicBlock}>
                        <View style={styles.topicHeader}>
                            <Image
                                source={require("../../../../assets/img/localizacao.png")}
                                style={styles.topicIcon}
                                importantForAccessibility="no"
                                accessibilityElementsHidden
                            />
                            <Text style={styles.topicTitle}>Geolocalização Automática</Text>
                        </View>
                        <Text style={styles.topicDescription}>
                            Acompanhe check-in e check-out automaticamente via sensores de presença e GPS.
                        </Text>
                    </View>

                    <View style={styles.topicBlock}>
                        <View style={styles.topicHeader}>
                            <Image
                                source={require("../../../../assets/img/bubble-chat.png")}
                                style={styles.topicIcon}
                                importantForAccessibility="no"
                                accessibilityElementsHidden
                            />
                            <Text style={styles.topicTitle}>Feedback do Paciente</Text>
                        </View>
                        <Text style={styles.topicDescription}>
                            Colete e analise feedbacks estruturados dos pacientes logo após o atendimento.
                        </Text>
                    </View>
                </View>

                <View style={styles.imagePlaceholder}>
                    <Image
                        source={require("../../../../assets/img/home_melhorado.png")}
                        style={styles.homeImage}
                        importantForAccessibility="no"
                        accessibilityElementsHidden
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}