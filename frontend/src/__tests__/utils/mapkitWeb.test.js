/**
 * Contrato do shim Web do mapa (`mapkit/index.web.js`) — só o que quebrou em uso real:
 *
 * 1. `Camera.setCamera` sem `zoomLevel`: o GL JS (achado no `mapbox-gl`) trata `flyTo({ zoom: undefined })`
 *    como "zoom informado", vira NaN e descarta o voo sem erro. Ao tocar num marcador
 *    para centralizá-lo (mantendo o zoom), o mapa simplesmente não se mexia.
 * 2. `MapView` precisa reagir à mudança de tamanho do CONTAINER: o `mapbox-gl` só
 *    escutava a janela, e o container encolhe quando a mensagem de GPS negado entra.
 * 3. Estilo e atribuição: o mapa usa o estilo recebido da tela e mostra a atribuição
 *    (OpenStreetMap/OpenMapTiles), exigida pelo provedor dos tiles.
 *
 * O `maplibre-gl` é substituído por um dublê: ele precisa de WebGL, que o Jest não tem.
 * O que se afirma aqui é o que o shim ENTREGA ao mapa, que foi onde os dois bugs moravam.
 */
import React from "react";
import { render } from "@testing-library/react-native";
import maplibregl from "maplibre-gl";
import { Camera, FillLayer, LineLayer, MapView, ShapeSource } from "../../utils/mapkit/index.web";

const mockMapa = {
  once: jest.fn((evento, callback) => callback()),
  flyTo: jest.fn(),
  jumpTo: jest.fn(),
  fitBounds: jest.fn(),
  resize: jest.fn(),
  remove: jest.fn(),
  getSource: jest.fn(() => undefined),
  addSource: jest.fn(),
  getLayer: jest.fn(() => undefined),
  addLayer: jest.fn(),
  setPaintProperty: jest.fn(),
  on: jest.fn(),
  off: jest.fn(),
};

jest.mock("maplibre-gl", () => ({
  __esModule: true,
  default: { Map: jest.fn(() => mockMapa) },
}));
jest.mock("maplibre-gl/dist/maplibre-gl.css", () => ({}));

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
  test("sem zoomLevel, não repassa a chave `zoom` ao flyTo (senão o GL JS vira NaN e não move)", () => {
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

describe("mapkit web — MapView e onDidFinishLoadingMap", () => {
  test("avisa a tela quando o mapa carrega, com a Camera já montada (ref ligado)", () => {
    // O `fitBounds` da tela precisa achar a Camera: no Web ela só monta depois do `load`.
    const cameraRef = React.createRef();
    let cameraProntaNoAviso = null;
    const aoCarregar = jest.fn(() => {
      cameraProntaNoAviso = cameraRef.current !== null;
    });

    render(
      <MapView style={{ flex: 1 }} onDidFinishLoadingMap={aoCarregar}>
        <Camera ref={cameraRef} centerCoordinate={[-47.9, -15.8]} zoomLevel={10} />
      </MapView>
    );

    expect(aoCarregar).toHaveBeenCalledTimes(1);
    expect(cameraProntaNoAviso).toBe(true);
  });

  test("sem o callback, o mapa carrega normalmente", () => {
    expect(() => render(<MapView style={{ flex: 1 }} />)).not.toThrow();
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

describe("mapkit web — estilo e atribuição", () => {
  test("cria o mapa com o estilo da tela e a atribuição ligada, compacta", () => {
    render(<MapView style={{ flex: 1 }} styleURL="https://tiles.exemplo/estilo.json" />);

    expect(maplibregl.Map).toHaveBeenCalledWith(
      expect.objectContaining({
        style: "https://tiles.exemplo/estilo.json",
        attributionControl: { compact: true },
      })
    );
  });
});

describe("mapkit web — Camera pelas props", () => {
  test("posiciona quando o mapa fica pronto e de novo só quando a posição muda", () => {
    const { rerender } = render(
      <MapView styleURL="x">
        <Camera centerCoordinate={[-47.9, -15.8]} zoomLevel={10} />
      </MapView>
    );
    expect(mockMapa.jumpTo).toHaveBeenCalledTimes(1);

    rerender(
      <MapView styleURL="x">
        <Camera centerCoordinate={[-47.9, -15.8]} zoomLevel={10} />
      </MapView>
    );
    expect(mockMapa.jumpTo).toHaveBeenCalledTimes(1);

    rerender(
      <MapView styleURL="x">
        <Camera centerCoordinate={[-48.1, -15.9]} zoomLevel={14} />
      </MapView>
    );
    expect(mockMapa.jumpTo).toHaveBeenLastCalledWith({ center: [-48.1, -15.9], zoom: 14 });
  });

  test("sem styleURL, cria o mapa com o estilo padrão do app", () => {
    render(<MapView />);

    expect(maplibregl.Map).toHaveBeenLastCalledWith(
      expect.objectContaining({ style: "https://tiles.openfreemap.org/styles/liberty" })
    );
  });
});

describe("mapkit web — camadas dos geofences", () => {
  test("FillLayer e LineLayer viram camadas com o mesmo paint do adaptador nativo", () => {
    render(
      <MapView styleURL="x">
        <ShapeSource id="geofences" shape={{ type: "FeatureCollection", features: [] }}>
          <FillLayer id="preenchimento" style={{ fillColor: "#006193", fillOpacity: 0.18 }} />
          <LineLayer id="contorno" style={{ lineColor: "#006193", lineWidth: 2 }} />
        </ShapeSource>
      </MapView>
    );

    expect(mockMapa.addLayer).toHaveBeenCalledWith({
      id: "preenchimento",
      type: "fill",
      source: "geofences",
      paint: { "fill-color": "#006193", "fill-opacity": 0.18 },
    });
    expect(mockMapa.addLayer).toHaveBeenCalledWith({
      id: "contorno",
      type: "line",
      source: "geofences",
      paint: { "line-color": "#006193", "line-width": 2 },
    });
  });
});
