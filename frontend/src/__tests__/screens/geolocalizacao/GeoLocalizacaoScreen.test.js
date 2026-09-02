/**
 * Mapa de hospitais (F-07 — Sprint S8).
 *
 * Cobre os dois entregáveis da estória: os polígonos das geofences renderizados
 * numa fonte GeoJSON única e o filtro geográfico por raio, que delega o recorte
 * ao backend (`GET /api/v1/hospitais?latitude&longitude&raioKm`) quando há GPS.
 */
import React from "react";
import { render, fireEvent, screen, waitFor } from "@testing-library/react-native";
import GeoLocalizacaoScreen from "../../../screens/geolocalizacao/view/GeoLocalizacaoScreen";
import HospitalService from "../../../screens/hospitais/service/HospitalService";
import { useGeolocalizacao } from "../../../screens/geolocalizacao/service/GeoLocalizacaoService";

jest.mock("../../../screens/hospitais/service/HospitalService");

// @maplibre/maplibre-react-native: componentes nativos não suportados pelo Jest;
// substituídos por Views que preservam os props (mesmo padrão do App.test.js).
jest.mock("@maplibre/maplibre-react-native", () => {
  const ReactMock = require("react");
  const { View } = require("react-native");
  const stub = ({ children, ...props }) => <View {...props}>{children}</View>;

  // A Camera é acessada por ref (easeTo/fitBounds) pela tela; o stub precisa
  // expor esses métodos, senão o enquadramento derruba o render nos testes.
  const Camera = ReactMock.forwardRef(({ children, ...props }, ref) => {
    ReactMock.useImperativeHandle(ref, () => ({
      easeTo: jest.fn(),
      fitBounds: jest.fn(),
    }));
    return <View {...props}>{children}</View>;
  });

  return {
    __esModule: true,
    Map: stub,
    Camera,
    Marker: stub,
    GeoJSONSource: stub,
    Layer: stub,
  };
});

// O provider real inicia watchPositionAsync; aqui controlamos o estado do GPS.
jest.mock("../../../screens/geolocalizacao/service/GeoLocalizacaoService", () => ({
  __esModule: true,
  GeolocalizacaoProvider: ({ children }) => children,
  useGeolocalizacao: jest.fn(),
}));

const ANEL = [[-47.89, -15.79], [-47.88, -15.79], [-47.88, -15.78], [-47.89, -15.79]];

const HOSPITAL = {
  id: "h1",
  nome: "Hospital Alfa",
  geofence: { type: "Polygon", coordinates: [ANEL] },
};

const NAVEGACAO = { navigate: jest.fn() };

function comGps(coordenadas) {
  useGeolocalizacao.mockReturnValue({
    coordenadas,
    carregando: false,
    permissaoConcedida: true,
    erro: null,
    iniciarMonitoramento: jest.fn(),
    pararMonitoramento: jest.fn(),
  });
}

function renderizar() {
  return render(<GeoLocalizacaoScreen navigation={NAVEGACAO} />);
}

describe("GeoLocalizacaoScreen (F-07)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    HospitalService.listar.mockResolvedValue({ content: [HOSPITAL] });
    comGps({ latitude: -15.785, longitude: -47.885, accuracy: 10 });
  });

  test("renderiza os polígonos das geofences numa fonte GeoJSON única", async () => {
    renderizar();

    const fonte = await screen.findByTestId("geofences-hospitais");
    expect(fonte.props.data.features).toHaveLength(1);
    expect(fonte.props.data.features[0].properties).toEqual({ id: "h1", nome: "Hospital Alfa" });
  });

  test("sem raio selecionado, carrega o catálogo completo", async () => {
    renderizar();

    await waitFor(() => {
      expect(HospitalService.listar).toHaveBeenCalledWith({ size: 100 });
    });
  });

  test("selecionar um raio envia latitude, longitude e raioKm ao backend", async () => {
    renderizar();
    await screen.findByText("5 km");

    fireEvent.press(screen.getByText("5 km"));

    await waitFor(() => {
      expect(HospitalService.listar).toHaveBeenLastCalledWith({
        latitude: -15.785,
        longitude: -47.885,
        raioKm: 5,
        size: 100,
      });
    });
  });

  test("raio selecionado sem GPS avisa o usuário e mantém o catálogo completo", async () => {
    comGps(null);
    renderizar();
    await screen.findByText("10 km");

    fireEvent.press(screen.getByText("10 km"));

    expect(
      await screen.findByText("Aguardando o GPS para filtrar hospitais num raio de 10 km.")
    ).toBeTruthy();
    expect(HospitalService.listar).toHaveBeenLastCalledWith({ size: 100 });
  });

  test("tocar num polígono abre o detalhe do hospital correspondente", async () => {
    renderizar();

    const fonte = await screen.findByTestId("geofences-hospitais");
    fonte.props.onPress({ features: [{ properties: { id: "h1" } }] });

    expect(NAVEGACAO.navigate).toHaveBeenCalledWith("Hospitais", {
      screen: "HospitalDetalhe",
      params: { id: "h1" },
    });
  });

  test("falha ao carregar hospitais exibe mensagem sem derrubar o mapa", async () => {
    HospitalService.listar.mockRejectedValueOnce(new Error("Backend indisponível."));

    renderizar();

    expect(await screen.findByText("Backend indisponível.")).toBeTruthy();
  });
});
