import React, {useState} from "react";
import {Alert, Image, Text, TextInput, TouchableOpacity, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import LoginService from "../service/LoginService";
import styles from "./css/LoginStyle";

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
