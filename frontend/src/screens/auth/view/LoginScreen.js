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
                                    accessibilityRole="checkbox"
                                    accessibilityState={{checked: rememberDevice}}
                                    accessibilityLabel="Lembrar este dispositivo"
                                >
                                    <View style={[styles.checkbox, rememberDevice && styles.checkboxActive]} />
                                    <Text style={styles.optionText}>Lembrar este dispositivo</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    accessibilityRole="button"
                                    accessibilityLabel="Esqueci minha senha"
                                >
                                    <Text style={styles.link}>Esqueci minha senha</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Login Button */}
                            <TouchableOpacity
                                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                                onPress={handleLogin}
                                disabled={loading}
                                accessibilityRole="button"
                                accessibilityLabel={loading ? "Entrando no sistema" : "Entrar no sistema"}
                                accessibilityState={{disabled: loading, busy: loading}}
                            >
                                <Text style={styles.loginButtonText}>
                                    {loading ? "Entrando..." : "Entrar no sistema ➜"}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        {/* Compliance Info */}
                        <View style={styles.complianceBox}>
                            <View style={styles.complianceIcon}>
                                <ShieldCheck size={18} color={colors.primary} />
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
                            <Lock size={14} color={colors.onSurfaceVariant} />
                            <Text style={styles.badgeText}>END-TO-END ENCRYPTED</Text>
                        </View>
                        <View style={styles.badgeItem}>
                            <ShieldCheck size={14} color={colors.onSurfaceVariant} />
                            <Text style={styles.badgeText}>LGPD COMPLIANT</Text>
                        </View>
                    </View>

                    {/* Social / Support Icons */}
                    <View style={styles.socialIcons}>
                        <View style={styles.iconWrapper}>
                            <TouchableOpacity style={styles.socialBtn} accessibilityRole="button" accessibilityLabel="Site global">
                                <Globe size={24} color={colors.onSurface} />
                            </TouchableOpacity>
                            <Text style={styles.iconLabel}>GLOBAL</Text>
                        </View>
                        <View style={styles.iconWrapper}>
                            <TouchableOpacity style={styles.socialBtn} accessibilityRole="button" accessibilityLabel="Partilhar">
                                <Share2 size={24} color={colors.onSurface} />
                            </TouchableOpacity>
                            <Text style={styles.iconLabel}>PARTILHAR</Text>
                        </View>
                        <View style={styles.iconWrapper}>
                            <TouchableOpacity style={styles.socialBtn} accessibilityRole="button" accessibilityLabel="Suporte">
                                <HelpCircle size={24} color={colors.onSurface} />
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
                        <TouchableOpacity onPress={() => navigation.navigate?.("Privacidade")} accessibilityRole="link" accessibilityLabel="Política de Privacidade">
                            <Text style={styles.link}>Privacidade</Text>
                        </TouchableOpacity>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
