import React from "react";
import {Image, StyleSheet, Text, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";

export default function HomeScreen() {
    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.content}>
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

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    content: { flex: 1, justifyContent: "flex-start", alignItems: "flex-start", paddingHorizontal: 20, paddingTop: 30 },
    versionTag: { backgroundColor: "#e0f7fa", paddingVertical: 6, paddingHorizontal: 15, borderRadius: 20, marginBottom: 15 },
    versionText: { color: "#007BFF", fontSize: 14, fontWeight: "600" },
    headline: { fontSize: 22, fontWeight: "bold", color: "#333", textAlign: "left", marginBottom: 15, letterSpacing: 1 },
    highlight: { color: "#3bdcf1", fontWeight: "bold" },
    description: { fontSize: 14, color: "#555", textAlign: "left", marginBottom: 20, lineHeight: 20 },
    topicsContainer: { marginBottom: 20, width: "100%" },
    topicBlock: { marginBottom: 15 },
    topicHeader: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
    topicIcon: { width: 20, height: 20, marginRight: 8, resizeMode: "contain" },
    topicTitle: { fontSize: 15, fontWeight: "bold", color: "#333" },
    topicDescription: { fontSize: 13, color: "#555", lineHeight: 18 },
    imagePlaceholder: { width: "100%", height: 150, backgroundColor: "#fff", borderWidth: 1, borderColor: "#fff", borderRadius: 10, justifyContent: "center", alignItems: "center", marginBottom: 30, overflow: "hidden" },
    homeImage: { width: "100%", height: "100%", resizeMode: "cover" },
    loginButton: { backgroundColor: "#3bdcf1", paddingVertical: 15, paddingHorizontal: 30, borderRadius: 10, alignItems: "center", shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 4, elevation: 3, alignSelf: "flex-start" },
    loginButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
});