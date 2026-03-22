import React, {useState} from "react";
import {Alert, Image, StyleSheet, Text, TextInput, TouchableOpacity, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import LoginService from "../service/LoginService";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberDevice, setRememberDevice] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert("Atencao", "Preencha e-mail/usuario e senha.");
            return;
        }

        setLoading(true);

        try {
            const response = await LoginService.login({
                email,
                password,
                rememberDevice,
            });

            Alert.alert(
                "Login realizado",
                `Mensagem: ${response.message}\nE-mail: ${response.email}\nLembrar dispositivo: ${response.rememberDevice ? "Sim" : "Nao"}`
            );
        } catch (error) {
            Alert.alert("Erro no login", error.message || "Erro inesperado.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Imagem institucional no topo */}
            <View style={styles.imageContainer}>
                <Image
                    source={require("../../../../assets/img/doutor.gif")}
                    style={styles.doctorImage}
                />
            </View>

            <Text style={styles.title}>Acessar painel hospitalar</Text>


            {/* Campo de Email com ícone */}
            <View style={styles.inputContainer}>
                <Image
                    source={require("../../../../assets/img/pessoa.png")}
                    style={styles.icon}
                />
                <TextInput
                    style={styles.input}
                    placeholder="E-mail ou Nome de Usuario"
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                />
            </View>

            {/* Campo de Senha com ícone */}
            <View style={styles.inputContainer}>
                <Image
                    source={require("../../../../assets/img/cadeado.png")}
                    style={styles.icon}
                />
                <TextInput
                    style={styles.input}
                    placeholder="Senha"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />
            </View>

            {/* Opções extras */}
            <View style={styles.optionsContainer}>
                <TouchableOpacity
                    style={styles.checkboxContainer}
                    onPress={() => setRememberDevice(!rememberDevice)}
                >
                    <Text style={styles.checkbox}>
                        {rememberDevice ? "☑️" : "⬜️"}
                    </Text>
                    <Text style={styles.optionText}>Lembrar este dispositivo</Text>
                </TouchableOpacity>

                <TouchableOpacity>
                    <Text style={styles.link}>Esqueci minha senha</Text>
                </TouchableOpacity>
            </View>

            {/* Botão Entrar */}
            <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleLogin}
                disabled={loading}
            >
                <Text style={styles.loginButtonText}>
                    {loading ? "Entrando..." : "Entrar no sistema ➜"}
                </Text>
            </TouchableOpacity>

            {/* Aviso LGPD */}
            <Text style={styles.lgpdText}>
                Este sistema utiliza geolocalização para registrar tempos de permanência
                no hospital, seguindo as diretrizes da LGPD. Ao continuar, você concorda
                com o uso de seus dados para monitoramento da experiência e melhoria do atendimento.
            </Text>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: "#fff",
        justifyContent: "flex-start",
    },
    imageContainer: {
        alignItems: "center",
        marginBottom: 15,
    },
    doctorImage: {
        width: 120,
        height: 120,
        resizeMode: "contain",
    },
    title: {
        fontSize: 22,
        fontWeight: "bold",
        marginBottom: 5,
        textAlign: "center",
        color: "#333",
    },
    subtitle: {
        fontSize: 14,
        marginBottom: 20,
        textAlign: "center",
        color: "#666",
    },
    inputContainer: {
        flexDirection: "row",
        alignItems: "center",
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 10,
        marginBottom: 15,
        paddingHorizontal: 10,
        height: 50,
    },
    icon: {
        width: 24,
        height: 24,
        marginRight: 10,
        tintColor: "#333",
    },
    input: {
        flex: 1,
        fontSize: 16,
        color: "#333",
    },
    optionsContainer: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 20,
    },
    checkboxContainer: {
        flexDirection: "row",
        alignItems: "center",
    },
    checkbox: {
        fontSize: 18,
        marginRight: 5,
    },
    optionText: {
        fontSize: 14,
        color: "#333",
    },
    link: {
        fontSize: 14,
        color: "#007BFF",
        textDecorationLine: "underline",
    },
    loginButton: {
        backgroundColor: "#007BFF",
        paddingVertical: 15,
        borderRadius: 10,
        alignItems: "center",
        marginBottom: 20,
    },
    loginButtonDisabled: {
        opacity: 0.6,
    },
    loginButtonText: {
        color: "#fff",
        fontSize: 16,
        fontWeight: "bold",
    },
    lgpdText: {
        fontSize: 12,
        color: "#666",
        textAlign: "center",
        marginTop: 10,
    },
});