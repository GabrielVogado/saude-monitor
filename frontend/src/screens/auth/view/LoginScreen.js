import React, {useState} from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {HeartHandshake, Lock, Mail, ShieldCheck, Users} from "lucide-react-native";
import LoginService from "../service/LoginService";
import {colors} from "../../../theme";
import styles from "./css/LoginStyle";

export default function LoginScreen({navigation}) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [rememberDevice, setRememberDevice] = useState(false);
    const [loading, setLoading] = useState(false);

    // Após o login bem-sucedido volta para a área logada: a tela Perfil (Padrao-UI-UX
    // v2.0 §4.1 — estado de sucesso do Login/Cadastro "Navega para Perfil"). É lá que o
    // usuário vê os dados da conta e o histórico de visitas/feedbacks (E5-03/RN-22).
    // O PerfilStack está dentro da aba Perfil; "Perfil" é a rota raiz desse stack, então
    // o navigate volta à tela Perfil, cujo `useFocusEffect` recarrega o usuário logado.
    const redirectToAreaLogada = () => {
        navigation?.navigate?.("Perfil");
    };

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            Alert.alert("Atencao", "Preencha e-mail/usuario e senha.");
            return;
        }

        setLoading(true);

        try {
            await LoginService.login({email, password, rememberDevice});
            redirectToAreaLogada();
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
                        <Text style={styles.headerTitle}>Clinical Sanctuary</Text>
                    </View>

                    {/* Main Card */}
                    <View style={styles.card}>

                        <View style={styles.imageContainer}>
                            <HeartHandshake size={44} color={colors.primary} />
                        </View>

                        <Text style={styles.title}>Sua conta</Text>
                        <Text style={styles.subtitle}>
                            Entre para acompanhar seu histórico de visitas e suas avaliações.
                        </Text>

                        {/* Form */}
                        <View style={styles.form}>

                            {/* Email */}
                            <Text style={styles.label}>E-MAIL OU USUÁRIO</Text>
                            <View style={styles.inputContainer}>
                                <Mail size={20} color={colors.outline} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="E-mail ou Nome de Usuario"
                                    placeholderTextColor={colors.outline}
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            {/* Senha */}
                            <Text style={styles.label}>SENHA</Text>
                            <View style={styles.inputContainer}>
                                <Lock size={20} color={colors.outline} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor={colors.outline}
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
                                    accessibilityRole="checkbox"
                                    accessibilityState={{checked: rememberDevice}}
                                    accessibilityLabel="Lembrar este dispositivo"
                                >
                                    <View style={[styles.checkbox, rememberDevice && styles.checkboxActive]} />
                                    <Text style={styles.optionText}>Lembrar este dispositivo</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Login Button */}
                            <TouchableOpacity
                                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                                onPress={handleLogin}
                                disabled={loading}
                                accessibilityRole="button"
                                accessibilityLabel={loading ? "Entrando" : "Entrar"}
                                accessibilityState={{disabled: loading, busy: loading}}
                            >
                                <Text style={styles.loginButtonText}>
                                    {loading ? "Entrando…" : "Entrar"}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.semContaButton}
                                onPress={() => navigation.goBack?.()}
                                accessibilityRole="button"
                                accessibilityLabel="Continuar sem conta"
                            >
                                <Text style={styles.semContaText}>Continuar sem conta</Text>
                            </TouchableOpacity>
                            <Text style={styles.semContaHelper}>
                                Você pode usar o app sem se cadastrar. A conta serve só para guardar
                                seu histórico e suas avaliações.
                            </Text>
                        </View>

                        {/* Compliance Info */}
                        <View style={styles.complianceBox}>
                            <View style={styles.complianceIcon}>
                                <ShieldCheck size={18} color={colors.primary} />
                            </View>
                            <Text style={styles.complianceText}>
                                Suas avaliações são anônimas e agregadas por hospital, seguindo a{" "}
                                <Text style={styles.complianceHighlight}>LGPD</Text>.
                            </Text>
                        </View>
                    </View>

                    {/* Security Badges */}
                    <View style={styles.securityBadges}>
                        <View style={styles.badgeItem}>
                            <ShieldCheck size={14} color={colors.onSurfaceVariant} />
                            <Text style={styles.badgeText}>LGPD</Text>
                        </View>
                        <View style={styles.badgeItem}>
                            <Lock size={14} color={colors.onSurfaceVariant} />
                            <Text style={styles.badgeText}>Criptografia ponta a ponta</Text>
                        </View>
                        <View style={styles.badgeItem}>
                            <Users size={14} color={colors.onSurfaceVariant} />
                            <Text style={styles.badgeText}>Dados anônimos e agregados</Text>
                        </View>
                    </View>

                    {/* Footer */}
                    <View style={styles.simpleFooter}>
                        <Text style={styles.simpleFooterLink}>Termos</Text>
                        <View style={styles.dot} />
                        <TouchableOpacity onPress={() => navigation.navigate?.("Privacidade")} accessibilityRole="link" accessibilityLabel="Política de Privacidade">
                            <Text style={styles.link}>Privacidade</Text>
                        </TouchableOpacity>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
