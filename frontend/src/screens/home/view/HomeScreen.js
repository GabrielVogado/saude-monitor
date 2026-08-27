import React, {useCallback, useEffect, useRef, useState} from "react";
import {Alert, Image, Text, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {useFocusEffect} from "@react-navigation/native";
import styles from "./css/HomeStyle";
import VisitaService from "../../visitas/service/VisitaService";
import {iniciarGeofencing, sincronizarVisitaAtiva} from "../../visitas/service/GeofencingTaskService";
import {iniciarHeartbeat, pararHeartbeat} from "../../visitas/service/HeartbeatService";
import CSGeoStatusCard from "../../../components/CSGeoStatusCard";

const DOZE_HORAS_MS = 12 * 60 * 60 * 1000;

export default function HomeScreen() {
    const [visitaAtiva, setVisitaAtiva] = useState(null);
    const promptTipoExibidoRef = useRef(false);

    useEffect(() => {
        VisitaService.buscarAtiva()
            .then((data) => setVisitaAtiva(data?.visita || null))
            .catch(() => setVisitaAtiva(null));

        // Inicializa o geofencing nativo (F-03/ADR-002) uma vez, no ciclo de vida global do
        // app — mesmo padrão de inicialização usado hoje pelo `GeoLocalizacaoService`.
        iniciarGeofencing().catch(() => {
            // Sem permissão de localização em background: o usuário ainda pode usar o
            // check-in manual (`CheckinManualScreen`); nada a fazer aqui.
        });
    }, []);

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
            setVisitaAtiva(null);
        } catch {
            // mantém o card; erro é tratado pelo usuário ao tentar novamente
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
                {visitaAtiva && (
                    <CSGeoStatusCard
                        visita={visitaAtiva}
                        onEncerrar={encerrarVisita}
                        onSinalizarTipo={abrirPromptTipoPermanencia}
                    />
                )}

                {/* Tag da versão */}
                {/*<View style={styles.versionTag}>
                    <Text style={styles.versionText}>Versão Enterprise 2.4</Text>
                </View>*/}

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

                {/* Tópicos com ícones e descrição */}
                <View style={styles.topicsContainer}>
                    {/* Analytics de Lotação com ícone */}
                    <View style={styles.topicBlock}>
                        <View style={styles.topicHeader}>
                            <Image
                                source={require("../../../../assets/img/grafico-de-pizza.png")}
                                style={styles.topicIcon}
                            />
                            <Text style={styles.topicTitle}>Analytics de Lotação</Text>
                        </View>
                        <Text style={styles.topicDescription}>
                            Veja lotação e tempo de espera por setor do hospital em dashboards dinâmicos.
                        </Text>
                    </View>

                    {/* Geolocalização Automática */}
                    <View style={styles.topicBlock}>
                        <View style={styles.topicHeader}>
                            <Image
                                source={require("../../../../assets/img/localizacao.png")}
                                style={styles.topicIcon}
                            />
                            <Text style={styles.topicTitle}>Geolocalização Automática</Text>
                        </View>
                        <Text style={styles.topicDescription}>
                            Acompanhe check-in e check-out automaticamente via sensores de presença e GPS.
                        </Text>
                    </View>

                    {/* Feedback do Paciente */}
                    <View style={styles.topicBlock}>
                        <View style={styles.topicHeader}>
                            <Image
                                source={require("../../../../assets/img/bubble-chat.png")}
                                style={styles.topicIcon}
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
                    />
                </View>
            </View>
        </SafeAreaView>
    );
}
