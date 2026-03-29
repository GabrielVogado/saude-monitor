import React, {useState} from "react";
import {
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {Globe, HelpCircle, Lock, Share2, ShieldCheck} from "lucide-react-native";
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
            const response = await LoginService.login({email, password, rememberDevice});

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
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardAvoidingView}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>

                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Hospital Monitor</Text>
                    </View>

                    {/* Main Card */}
                    <View style={styles.card}>

                        {/* Doctor GIF */}
                        <View style={styles.imageContainer}>
                            <Image
                                source={require("../../../../assets/img/doutor.gif")}
                                style={styles.doctorImage}
                            />
                        </View>

                        <Text style={styles.title}>Acessar painel hospitalar</Text>
                        <Text style={styles.subtitle}>
                            Entre com suas credenciais institucionais para acessar o painel.
                        </Text>

                        {/* Form */}
                        <View style={styles.form}>

                            {/* Email */}
                            <Text style={styles.label}>E-MAIL OU USUÁRIO</Text>
                            <View style={styles.inputContainer}>
                                <Image
                                    source={require("../../../../assets/img/pessoa.png")}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="E-mail ou Nome de Usuario"
                                    placeholderTextColor="#94A3B8"
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            {/* Senha */}
                            <Text style={styles.label}>SENHA</Text>
                            <View style={styles.inputContainer}>
                                <Image
                                    source={require("../../../../assets/img/cadeado.png")}
                                    style={styles.inputIcon}
                                />
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor="#94A3B8"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry
                                />
                            </View>

                            {/* Options */}
                            <View style={styles.optionsContainer}>
                                <TouchableOpacity
                                    style={styles.checkboxContainer}
                                    onPress={() => setRememberDevice(!rememberDevice)}
                                >
                                    <View style={[styles.checkbox, rememberDevice && styles.checkboxActive]} />
                                    <Text style={styles.optionText}>Lembrar este dispositivo</Text>
                                </TouchableOpacity>

                                <TouchableOpacity>
                                    <Text style={styles.link}>Esqueci minha senha</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Login Button */}
                            <TouchableOpacity
                                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                                onPress={handleLogin}
                                disabled={loading}
                            >
                                <Text style={styles.loginButtonText}>
                                    {loading ? "Entrando..." : "Entrar no sistema ➜"}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Compliance Info */}
                        <View style={styles.complianceBox}>
                            <View style={styles.complianceIcon}>
                                <ShieldCheck size={18} color="#0085C7" />
                            </View>
                            <Text style={styles.complianceText}>
                                Este sistema utiliza geolocalização seguindo as diretrizes da{" "}
                                <Text style={styles.complianceHighlight}>LGPD</Text>
                                . Ao continuar, você concorda com o uso de seus dados para monitoramento da experiência hospitalar.
                            </Text>
                        </View>
                    </View>

                    {/* Security Badges */}
                    <View style={styles.securityBadges}>
                        <View style={styles.badgeItem}>
                            <Lock size={14} color="#64748B" />
                            <Text style={styles.badgeText}>END-TO-END ENCRYPTED</Text>
                        </View>
                        <View style={styles.badgeItem}>
                            <ShieldCheck size={14} color="#64748B" />
                            <Text style={styles.badgeText}>HIPAA COMPLIANT</Text>
                        </View>
                    </View>

                    {/* Social / Support Icons */}
                    <View style={styles.socialIcons}>
                        <View style={styles.iconWrapper}>
                            <TouchableOpacity style={styles.socialBtn}>
                                <Globe size={24} color="#1E293B" />
                            </TouchableOpacity>
                            <Text style={styles.iconLabel}>GLOBAL</Text>
                        </View>
                        <View style={styles.iconWrapper}>
                            <TouchableOpacity style={styles.socialBtn}>
                                <Share2 size={24} color="#1E293B" />
                            </TouchableOpacity>
                            <Text style={styles.iconLabel}>PARTILHAR</Text>
                        </View>
                        <View style={styles.iconWrapper}>
                            <TouchableOpacity style={styles.socialBtn}>
                                <HelpCircle size={24} color="#1E293B" />
                            </TouchableOpacity>
                            <Text style={styles.iconLabel}>SUPORTE</Text>
                        </View>
                    </View>

                    {/* Simple Footer Links */}
                    <View style={styles.simpleFooter}>
                        <Text style={styles.simpleFooterLink}>Termos</Text>
                        <View style={styles.dot} />
                        <Text style={styles.simpleFooterLink}>Cookies</Text>
                        <View style={styles.dot} />
                        <Text style={styles.simpleFooterLink}>Privacidade</Text>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
