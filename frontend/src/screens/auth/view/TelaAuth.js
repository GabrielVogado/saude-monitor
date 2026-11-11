import React from "react";
import {KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import {ShieldCheck} from "lucide-react-native";
import {colors} from "../../../theme";
import styles from "./css/LoginStyle";

/** Moldura comum das telas de login, recuperação de senha e confirmação de e-mail. */
export default function TelaAuth({children}) {
    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.keyboardAvoidingView}>
                <ScrollView contentContainerStyle={styles.scrollContent}>
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Pulseira Verde</Text>
                    </View>
                    {children}
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

/** Link "Voltar para o login" das telas que trabalham com código por e-mail. */
export function BotaoVoltarAoLogin({navigation}) {
    return (
        <TouchableOpacity
            style={styles.semContaButton}
            onPress={() => navigation?.navigate?.("Login")}
            accessibilityRole="button"
            accessibilityLabel="Voltar para o login"
        >
            <Text style={styles.semContaText}>Voltar para o login</Text>
        </TouchableOpacity>
    );
}

/** Aviso de validade do código enviado por e-mail. */
export function AvisoCodigoDeUsoUnico() {
    return (
        <View style={styles.complianceBox}>
            <View style={styles.complianceIcon}>
                <ShieldCheck size={18} color={colors.primary} />
            </View>
            <Text style={styles.complianceText}>
                Por segurança, o código expira em 15 minutos e só pode ser usado uma vez.
            </Text>
        </View>
    );
}
