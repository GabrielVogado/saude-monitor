import React from "react";
import {createStackNavigator} from "@react-navigation/stack";
import {createDrawerNavigator} from "@react-navigation/drawer";
import {NavigationContainer} from "@react-navigation/native";
import {SafeAreaProvider} from "react-native-safe-area-context";
import {Image, Text, TouchableOpacity, View} from "react-native";
import {HomeScreen, LoginScreen} from "./src/screens/views";

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

// Stack principal (Home + Login)
function MainStack({ navigation }) {
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="Home"
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
            <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{
                    headerStyle: { backgroundColor: "#fff" },
                    headerTitle: () => <HeaderTitle />,
                    headerTintColor: "#333",
                }}
            />
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
                    <Drawer.Screen name="Principal" component={MainStack} />
                    <Drawer.Screen name="Login" component={LoginScreen} />
                </Drawer.Navigator>
            </NavigationContainer>
        </SafeAreaProvider>
    );
}