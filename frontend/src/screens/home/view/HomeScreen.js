import React from "react";
import {Image, Text, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import styles from "./css/HomeStyle";

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
