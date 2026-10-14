import React, {useState} from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    ArrowLeft,
    ArrowRight,
    Eye,
    EyeOff,
    Lock,
    Mail,
    Phone,
    User,
    UserPlus
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import UserService from '../service/UserService';
import {colors} from '../../../theme';
import CSRodapeLegal, {CSAvisoLgpd} from '../../../components/CSRodapeLegal';
import styles from './css/UserStyle';
import {abrirLinkLegal, URL_POLITICA_PRIVACIDADE, URL_TERMOS_USO, VERSAO_TERMOS} from '../../../config/linksLegais';


const HospitalRegisterScreen = ({navigation}) => {
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [agreeTerms, setAgreeTerms] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleCadastro = async () => {
        if (!fullName.trim() || !email.trim() || !password) {
            Alert.alert('Campos obrigatorios', 'Preencha nome completo, email e senha.');
            return;
        }

        if (!agreeTerms) {
            Alert.alert('Termos de uso', 'Voce precisa aceitar os termos para continuar.');
            return;
        }

        try {
            setIsSubmitting(true);

            await UserService.registro({
                fullName,
                email,
                phone,
                password,
                consentimento: { termosUso: true, versaoTermos: VERSAO_TERMOS },
            });

            // Confirmação obrigatória de e-mail (10/09/2026): sem confirmar, o login é
            // recusado. Leva direto para a tela de confirmação em vez de só avisar e
            // deixar o usuário descobrir sozinho no próximo login.
            const emailCadastrado = email.trim();
            setFullName('');
            setEmail('');
            setPhone('');
            setPassword('');
            setAgreeTerms(false);
            Alert.alert('Cadastro realizado', 'Enviamos um código de confirmação para o seu e-mail.');
            navigation?.navigate?.('ConfirmarEmail', { email: emailCadastrado });
        } catch (error) {
            Alert.alert('Falha no cadastro', error.message || 'Nao foi possivel concluir o cadastro.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.keyboardAvoidingView}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>

                    {/* Header with Back Button Placeholder */}
                    <View style={styles.header}>
                        <TouchableOpacity
                            style={styles.backBtn}
                            onPress={() => navigation?.goBack?.()}
                            accessibilityRole="button"
                            accessibilityLabel="Voltar"
                        >
                            <ArrowLeft size={24} color={colors.primary} style={styles.headerBackIcon} />
                        </TouchableOpacity>
                        <View style={styles.headerSpacer} />
                    </View>

                    {/* Main Card */}
                    <View style={styles.card}>
                        <View style={styles.iconCircle}>
                            <View style={styles.innerIcon}>
                                <UserPlus size={32} color={colors.primary} />
                            </View>
                        </View>

                        <Text style={styles.title}>Crie sua conta</Text>
                        <Text style={styles.subtitle}>
                            Guarde seu histórico de visitas e suas avaliações. O cadastro é
                            opcional — você já pode usar o app sem ele.
                        </Text>

                        {/* Form */}
                        <View style={styles.form}>

                            {/* Full Name */}
                            <Text style={styles.label}>NOME COMPLETO</Text>
                            <View style={styles.inputContainer}>
                                <User size={20} color={colors.outline} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Seu nome completo"
                                    placeholderTextColor={colors.outline}
                                    value={fullName}
                                    onChangeText={setFullName}
                                />
                            </View>

                            {/* Email */}
                            <Text style={styles.label}>E-MAIL</Text>
                            <View style={styles.inputContainer}>
                                <Mail size={20} color={colors.outline} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="seu@email.com"
                                    placeholderTextColor={colors.outline}
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            {/* Phone */}
                            <Text style={styles.label}>TELEFONE (OPCIONAL)</Text>
                            <View style={styles.inputContainer}>
                                <Phone size={20} color={colors.outline} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="(11) 99999-9999"
                                    placeholderTextColor={colors.outline}
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                />
                            </View>


                            {/* Password */}
                            <Text style={styles.label}>SENHA</Text>
                            <View style={styles.inputContainer}>
                                <Lock size={20} color={colors.outline} style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor={colors.outline}
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    accessibilityRole="button"
                                    accessibilityLabel={showPassword ? "Ocultar senha" : "Mostrar senha"}
                                >
                                    {showPassword ? (
                                        <EyeOff size={20} color={colors.outline} />
                                    ) : (
                                        <Eye size={20} color={colors.outline} />
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Terms & Conditions */}
                            <View style={styles.termsContainer}>
                                <TouchableOpacity
                                    style={[styles.checkbox, agreeTerms && styles.checkboxActive]}
                                    onPress={() => setAgreeTerms(!agreeTerms)}
                                    accessibilityRole="checkbox"
                                    accessibilityState={{checked: agreeTerms}}
                                    accessibilityLabel="Aceito os Termos de Uso e a Política de Privacidade"
                                />
                                <Text style={styles.termsText}>
                                    Concordo com os{" "}
                                    <Text
                                        style={styles.linkText}
                                        onPress={() => abrirLinkLegal(URL_TERMOS_USO)}
                                        accessibilityRole="link"
                                    >
                                        Termos de Uso
                                    </Text>{" "}
                                    e a{" "}
                                    <Text
                                        style={styles.linkText}
                                        onPress={() => abrirLinkLegal(URL_POLITICA_PRIVACIDADE)}
                                        accessibilityRole="link"
                                    >
                                        Política de Privacidade
                                    </Text>{" "}
                                    do Radar Saúde.
                                </Text>
                            </View>

                            {/* Register Button */}
                            <TouchableOpacity
                                style={[styles.registerButton, isSubmitting && styles.registerButtonDisabled]}
                                onPress={handleCadastro}
                                disabled={isSubmitting}
                                accessibilityRole="button"
                                accessibilityLabel={isSubmitting ? "Enviando cadastro" : "Criar conta"}
                                accessibilityState={{disabled: isSubmitting, busy: isSubmitting}}
                            >
                                <Text style={styles.registerButtonText}>
                                    {isSubmitting ? 'Enviando...' : 'Criar conta'}
                                </Text>
                                <ArrowRight size={20} color={colors.onPrimary} style={styles.registerButtonIcon} />
                            </TouchableOpacity>
                        </View>

                        <CSAvisoLgpd />
                    </View>

                    <CSRodapeLegal onPrivacidade={() => navigation?.navigate?.("Privacidade")} />

                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};


export default HospitalRegisterScreen;