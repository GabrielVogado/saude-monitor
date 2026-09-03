import React, { useEffect, useRef } from "react";
import {createNativeStackNavigator} from "@react-navigation/native-stack";
import {createBottomTabNavigator} from "@react-navigation/bottom-tabs";
import {NavigationContainer} from "@react-navigation/native";
import {SafeAreaProvider} from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import {Building2, Home as HomeIcon, Map as MapIcon, User as UserIcon} from "lucide-react-native";
import HomeScreen from "./src/screens/home/view/HomeScreen.js";
import LoginScreen from "./src/screens/auth/view/LoginScreen.js";
import UserScreen from "./src/screens/user/view/UserScreen.js";
import GeoLocalizacaoScreen from "./src/screens/geolocalizacao/view/GeoLocalizacaoScreen.js";
import HospitaisScreen from "./src/screens/hospitais/view/HospitaisScreen.js";
import HospitalDetalheScreen from "./src/screens/hospitais/view/HospitalDetalheScreen.js";
import RankingScreen from "./src/screens/hospitais/view/RankingScreen.js";
import SugerirHospitalScreen from "./src/screens/hospitais/view/SugerirHospitalScreen.js";
import SugestoesPendentesScreen from "./src/screens/hospitais/view/SugestoesPendentesScreen.js";
import RevisarSugestaoScreen from "./src/screens/hospitais/view/RevisarSugestaoScreen.js";
import FeedbackFormScreen from "./src/screens/feedback/view/FeedbackFormScreen.js";
import PerfilScreen from "./src/screens/perfil/view/PerfilScreen.js";
import HistoricoScreen from "./src/screens/perfil/view/HistoricoScreen.js";
import PrivacidadeScreen from "./src/screens/perfil/view/PrivacidadeScreen.js";
import NotificacoesScreen from "./src/screens/perfil/view/NotificacoesScreen.js";
import {colors} from "./src/theme";
import { agendarLembrete, pendenciaAtual } from "./src/screens/feedback/service/FeedbackNotificationService";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Stack da aba Início (E6-01): a Home é a âncora do geofencing/visita ativa (E2-07).
// É uma tela de apresentação do app; o check-in manual agora vive na lista Hospitais
// e o mapa é uma aba própria ("Mapa").
function HomeStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Home" component={HomeScreen} />
        </Stack.Navigator>
    );
}

// Stack da aba Hospitais (Épico 01 — CRUD/geofence, listagem pública, sugestões).
function HospitaisStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="HospitaisLista" component={HospitaisScreen} />
            <Stack.Screen name="HospitalDetalhe" component={HospitalDetalheScreen} />
            <Stack.Screen name="Ranking" component={RankingScreen} />
            <Stack.Screen name="SugerirHospital" component={SugerirHospitalScreen} />
            <Stack.Screen name="SugestoesPendentes" component={SugestoesPendentesScreen} />
            <Stack.Screen name="RevisarSugestao" component={RevisarSugestaoScreen} />
        </Stack.Navigator>
    );
}

// Stack da aba Perfil (Épico 05 — conta, consentimento, privacidade; F0-05).
function PerfilStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Perfil" component={PerfilScreen} />
            <Stack.Screen name="Historico" component={HistoricoScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Cadastro" component={UserScreen} />
            <Stack.Screen name="Privacidade" component={PrivacidadeScreen} />
            <Stack.Screen name="Notificacoes" component={NotificacoesScreen} />
        </Stack.Navigator>
    );
}

// Stack do Épico 03 — Feedback Pós-Saída (F-05). Aberta via notificação local
// pós-saída (E3-01) ou direto do app; sem aba (acesso por fluxo/notificação).
function FeedbackStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="FeedbackForm" component={FeedbackFormScreen} />
        </Stack.Navigator>
    );
}

// Navegação por Bottom Tabs (E6-01): 4 abas de 1 polegar (Início, Hospitais, Mapa,
// Perfil) substituindo o antigo Drawer. O mapa entrou como aba própria (navegação
// revisada), em vez de botão dentro da Home. Transições suaves via burst.
function Tabs() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.onSurfaceVariant,
                tabBarLabelStyle: { fontSize: 12, fontWeight: "600" },
                tabBarStyle: {
                    backgroundColor: colors.surfaceContainerLowest,
                    borderTopColor: colors.outlineVariant,
                    height: 64,
                    paddingBottom: 8,
                    paddingTop: 8,
                },
            }}
        >
            <Tab.Screen
                name="Inicio"
                component={HomeStack}
                options={{
                    tabBarLabel: "Início",
                    tabBarAccessibilityLabel: "Início — apresentação do app",
                    tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} />,
                }}
            />
            <Tab.Screen
                name="Hospitais"
                component={HospitaisStack}
                options={{
                    tabBarLabel: "Hospitais",
                    tabBarAccessibilityLabel: "Hospitais — lista com indicadores",
                    tabBarIcon: ({ color, size }) => <Building2 color={color} size={size} />,
                }}
                listeners={({ navigation }) => ({
                    // Item 07 (revisão de UX): ao reabrir a aba Hospitais, volta para a
                    // lista — nunca para o HospitalDetalhe/Sugestão que estava no topo do
                    // stack aninhado quando o usuário trocou de aba.
                    tabPress: () => {
                        const state = navigation.getState();
                        const aba = state?.routes?.find((r) => r.name === "Hospitais");
                        const interna = aba?.state?.routes?.[aba.state.index ?? 0]?.name;
                        if (interna && interna !== "HospitaisLista") {
                            navigation.navigate("Hospitais", { screen: "HospitaisLista" });
                        }
                    },
                })}
            />
            <Tab.Screen
                name="Mapa"
                component={GeoLocalizacaoScreen}
                options={{
                    tabBarLabel: "Mapa",
                    tabBarAccessibilityLabel: "Mapa — hospitais e geolocalização",
                    tabBarIcon: ({ color, size }) => <MapIcon color={color} size={size} />,
                }}
            />
            <Tab.Screen
                name="Perfil"
                component={PerfilStack}
                options={{
                    tabBarLabel: "Perfil",
                    tabBarAccessibilityLabel: "Perfil — conta e privacidade",
                    tabBarIcon: ({ color, size }) => <UserIcon color={color} size={size} />,
                }}
            />
        </Tab.Navigator>
    );
}

export default function App() {
    const navigationRef = useRef(null);

    useEffect(() => {
        // E3-01/E3-03: abre o formulário de feedback quando o usuário toca na
        // notificação local de feedback pós-saída.
        const tratarResposta = async (resposta) => {
            const data = resposta?.notification?.request?.content?.data;
            if (!data?.abrirFeedback || !data?.visitaId) {
                return;
            }
            const pendencia = await pendenciaAtual();
            if (pendencia?.visitaId === data.visitaId) {
                // Pedido de feedback visualizado: agenda o lembrete único
                // (RN-09/E3-03) caso ele não responda de imediato.
                await agendarLembrete({ visitaId: data.visitaId, hospitalNome: pendencia.hospitalNome });
            }
            navigationRef.current?.navigate("Feedback", {
                screen: "FeedbackForm",
                params: {
                    visitaId: data.visitaId,
                    hospitalNome: pendencia?.hospitalNome || data.hospitalNome,
                },
            });
        };

        const subscricao = Notifications.addNotificationResponseReceivedListener(tratarResposta);
        return () => subscricao.remove();
    }, []);

    return (
        <SafeAreaProvider>
            <NavigationContainer ref={navigationRef}>
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Tabs" component={Tabs} />
                    <Stack.Screen name="Feedback" component={FeedbackStack} />
                </Stack.Navigator>
            </NavigationContainer>
        </SafeAreaProvider>
    );
}