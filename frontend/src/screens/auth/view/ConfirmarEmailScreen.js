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
import {KeyRound, Mail, ShieldCheck} from "lucide-react-native";
import LoginService from "../service/LoginService";
import {colors} from "../../../theme";
import styles from "./css/LoginStyle";

/**
 * Confirmação obrigatória de e-mail no cadastro (10/09/2026): sem confirmar, o login é
 * recusado (403 EMAIL_NAO_CONFIRMADO). Alcançada de dois lugares — sucesso do cadastro
 * (`UserScreen`) e o próprio `LoginScreen`, quando o login tropeça nesse bloqueio — os
 * dois já chegam com o e-mail via `route.params.email`.
 */
export default function ConfirmarEmailScreen({navigation, route}) {
    const [email, setEmail] = useState(route?.params?.email?.trim() || "");
    const [codigo, setCodigo] = useState("");
    const [loading, setLoading] = useState(false);
    const [reenviando, setReenviando] = useState(false);

    const handleConfirmar = async () => {
        if (!email.trim() || !codigo.trim()) {
            Alert.alert("Atenção", "Informe seu e-mail e o código recebido.");
            return;
        }

        setLoading(true);
        try {
            await LoginService.confirmarEmail({email: email.trim(), codigo: codigo.trim()});
            Alert.alert("Pronto", "E-mail confirmado com sucesso. Faça login para continuar.");
            navigation?.replace?.("Login");
        } catch (error) {
            Alert.alert("Erro", error.message || "Não foi possível confirmar o e-mail.");
        } finally {
            setLoading(false);
        }
    };

    const handleReenviar = async () => {
        if (!email.trim()) {
            Alert.alert("Atenção", "Informe seu e-mail.");
            return;
        }

        setReenviando(true);
        try {
            await LoginService.reenviarConfirmacaoEmail(email.trim());
            Alert.alert(
                "Verifique seu e-mail",
                "Se o e-mail existir e ainda não estiver confirmado, você receberá um novo código."
            );
        } catch (error) {
            Alert.alert("Erro", error.message || "Não foi possível reenviar o código agora.");
        } finally {
            setReenviando(false);
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

                        <Text style={styles.title}>Confirme seu e-mail</Text>
                        <Text style={styles.subtitle}>
                            Enviamos um código de 6 dígitos para o e-mail do seu cadastro. Digite-o
                            abaixo para liberar o login.
                        </Text>

                        <View style={styles.form}>
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

                            <TouchableOpacity
                                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                                onPress={handleConfirmar}
                                disabled={loading}
                                accessibilityRole="button"
                                accessibilityLabel={loading ? "Confirmando" : "Confirmar"}
                                accessibilityState={{disabled: loading, busy: loading}}
                            >
                                <Text style={styles.loginButtonText}>
                                    {loading ? "Confirmando…" : "Confirmar"}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.semContaButton}
                                onPress={handleReenviar}
                                disabled={reenviando}
                                accessibilityRole="button"
                                accessibilityLabel={reenviando ? "Reenviando código" : "Reenviar código"}
                            >
                                <Text style={styles.semContaText}>
                                    {reenviando ? "Reenviando…" : "Reenviar código"}
                                </Text>
                            </TouchableOpacity>

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
