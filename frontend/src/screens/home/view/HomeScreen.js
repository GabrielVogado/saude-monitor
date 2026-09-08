import React, { useCallback, useEffect, useState } from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { MapPin, MessageCircle, ShieldCheck } from "lucide-react-native";
import styles from "./css/HomeStyle";
import { colors } from "../../../theme";
import VisitaService from "../../visitas/service/VisitaService";
import { iniciarGeofencing, sincronizarVisitaAtiva } from "../../visitas/service/GeofencingTaskService";
import { iniciarHeartbeat, pararHeartbeat } from "../../visitas/service/HeartbeatService";
import { preservarSeSemConexao } from "../../../utils/alertas";

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

    // Achado de code-review (08/09/2026): o mesmo padrão corrigido em
    // HospitaisScreen/HospitalDetalheScreen existia aqui. Uma oscilação de conexão
    // durante um foco da Home não pode zerar `visitaAtivaId` — isso alimenta
    // `sincronizarVisitaAtiva`/heartbeat abaixo, e zerar por engano pararia
    // silenciosamente o heartbeat (E2-09) de uma visita geofence real e ativa.
    const carregarVisitaAtiva = useCallback(() => {
        VisitaService.buscarAtiva()
            .then((data) => setVisitaAtivaId(data?.visita?.id || null))
            .catch((e) => preservarSeSemConexao(e, setVisitaAtivaId));
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
                    CUIDAMOS DE VOCÊ{" "}
                    <Text style={styles.highlight}>ANTES, DURANTE E DEPOIS</Text>{" "}
                    DA VISITA
                </Text>

                {/* Texto explicativo */}
                <Text style={styles.description}>
                    Quando você chega a um hospital, a gente percebe sozinho — sem precisar
                    abrir o app. Na saída, pedimos sua opinião em menos de um minuto. Assim,
                    todo mundo pode ver quais hospitais atendem melhor.
                </Text>

                {/* Tópicos com ícones e descrição (E6-03: imagens decorativas ocultas do leitor) */}
                <View style={styles.topicsContainer}>
                    <View style={styles.topicBlock}>
                        <View style={styles.topicHeader}>
                            <MapPin
                                size={20}
                                color={colors.primary}
                                style={styles.topicIcon}
                                importantForAccessibility="no"
                                accessibilityElementsHidden
                            />
                            <Text style={styles.topicTitle}>Detecção automática</Text>
                        </View>
                        <Text style={styles.topicDescription}>
                            Assim que você entra num hospital, o app percebe sozinho e começa a
                            contar o tempo — você não precisa apertar nada.
                        </Text>
                    </View>

                    <View style={styles.topicBlock}>
                        <View style={styles.topicHeader}>
                            <MessageCircle
                                size={20}
                                color={colors.primary}
                                style={styles.topicIcon}
                                importantForAccessibility="no"
                                accessibilityElementsHidden
                            />
                            <Text style={styles.topicTitle}>Feedback rápido e opcional</Text>
                        </View>
                        <Text style={styles.topicDescription}>
                            Depois da sua visita, perguntamos rapidinho como foi. Leva menos de
                            um minuto e você pode pular quando quiser.
                        </Text>
                    </View>

                    <View style={styles.topicBlock}>
                        <View style={styles.topicHeader}>
                            <ShieldCheck
                                size={20}
                                color={colors.primary}
                                style={styles.topicIcon}
                                importantForAccessibility="no"
                                accessibilityElementsHidden
                            />
                            <Text style={styles.topicTitle}>Avaliação pública e transparente</Text>
                        </View>
                        <Text style={styles.topicDescription}>
                            Veja a nota e o tempo médio de espera de cada hospital, calculados a
                            partir de avaliações reais de outras pessoas.
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
