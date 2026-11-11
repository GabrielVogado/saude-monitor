import React from "react";
import {KeyboardAvoidingView, Platform, ScrollView, Text, View} from "react-native";
import {SafeAreaView} from "react-native-safe-area-context";
import styles from "./css/LoginStyle";

/** Moldura comum das telas de login, recuperação de senha e confirmação de e-mail. */
export default function TelaAuth({children}) {
    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.keyboardAvoidingView}
            >
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
