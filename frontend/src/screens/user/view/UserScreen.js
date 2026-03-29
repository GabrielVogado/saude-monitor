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
    ArrowRight,
    Eye,
    EyeOff,
    Globe,
    HelpCircle,
    Lock,
    Mail,
    Phone,
    Share2,
    ShieldCheck,
    User,
    UserPlus
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import UserService from '../service/UserService';
import styles from './css/UserStyle';

const HospitalRegisterScreen = () => {
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

            await UserService.cadastro({
                fullName,
                email,
                phone,
                password,
            });

            Alert.alert('Cadastro realizado', 'Seu cadastro foi enviado com sucesso.');
            setFullName('');
            setEmail('');
            setPhone('');
            setPassword('');
            setAgreeTerms(false);
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
                        <TouchableOpacity style={styles.backBtn}>
                            <ArrowRight size={24} color="#075985" style={styles.headerBackIcon} />
                        </TouchableOpacity>
                        <View style={styles.headerSpacer} />
                    </View>

                    {/* Main Card */}
                    <View style={styles.card}>
                        <View style={styles.iconCircle}>
                            <View style={styles.innerIcon}>
                                <UserPlus size={32} color="#0085C7" />
                            </View>
                        </View>

                        <Text style={styles.title}>Crie seu cadastro</Text>
                        <Text style={styles.subtitle}>
                            Preencha seus dados para solicitar acesso ao painel.
                        </Text>

                        {/* Form */}
                        <View style={styles.form}>

                            {/* Full Name */}
                            <Text style={styles.label}>NOME COMPLETO</Text>
                            <View style={styles.inputContainer}>
                                <User size={20} color="#94A3B8" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Ex: Dr. Alberto Ferreira"
                                    placeholderTextColor="#94A3B8"
                                    value={fullName}
                                    onChangeText={setFullName}
                                />
                            </View>

                            {/* Email */}
                            <Text style={styles.label}>E-MAIL INSTITUCIONAL</Text>
                            <View style={styles.inputContainer}>
                                <Mail size={20} color="#94A3B8" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="nome@hospital.com.br"
                                    placeholderTextColor="#94A3B8"
                                    value={email}
                                    onChangeText={setEmail}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            </View>

                            {/* Phone */}
                            <Text style={styles.label}>TELEFONE</Text>
                            <View style={styles.inputContainer}>
                                <Phone size={20} color="#94A3B8" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="(11) 99999-9999"
                                    placeholderTextColor="#94A3B8"
                                    value={phone}
                                    onChangeText={setPhone}
                                    keyboardType="phone-pad"
                                />
                            </View>


                            {/* Password */}
                            <Text style={styles.label}>SENHA</Text>
                            <View style={styles.inputContainer}>
                                <Lock size={20} color="#94A3B8" style={styles.inputIcon} />
                                <TextInput
                                    style={styles.input}
                                    placeholder="••••••••"
                                    placeholderTextColor="#94A3B8"
                                    secureTextEntry={!showPassword}
                                    value={password}
                                    onChangeText={setPassword}
                                />
                                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                                    {showPassword ? (
                                        <EyeOff size={20} color="#94A3B8" />
                                    ) : (
                                        <Eye size={20} color="#94A3B8" />
                                    )}
                                </TouchableOpacity>
                            </View>

                            {/* Terms & Conditions */}
                            <View style={styles.termsContainer}>
                                <TouchableOpacity
                                    style={[styles.checkbox, agreeTerms && styles.checkboxActive]}
                                    onPress={() => setAgreeTerms(!agreeTerms)}
                                />
                                <Text style={styles.termsText}>
                                    Concordo com os <Text style={styles.linkText}>Termos de Uso</Text> e <Text style={styles.linkText}>Política de Privacidade</Text> da plataforma Clinical Sanctuary.
                                </Text>
                            </View>

                            {/* Register Button */}
                            <TouchableOpacity
                                style={[styles.registerButton, isSubmitting && styles.registerButtonDisabled]}
                                onPress={handleCadastro}
                                disabled={isSubmitting}
                            >
                                <Text style={styles.registerButtonText}>
                                    {isSubmitting ? 'Enviando...' : 'Cadastrar no sistema'}
                                </Text>
                                <ArrowRight size={20} color="#FFF" style={styles.registerButtonIcon} />
                            </TouchableOpacity>
                        </View>

                        {/* Compliance Info */}
                        <View style={styles.complianceBox}>
                            <View style={styles.complianceIcon}>
                                <ShieldCheck size={18} color="#0085C7" />
                            </View>
                            <Text style={styles.complianceText}>
                                Em conformidade com a <Text style={styles.complianceHighlight}>LGPD (Lei Geral de Proteção de Dados)</Text>. Suas informações são tratadas com sigilo absoluto e utilizadas exclusivamente para autenticação institucional.
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
                            <TouchableOpacity style={styles.socialBtn}><Globe size={24} color="#1E293B" /></TouchableOpacity>
                            <Text style={styles.iconLabel}>GLOBAL</Text>
                        </View>
                        <View style={styles.iconWrapper}>
                            <TouchableOpacity style={styles.socialBtn}><Share2 size={24} color="#1E293B" /></TouchableOpacity>
                            <Text style={styles.iconLabel}>PARTILHAR</Text>
                        </View>
                        <View style={styles.iconWrapper}>
                            <TouchableOpacity style={styles.socialBtn}><HelpCircle size={24} color="#1E293B" /></TouchableOpacity>
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
};


export default HospitalRegisterScreen;