/**
 * Smoke test de navegação (E6-01): garante que o App monta e que a barra de
 * Bottom Tabs exibe as 3 abas (Início, Hospitais, Perfil) que substituíram o Drawer.
 *
 * Renderiza o `App` real com mocks das libs nativas (mapa, notifications, GPS),
 * conforme já feitos em `jest.setup.js`, e valida a árvore de acessibilidade da tab bar.
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import App from "../../../App";

// @maplibre/maplibre-react-native: expõe componentes nativos (MapLibre) não
// suportados pelo Jest; substituímos por Views textuais para o smoke test.
jest.mock("@maplibre/maplibre-react-native", () => {
  const { View } = require("react-native");
  const stub = (props) => <View {...props} />;
  return {
    __esModule: true,
    Map: stub,
    Camera: stub,
    Marker: stub,
    GeoJSONSource: stub,
    LineLayer: stub,
    FillLayer: stub,
    CircleLayer: stub,
    RasterLayer: stub,
    ShapeSource: stub,
  };
});

// expo-task-manager: o módulo nativo não roda em Jest.
jest.mock("expo-task-manager", () => ({
  __esModule: true,
  defineTask: jest.fn(),
  isTaskRegisteredAsync: jest.fn(async () => false),
  registerTaskAsync: jest.fn(async () => true),
  unregisterTaskAsync: jest.fn(async () => true),
}));

// react-native-safe-area-context: insets nativos indisponíveis em Jest; mock manual
// para que SafeAreaProvider/SafeAreaView montem os filhos e o app renderize as tabs.
jest.mock("react-native-safe-area-context", () => {
  const React = require("react");
  const { View } = require("react-native");
  const MOCK_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
  const SafeAreaProvider = ({ children, ...rest }) =>
    React.createElement(View, { ...rest, style: { flex: 1 }, collapsable: false }, children);
  const SafeAreaView = ({ children, style, ...rest }) =>
    React.createElement(View, { ...rest, style: [{ flex: 1 }, style] }, children);
  const SafeAreaInsetsContext = React.createContext(MOCK_INSETS);
  return {
    __esModule: true,
    SafeAreaProvider,
    SafeAreaView,
    SafeAreaInsetsContext,
    useSafeAreaInsets: () => MOCK_INSETS,
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
    initialWindowMetrics: { insets: MOCK_INSETS, frame: { x: 0, y: 0, width: 390, height: 844 } },
  };
});

// react-native-gesture-handler: módulo nativo (install/handlers) exigido por
// react-native-screens e pelo bottom-tabs; o stack JS saiu no ARQ-04;
// mock simples para renderizar no Jest.
jest.mock("react-native-gesture-handler", () => {
  const React = require("react");
  const { View } = require("react-native");
  const stubHandler = ({ children, ...rest }) => React.createElement(View, { ...rest }, children);
  return {
    __esModule: true,
    default: { install: jest.fn() },
    GestureHandlerRootView: ({ children, ...rest }) =>
      React.createElement(View, { ...rest, style: { flex: 1 } }, children),
    PanGestureHandler: stubHandler,
    TapGestureHandler: stubHandler,
    LongPressGestureHandler: stubHandler,
    NativeViewGestureHandler: stubHandler,
    State: { UNDETERMINED: 0, BEGAN: 1, ACTIVE: 2, END: 3, CANCELLED: 4, FAILED: 5 },
  };
});

describe("App — Bottom Tabs (E6-01)", () => {
  it("monta o app e exibe as 4 abas (Início, Hospitais, Mapa, Perfil)", () => {
    render(<App />);

    expect(screen.getByText("Início")).toBeOnTheScreen();
    expect(screen.getByText("Hospitais")).toBeOnTheScreen();
    expect(screen.getByText("Mapa")).toBeOnTheScreen();
    expect(screen.getByText("Perfil")).toBeOnTheScreen();
  });

  it("abre a aba de hospitais por padrão de acessibilidade", () => {
    render(<App />);

    const abaHospitais = screen.getByLabelText("Hospitais — lista com indicadores");
    const abaPerfil = screen.getByLabelText("Perfil — conta e privacidade");
    const abaInicio = screen.getByLabelText("Início — apresentação do app");
    const abaMapa = screen.getByLabelText("Mapa — hospitais e geolocalização");

    expect(abaHospitais).toBeOnTheScreen();
    expect(abaPerfil).toBeOnTheScreen();
    expect(abaInicio).toBeOnTheScreen();
    expect(abaMapa).toBeOnTheScreen();
  });
});