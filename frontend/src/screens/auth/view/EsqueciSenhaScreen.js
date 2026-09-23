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
import {KeyRound, Lock, Mail, ShieldCheck} from "lucide-react-native";
import LoginService from "../service/LoginService";
import {colors} from "../../../theme";
import styles from "./css/LoginStyle";

/**
 * "Esqueci minha senha" (E8-05/BUG-03): pede o código por e-mail, depois confirma o
 * código e a nova senha. Duas etapas numa única tela — mesmo padrão de tela única com
 * estado local que o `LoginScreen` já usa.
 */
export default function EsqueciSenhaScreen({navigation}) {
    const [etapa, setEtapa] = useState("email");
    const [email, setEmail] = useState("");
    const [codigo, setCodigo] = useState("");
    const [novaSenha, setNovaSenha] = useState("");
    const [confirmarSenha, setConfirmarSenha] = useState("");
    const [loading, setLoading] = useState(false);

    const handleEnviarCodigo = async () => {
        if (!email.trim()) {
            Alert.alert("Atenção", "Informe seu e-mail.");
            return;
        }

        setLoading(true);
        try {
            await LoginService.esqueciSenha(email.trim());
            setEtapa("codigo");
            Alert.alert(
                "Verifique seu e-mail",
                "Se o e-mail existir, você receberá um código de 6 dígitos para redefinir sua senha."
            );
        } catch (error) {
            Alert.alert("Erro", error.message || "Não foi possível enviar o código agora.");
        } finally {
            setLoading(false);
        }
    };

    const handleRedefinirSenha = async () => {
        if (!codigo.trim() || !novaSenha.trim() || !confirmarSenha.trim()) {
            Alert.alert("Atenção", "Preencha o código e a nova senha.");
            return;
        }
        if (novaSenha !== confirmarSenha) {
            Alert.alert("Atenção", "As senhas não coincidem.");
            return;
        }

        setLoading(true);
        try {
            await LoginService.redefinirSenha({email: email.trim(), codigo: codigo.trim(), novaSenha});
            Alert.alert("Pronto", "Senha redefinida com sucesso. Faça login com a nova senha.");
            navigation?.replace?.("Login");
        } catch (error) {
            Alert.alert("Erro", error.message || "Não foi possível redefinir a senha.");
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

                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Clinical Sanctuary</Text>
                    </View>

                    <View style={styles.card}>

                        <View style={styles.imageContainer}>
                            <KeyRound size={44} color={colors.primary} />
                        </View>

                        <Text style={styles.title}>Esqueci minha senha</Text>
                        <Text style={styles.subtitle}>
                            {etapa === "email"
                                ? "Informe o e-mail da sua conta para receber um código de redefinição."
                                : `Digite o código enviado para ${email.trim()} e escolha sua nova senha.`}
                        </Text>

                        <View style={styles.form}>
                            {etapa === "email" ? (
                                <>
                                    <Text style={styles.label}>E-MAIL</Text>
                                    <View style={styles.inputContainer}>
                                        <Mail size={20} color={colors.outline} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="seu-email@exemplo.com"
                                            placeholderTextColor={colors.outline}
                                            value={email}
                                            onChangeText={setEmail}
                                            keyboardType="email-address"
                                            autoCapitalize="none"
                                        />
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                                        onPress={handleEnviarCodigo}
                                        disabled={loading}
                                        accessibilityRole="button"
                                        accessibilityLabel={loading ? "Enviando código" : "Enviar código"}
                                        accessibilityState={{disabled: loading, busy: loading}}
                                    >
                                        <Text style={styles.loginButtonText}>
                                            {loading ? "Enviando…" : "Enviar código"}
                                        </Text>
                                    </TouchableOpacity>
                                </>
                            ) : (
                                <>
                                    <Text style={styles.label}>CÓDIGO (6 DÍGITOS)</Text>
                                    <View style={styles.inputContainer}>
                                        <KeyRound size={20} color={colors.outline} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="000000"
                                            placeholderTextColor={colors.outline}
                                            value={codigo}
                                            onChangeText={setCodigo}
                                            keyboardType="number-pad"
                                            maxLength={6}
                                        />
                                    </View>

                                    <Text style={styles.label}>NOVA SENHA</Text>
                                    <View style={styles.inputContainer}>
                                        <Lock size={20} color={colors.outline} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Nova senha"
                                            placeholderTextColor={colors.outline}
                                            value={novaSenha}
                                            onChangeText={setNovaSenha}
                                            secureTextEntry
                                        />
                                    </View>

                                    <Text style={styles.label}>CONFIRMAR NOVA SENHA</Text>
                                    <View style={styles.inputContainer}>
                                        <Lock size={20} color={colors.outline} style={styles.inputIcon} />
                                        <TextInput
                                            style={styles.input}
                                            placeholder="Confirmar nova senha"
                                            placeholderTextColor={colors.outline}
                                            value={confirmarSenha}
                                            onChangeText={setConfirmarSenha}
                                            secureTextEntry
                                        />
                                    </View>

                                    <TouchableOpacity
                                        style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                                        onPress={handleRedefinirSenha}
                                        disabled={loading}
                                        accessibilityRole="button"
                                        accessibilityLabel={loading ? "Redefinindo senha" : "Redefinir senha"}
                                        accessibilityState={{disabled: loading, busy: loading}}
                                    >
                                        <Text style={styles.loginButtonText}>
                                            {loading ? "Redefinindo…" : "Redefinir senha"}
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.semContaButton}
                                        onPress={() => setEtapa("email")}
                                        accessibilityRole="button"
                                        accessibilityLabel="Reenviar código"
                                    >
                                        <Text style={styles.semContaText}>Reenviar código</Text>
                                    </TouchableOpacity>
                                </>
                            )}

                            <TouchableOpacity
                                style={styles.semContaButton}
                                onPress={() => navigation?.navigate?.("Login")}
                                accessibilityRole="button"
                                accessibilityLabel="Voltar para o login"
                            >
                                <Text style={styles.semContaText}>Voltar para o login</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.complianceBox}>
                            <View style={styles.complianceIcon}>
                                <ShieldCheck size={18} color={colors.primary} />
                            </View>
                            <Text style={styles.complianceText}>
                                Por segurança, o código expira em 15 minutos e só pode ser usado uma vez.
                            </Text>
                        </View>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}
