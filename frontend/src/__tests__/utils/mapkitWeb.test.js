/**
 * Contrato do shim Web do mapa (`mapkit/index.web.js`) — só o que quebrou em uso real:
 *
 * 1. `Camera.setCamera` sem `zoomLevel`: o `mapbox-gl` trata `flyTo({ zoom: undefined })`
 *    como "zoom informado", vira NaN e descarta o voo sem erro. Ao tocar num marcador
 *    para centralizá-lo (mantendo o zoom), o mapa simplesmente não se mexia.
 * 2. `MapView` precisa reagir à mudança de tamanho do CONTAINER: o `mapbox-gl` só
 *    escuta a janela, e o container encolhe quando a mensagem de GPS negado entra.
 *
 * O `mapbox-gl` é substituído por um dublê: ele precisa de WebGL, que o Jest não tem.
 * O que se afirma aqui é o que o shim ENTREGA ao mapa, que foi onde os dois bugs moravam.
 */
import React from "react";
import { render } from "@testing-library/react-native";
import { Camera, MapView } from "../../utils/mapkit/index.web";

const mockMapa = {
  once: jest.fn((evento, callback) => callback()),
  flyTo: jest.fn(),
  jumpTo: jest.fn(),
  fitBounds: jest.fn(),
  resize: jest.fn(),
  remove: jest.fn(),
};

jest.mock("mapbox-gl", () => ({
  __esModule: true,
  default: { Map: jest.fn(() => mockMapa), accessToken: "" },
}));
jest.mock("mapbox-gl/dist/mapbox-gl.css", () => ({}));

function renderizarMapaComCamera() {
  const cameraRef = React.createRef();
  const tela = render(
    <MapView style={{ flex: 1 }}>
      <Camera ref={cameraRef} centerCoordinate={[-47.9, -15.8]} zoomLevel={10} />
    </MapView>
  );
  return { cameraRef, ...tela };
}

describe("mapkit web — Camera.setCamera", () => {
  test("sem zoomLevel, não repassa a chave `zoom` ao flyTo (senão o mapbox-gl vira NaN e não move)", () => {
    const { cameraRef } = renderizarMapaComCamera();

    cameraRef.current.setCamera({ centerCoordinate: [-47.8, -15.7], animationDuration: 300 });

    expect(mockMapa.flyTo).toHaveBeenCalledTimes(1);
    const opcoes = mockMapa.flyTo.mock.calls[0][0];
    expect(opcoes).toEqual({ center: [-47.8, -15.7], duration: 300 });
    expect(opcoes).not.toHaveProperty("zoom");
  });

  test("com zoomLevel, repassa o zoom", () => {
    const { cameraRef } = renderizarMapaComCamera();

    cameraRef.current.setCamera({ centerCoordinate: [-47.8, -15.7], zoomLevel: 14 });

    expect(mockMapa.flyTo).toHaveBeenCalledWith({ center: [-47.8, -15.7], zoom: 14, duration: 0 });
  });

  test("só com zoomLevel, não repassa `center`", () => {
    const { cameraRef } = renderizarMapaComCamera();

    cameraRef.current.setCamera({ zoomLevel: 14 });

    const opcoes = mockMapa.flyTo.mock.calls[0][0];
    expect(opcoes).not.toHaveProperty("center");
  });
});

describe("mapkit web — MapView e o tamanho do container", () => {
  const observadores = [];
  const ResizeObserverOriginal = global.ResizeObserver;

  beforeEach(() => {
    observadores.length = 0;
    global.ResizeObserver = jest.fn(function ResizeObserverFalso(callback) {
      this.callback = callback;
      this.observe = jest.fn();
      this.disconnect = jest.fn();
      observadores.push(this);
    });
  });

  afterAll(() => {
    global.ResizeObserver = ResizeObserverOriginal;
  });

  test("quando o container muda de tamanho, pede `resize()` ao mapa", () => {
    render(<MapView style={{ flex: 1 }} />);

    expect(observadores).toHaveLength(1);
    expect(mockMapa.resize).not.toHaveBeenCalled();

    observadores[0].callback();

    expect(mockMapa.resize).toHaveBeenCalledTimes(1);
  });

  test("ao desmontar, desliga o observador ANTES de destruir o mapa", () => {
    const { unmount } = render(<MapView style={{ flex: 1 }} />);
    const ordem = [];
    observadores[0].disconnect.mockImplementation(() => ordem.push("disconnect"));
    mockMapa.remove.mockImplementationOnce(() => ordem.push("remove"));

    unmount();

    expect(ordem).toEqual(["disconnect", "remove"]);
  });

  test("em ambiente sem ResizeObserver, o mapa monta normalmente", () => {
    delete global.ResizeObserver;

    expect(() => render(<MapView style={{ flex: 1 }} />)).not.toThrow();
  });
});
