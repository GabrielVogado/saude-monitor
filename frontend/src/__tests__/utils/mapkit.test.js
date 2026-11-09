/**
 * Contrato do adaptador nativo do mapa (`mapkit/index.js`) sobre o
 * `@maplibre/maplibre-react-native` v11: as telas falam a API antiga (MapView,
 * Camera.setCamera/fitBounds, ShapeSource, FillLayer, LineLayer, MarkerView) e o
 * adaptador traduz para a v11. O que se afirma é o que chega à biblioteca, porque é
 * onde uma conversão errada some em silêncio (câmera que não se move, toque sem
 * features, geofence sem cor).
 *
 * A biblioteca é substituída por dublês: os componentes nativos não rodam no Jest.
 */
import React from "react";
import { render } from "@testing-library/react-native";
import {
  Camera,
  FillLayer,
  LineLayer,
  MapView,
  MarkerView,
  ShapeSource,
} from "../../utils/mapkit";

const mockSetStop = jest.fn(() => Promise.resolve());
const mockProps = {};

jest.mock("@maplibre/maplibre-react-native", () => {
  const ReactMock = require("react");
  const { View } = require("react-native");
  const registrar = (nome) =>
    function Dublê({ children, ...props }) {
      mockProps[nome] = props;
      return <View testID={`dublê-${nome}`}>{children}</View>;
    };

  return {
    __esModule: true,
    Map: registrar("Map"),
    GeoJSONSource: registrar("GeoJSONSource"),
    Layer: ({ ...props }) => {
      mockProps[`Layer-${props.type}`] = props;
      return null;
    },
    Marker: registrar("Marker"),
    Camera: ({ ref, ...props }) => {
      mockProps.Camera = props;
      ReactMock.useImperativeHandle(ref, () => ({ setStop: (...args) => mockSetStop(...args) }));
      return null;
    },
  };
});

beforeEach(() => {
  Object.keys(mockProps).forEach((chave) => delete mockProps[chave]);
  mockSetStop.mockImplementation(() => Promise.resolve());
});

describe("mapkit nativo — MapView", () => {
  test("repassa o estilo, desliga o logo e mantém a atribuição exigida pelos tiles", () => {
    render(<MapView style={{ flex: 1 }} styleURL="https://tiles.exemplo/estilo.json" />);

    expect(mockProps.Map).toEqual(
      expect.objectContaining({ mapStyle: "https://tiles.exemplo/estilo.json", logo: false, attribution: true })
    );
  });

  test("sem styleURL, usa o estilo padrão do app em vez de um mapa sem estilo", () => {
    render(<MapView />);

    expect(mockProps.Map.mapStyle).toBe("https://tiles.openfreemap.org/styles/liberty");
  });

  test("avisa a tela que o mapa carregou, sem repassar o evento nativo", () => {
    const aoCarregar = jest.fn();
    render(<MapView styleURL="x" onDidFinishLoadingMap={aoCarregar} />);

    mockProps.Map.onDidFinishLoadingMap({ nativeEvent: null });

    expect(aoCarregar).toHaveBeenCalledWith();
  });

  test("sem o callback, o fim do carregamento não quebra", () => {
    render(<MapView styleURL="x" />);

    expect(() => mockProps.Map.onDidFinishLoadingMap({ nativeEvent: null })).not.toThrow();
  });
});

function renderizarCamera(props = { centerCoordinate: [-47.9, -15.8], zoomLevel: 10 }) {
  const cameraRef = React.createRef();
  const tela = render(<Camera ref={cameraRef} {...props} />);
  return { cameraRef, ...tela };
}

describe("mapkit nativo — Camera: posição pelas props", () => {
  test("a posição das props entra como posição inicial, sem mover a câmera", () => {
    renderizarCamera();

    expect(mockProps.Camera.initialViewState).toEqual({ center: [-47.9, -15.8], zoom: 10 });
    expect(mockSetStop).not.toHaveBeenCalled();
  });

  test("re-render com os mesmos números não move a câmera (não desfaz o zoom do usuário)", () => {
    const { rerender } = renderizarCamera();

    rerender(<Camera centerCoordinate={[-47.9, -15.8]} zoomLevel={10} />);

    expect(mockSetStop).not.toHaveBeenCalled();
  });

  test("um centro novo nas props move a câmera (Detalhe do Hospital ao terminar de carregar)", () => {
    const { rerender } = renderizarCamera();

    rerender(<Camera centerCoordinate={[-48.1, -15.9]} zoomLevel={14} />);

    expect(mockSetStop).toHaveBeenCalledWith({ center: [-48.1, -15.9], zoom: 14, duration: 0 });
  });

  test("sem centro nas props, não tenta mover a câmera", () => {
    const { rerender } = renderizarCamera({ zoomLevel: 3 });

    rerender(<Camera zoomLevel={5} />);

    expect(mockSetStop).not.toHaveBeenCalled();
  });
});

describe("mapkit nativo — Camera.setCamera", () => {
  test("sem zoomLevel, não manda `zoom` (centralizar mantém o zoom do usuário)", () => {
    const { cameraRef } = renderizarCamera();

    cameraRef.current.setCamera({ centerCoordinate: [-47.8, -15.7], animationDuration: 300 });

    expect(mockSetStop).toHaveBeenCalledWith({ center: [-47.8, -15.7], duration: 300, easing: "ease" });
    expect(mockSetStop.mock.calls[0][0]).not.toHaveProperty("zoom");
  });

  test("com zoomLevel e sem animação, vai direto ao ponto", () => {
    const { cameraRef } = renderizarCamera();

    cameraRef.current.setCamera({ centerCoordinate: [-47.8, -15.7], zoomLevel: 14 });

    expect(mockSetStop).toHaveBeenCalledWith({ center: [-47.8, -15.7], zoom: 14, duration: 0, easing: undefined });
  });

  test("só com zoomLevel, não manda `center`", () => {
    const { cameraRef } = renderizarCamera();

    cameraRef.current.setCamera({ zoomLevel: 12 });

    expect(mockSetStop.mock.calls[0][0]).not.toHaveProperty("center");
  });
});

describe("mapkit nativo — Camera.fitBounds", () => {
  test("converte nordeste/sudoeste em [oeste, sul, leste, norte] e aplica o padding nos 4 lados", () => {
    const { cameraRef } = renderizarCamera();

    cameraRef.current.fitBounds([-47.8, -15.7], [-48.0, -15.9], 48, 600);

    expect(mockSetStop).toHaveBeenCalledWith({
      bounds: [-48.0, -15.9, -47.8, -15.7],
      padding: { top: 48, right: 48, bottom: 48, left: 48 },
      duration: 600,
      easing: "ease",
    });
  });

  test("sem padding nem duração, enquadra sem margem e sem animação", () => {
    const { cameraRef } = renderizarCamera();

    cameraRef.current.fitBounds([-47.8, -15.7], [-48.0, -15.9]);

    expect(mockSetStop).toHaveBeenCalledWith(
      expect.objectContaining({ padding: { top: 0, right: 0, bottom: 0, left: 0 }, duration: 0 })
    );
  });
});

describe("mapkit nativo — Camera com o nativo indisponível", () => {
  test("se o nativo ainda não existe (setStop lança), registra o aviso e a tela segue", () => {
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockSetStop.mockImplementation(() => {
      throw new Error("NativeCameraComponent ref is null");
    });
    const { cameraRef } = renderizarCamera();

    expect(() => cameraRef.current.setCamera({ zoomLevel: 12 })).not.toThrow();
    expect(aviso).toHaveBeenCalledWith("mapkit: a câmera não pôde se mover", "NativeCameraComponent ref is null");
    aviso.mockRestore();
  });

  test("se o módulo nativo rejeita, registra o aviso em vez de deixar rejeição solta", async () => {
    const aviso = jest.spyOn(console, "warn").mockImplementation(() => {});
    mockSetStop.mockImplementation(() => Promise.reject(new Error("módulo nativo ausente")));
    const { cameraRef } = renderizarCamera();

    cameraRef.current.fitBounds([-47.8, -15.7], [-48.0, -15.9], 48, 600);
    await new Promise((resolve) => setImmediate(resolve));

    expect(aviso).toHaveBeenCalledWith("mapkit: a câmera não pôde se mover", "módulo nativo ausente");
    aviso.mockRestore();
  });
});

const GEOJSON = { type: "FeatureCollection", features: [] };

describe("mapkit nativo — ShapeSource", () => {
  test("repassa o GeoJSON já serializado como `data` da fonte", () => {
    render(<ShapeSource id="geofences" shape={GEOJSON} />);

    expect(mockProps.GeoJSONSource).toEqual(expect.objectContaining({ id: "geofences", data: JSON.stringify(GEOJSON) }));
  });

  test("re-render com o mesmo GeoJSON não serializa de novo (leitura de GPS a cada poucos segundos)", () => {
    const serializar = jest.spyOn(JSON, "stringify");
    const { rerender } = render(<ShapeSource id="geofences" shape={GEOJSON} />);
    const chamadasNoPrimeiroRender = serializar.mock.calls.length;

    rerender(<ShapeSource id="geofences" shape={GEOJSON} />);

    expect(serializar.mock.calls.length).toBe(chamadasNoPrimeiroRender);
    serializar.mockRestore();
  });

  test("o toque entrega `{ features }` à tela, tirando-as do evento nativo", () => {
    const aoTocar = jest.fn();
    const features = [{ type: "Feature", properties: { id: "h1" } }];
    render(<ShapeSource id="geofences" shape={GEOJSON} onPress={aoTocar} />);

    mockProps.GeoJSONSource.onPress({ nativeEvent: { features } });

    expect(aoTocar).toHaveBeenCalledWith({ features });
  });

  test("evento sem features vira lista vazia, não `undefined`", () => {
    const aoTocar = jest.fn();
    render(<ShapeSource id="geofences" shape={GEOJSON} onPress={aoTocar} />);

    mockProps.GeoJSONSource.onPress({ nativeEvent: {} });

    expect(aoTocar).toHaveBeenCalledWith({ features: [] });
  });

  test("sem onPress, a fonte não fica tocável", () => {
    render(<ShapeSource id="geofence" shape={GEOJSON} />);

    expect(mockProps.GeoJSONSource.onPress).toBeUndefined();
  });
});

describe("mapkit nativo — camadas", () => {
  test("FillLayer vira camada `fill` com cor e opacidade, na fonte recebida", () => {
    render(<FillLayer id="preenchimento" source="geofences" style={{ fillColor: "#006193", fillOpacity: 0.18 }} />);

    expect(mockProps["Layer-fill"]).toEqual({
      type: "fill",
      id: "preenchimento",
      source: "geofences",
      paint: { "fill-color": "#006193", "fill-opacity": 0.18 },
    });
  });

  test("FillLayer sem opacidade não manda a chave (fica o padrão da biblioteca)", () => {
    render(<FillLayer id="preenchimento" style={{ fillColor: "rgba(0,97,147,0.16)" }} />);

    expect(mockProps["Layer-fill"].paint).toEqual({ "fill-color": "rgba(0,97,147,0.16)" });
  });

  test("LineLayer vira camada `line` com cor e largura", () => {
    render(<LineLayer id="contorno" source="geofences" style={{ lineColor: "#006193", lineWidth: 2 }} />);

    expect(mockProps["Layer-line"].paint).toEqual({ "line-color": "#006193", "line-width": 2 });
  });

  test("LineLayer sem largura não manda a chave", () => {
    render(<LineLayer id="contorno" style={{ lineColor: "#006193" }} />);

    expect(mockProps["Layer-line"].paint).toEqual({ "line-color": "#006193" });
  });

  test("camadas sem `style` não quebram", () => {
    expect(() => render(<FillLayer id="a" />)).not.toThrow();
    expect(() => render(<LineLayer id="b" />)).not.toThrow();
  });
});

describe("mapkit nativo — MarkerView", () => {
  test("posiciona o marcador pela coordenada [lng, lat] e mantém o testID", () => {
    render(
      <MarkerView coordinate={[-47.9, -15.8]} testID="marcador-hospital-h1">
        <></>
      </MarkerView>
    );

    expect(mockProps.Marker).toEqual(expect.objectContaining({ lngLat: [-47.9, -15.8], testID: "marcador-hospital-h1" }));
  });
});
