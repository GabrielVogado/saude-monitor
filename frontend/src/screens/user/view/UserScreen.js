import React, { useState } from 'react';
import {
    StyleSheet,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    SafeAreaView,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    Alert,
} from 'react-native';
import {
    User,
    Mail,
    Phone,
    Lock,
    Eye,
    EyeOff,
    ArrowRight,
    ShieldCheck,
    Globe,
    Share2,
    HelpCircle,
    UserPlus
} from 'lucide-react-native';
import UserService from '../service/UserService';

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
                style={{ flex: 1 }}
            >
                <ScrollView contentContainerStyle={styles.scrollContent}>

                    {/* Header with Back Button Placeholder */}
                    <View style={styles.header}>
                        <TouchableOpacity style={styles.backBtn}>
                            <ArrowRight size={24} color="#075985" style={{ transform: [{ rotate: '180deg' }] }} />
                        </TouchableOpacity>
                        <View style={{ width: 40 }} />
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
                                <ArrowRight size={20} color="#FFF" style={{ marginLeft: 8 }} />
                            </TouchableOpacity>
                        </View>

                        {/* Compliance Info */}
                        <View style={styles.complianceBox}>
                            <View style={styles.complianceIcon}>
                                <ShieldCheck size={18} color="#0085C7" />
                            </View>
                            <Text style={styles.complianceText}>
                                Em conformidade com a <Text style={{ fontWeight: '700' }}>LGPD (Lei Geral de Proteção de Dados)</Text>. Suas informações são tratadas com sigilo absoluto e utilizadas exclusivamente para autenticação institucional.
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F1F5F9',
    },
    scrollContent: {
        paddingBottom: 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 20,
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '800',
        color: '#075985',
        letterSpacing: -0.5,
    },
    card: {
        backgroundColor: '#FFFFFF',
        marginHorizontal: 20,
        borderRadius: 32,
        padding: 24,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.08,
        shadowRadius: 20,
        elevation: 8,
        alignItems: 'center',
    },
    iconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EFF6FF',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    innerIcon: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#DBEAFE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    title: {
        fontSize: 24,
        fontWeight: '700',
        color: '#0F172A',
        textAlign: 'center',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 32,
        paddingHorizontal: 10,
    },
    form: {
        width: '100%',
    },
    label: {
        fontSize: 12,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 60,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    inputIcon: {
        marginRight: 12,
    },
    input: {
        flex: 1,
        color: '#1E293B',
        fontSize: 15,
    },
    termsContainer: {
        flexDirection: 'row',
        marginBottom: 32,
        paddingRight: 10,
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        marginRight: 12,
        marginTop: 2,
    },
    checkboxActive: {
        backgroundColor: '#0085C7',
        borderColor: '#0085C7',
    },
    termsText: {
        flex: 1,
        fontSize: 13,
        color: '#475569',
        lineHeight: 18,
    },
    linkText: {
        fontWeight: '700',
        color: '#0085C7',
    },
    registerButton: {
        backgroundColor: '#0070A8',
        height: 60,
        borderRadius: 16,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#0085C7',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    registerButtonDisabled: {
        opacity: 0.7,
    },
    registerButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
    complianceBox: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 16,
        padding: 16,
        marginTop: 24,
        gap: 12,
    },
    complianceIcon: {
        marginTop: 2,
    },
    complianceText: {
        flex: 1,
        fontSize: 11,
        color: '#475569',
        lineHeight: 16,
    },
    securityBadges: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 20,
        marginTop: 32,
    },
    badgeItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    badgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#94A3B8',
    },
    socialIcons: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 32,
        marginTop: 40,
    },
    iconWrapper: {
        alignItems: 'center',
        gap: 8,
    },
    socialBtn: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    iconLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
        letterSpacing: 0.5,
    },
    simpleFooter: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 32,
        gap: 12,
    },
    simpleFooterLink: {
        fontSize: 12,
        color: '#64748B',
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#CBD5E1',
    }
});

export default HospitalRegisterScreen;