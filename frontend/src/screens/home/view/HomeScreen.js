import React from "react";
import { Image, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MapPin, MessageCircle, ShieldCheck } from "lucide-react-native";
import styles from "./css/HomeStyle";
import { colors } from "../../../theme";
import FeedbacksPendentesCard from "../../feedback/view/FeedbacksPendentesCard";

/**
 * Tela inicial (E6-01): apresentação do app e avaliações pendentes (RN-09).
 *
 * Até 05/10/2026 a Home também era a âncora do ciclo de vida da visita (geofencing,
 * `sincronizarVisitaAtiva` e heartbeat), e só quando a aba Início ganhava foco: quem
 * fazia check-in manual em outra aba ficava sem heartbeat. Isso passou para o
 * `VisitaAtivaSync`, montado na raiz do app (Auditoria Técnica v4.0, §4.2.2).
 */
export default function HomeScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {/* Avaliações que o usuário ainda pode responder (RN-09) — some quando vazio */}
                <FeedbacksPendentesCard />

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
