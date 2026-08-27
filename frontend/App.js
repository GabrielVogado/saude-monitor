import React from "react";
import {createStackNavigator} from "@react-navigation/stack";
import {createDrawerNavigator} from "@react-navigation/drawer";
import {NavigationContainer} from "@react-navigation/native";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {Image, Text, TouchableOpacity, View} from "react-native";
import HomeScreen from "./src/screens/home/view/HomeScreen.js";
import LoginScreen from "./src/screens/auth/view/LoginScreen.js";
import UserScreen from "./src/screens/user/view/UserScreen.js";
import GeoLocalizacaoScreen from "./src/screens/geolocalizacao/view/GeoLocalizacaoScreen.js";
import HospitaisScreen from "./src/screens/hospitais/view/HospitaisScreen.js";
import HospitalDetalheScreen from "./src/screens/hospitais/view/HospitalDetalheScreen.js";
import SugerirHospitalScreen from "./src/screens/hospitais/view/SugerirHospitalScreen.js";
import SugestoesPendentesScreen from "./src/screens/hospitais/view/SugestoesPendentesScreen.js";
import RevisarSugestaoScreen from "./src/screens/hospitais/view/RevisarSugestaoScreen.js";
import CheckinManualScreen from "./src/screens/visitas/view/CheckinManualScreen.js";

const Stack = createStackNavigator();
const Drawer = createDrawerNavigator();

// Componente customizado para o título do header
const HeaderTitle = () => (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Image
            source={require("./assets/img/predio-do-hospital.png")}
            style={{ width: 24, height: 24, marginRight: 8, resizeMode: "contain" }}
        />
        <Text style={{ fontSize: 18, fontWeight: "bold", color: "#333" }}>
            Hospital App
        </Text>
    </View>
);

// Stack principal (Home) — apenas a tela inicial, com header e hambúrguer.
// Login e Geolocalizacao ficam direto no Drawer (sem duplicação de rota).
function MainStack({ navigation }) {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="HomeScreen"
                component={HomeScreen}
                options={{
                    headerStyle: { backgroundColor: "#fff" },
                    headerTitle: () => <HeaderTitle />,
                    headerTintColor: "#333",
                    // Ícone hambúrguer visível no lado direito
                    headerRight: () => (
                        <TouchableOpacity
                            onPress={() => navigation.openDrawer()}
                            style={{ marginRight: 15 }}
                        >
                            <Image
                                source={require("./assets/img/menu-de-hamburguer.png")}
                                style={{ width: 24, height: 24, resizeMode: "contain" }}
                            />
                        </TouchableOpacity>
                    ),
                }}
            />
        </Stack.Navigator>
    );
}

// Stack do Épico 02 — Detecção de Visitas (Geofence)
function VisitasStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="CheckinManual" component={CheckinManualScreen} />
        </Stack.Navigator>
    );
}

// Stack do Épico 01 — Cadastro de Hospitais e Geofences
function HospitaisStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="HospitaisLista" component={HospitaisScreen} />
            <Stack.Screen name="HospitalDetalhe" component={HospitalDetalheScreen} />
            <Stack.Screen name="SugerirHospital" component={SugerirHospitalScreen} />
            <Stack.Screen name="SugestoesPendentes" component={SugestoesPendentesScreen} />
            <Stack.Screen name="RevisarSugestao" component={RevisarSugestaoScreen} />
        </Stack.Navigator>
    );
}

export default function App() {
    return (
        <SafeAreaProvider>
            <NavigationContainer>
                {/* Drawer com opção de Login */}
                <Drawer.Navigator
                    screenOptions={{
                        headerShown: false, // escondemos o header duplicado do Drawer
                    }}
                >
                    <Drawer.Screen name="Home" component={MainStack} />
                    <Drawer.Screen name="Hospitais" component={HospitaisStack} />
                    <Drawer.Screen
                        name="Check-in manual"
                        component={VisitasStack}
                    />
                    <Drawer.Screen name="Login" component={LoginScreen} />
                    <Drawer.Screen name="Cadastro" component={UserScreen} />
                    <Drawer.Screen
                        name="Geolocalizacao"
                        component={GeoLocalizacaoScreen}
                        options={{
                            drawerItemStyle: { display: "none" },
                        }}
                    />
                </Drawer.Navigator>
            </NavigationContainer>
        </SafeAreaProvider>
    );
}
