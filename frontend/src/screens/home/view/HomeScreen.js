import React, { useCallback, useEffect, useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import styles from "./css/HomeStyle";
import VisitaService from "../../visitas/service/VisitaService";
import { iniciarGeofencing, sincronizarVisitaAtiva } from "../../visitas/service/GeofencingTaskService";
import { iniciarHeartbeat, pararHeartbeat } from "../../visitas/service/HeartbeatService";

/**
 * Tela inicial (E6-01): apresentação do app.
 *
 * Navegação revisada — a Home deixou de hospedar o card de visita ativa e os acessos
 * rápidos (check-in manual agora é feito na lista de Hospitais e o mapa é uma aba
 * própria). Permanece, porém, como âncora dos serviços de ciclo de vida da visita:
 *
 * - `iniciarGeofencing()` (E2-07/ADR-002): sem a UI, ainda inicia o geofencing nativo
 *   de background para o check-in/checkout automático.
 * - reidrata a visita ativa no foco e mantém `sincronizarVisitaAtiva` + heartbeat
 *   (E2-09) vivos — sem UX visível, preservando o comportamento atual do backend
 *   (expiração/GPS_INTERROMPIDO e checkout automático por geofence).
 */
export default function HomeScreen() {
    const [visitaAtivaId, setVisitaAtivaId] = useState(null);

    useEffect(() => {
        // Inicializa o geofencing nativo (F-03/ADR-002) uma vez, no ciclo de vida global
        // do app — check-in/checkout automático continuam funcionando mesmo sem o card.
        iniciarGeofencing().catch(() => {
            // Sem permissão de localização em background: o usuário ainda pode usar o
            // check-in manual na lista de Hospitais; nada a fazer aqui.
        });
    }, []);

    const carregarVisitaAtiva = useCallback(() => {
        VisitaService.buscarAtiva()
            .then((data) => setVisitaAtivaId(data?.visita?.id || null))
            .catch(() => setVisitaAtivaId(null));
    }, []);

    // Reidrata a visita ativa sempre que a Home ganha foco (anônimo via dispositivoId
    // ou autenticado). Alimenta `sincronizarVisitaAtiva`/heartbeat para manter o
    // checkout automático e a expiração por inatividade funcionando como antes.
    useFocusEffect(
        useCallback(() => {
            carregarVisitaAtiva();
        }, [carregarVisitaAtiva])
    );

    useEffect(() => {
        sincronizarVisitaAtiva(visitaAtivaId);
        if (visitaAtivaId) {
            iniciarHeartbeat(visitaAtivaId);
        } else {
            pararHeartbeat();
        }
    }, [visitaAtivaId]);

    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
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
            </ScrollView>
        </SafeAreaView>
    );
}
