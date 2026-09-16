/**
 * Implementação Web do subconjunto de `@rnmapbox/maps` usado por GeoLocalizacaoScreen
 * e HospitalDetalheScreen (MapView, Camera, ShapeSource, FillLayer, LineLayer,
 * MarkerView) — ver o comentário de `index.js` para o porquê deste módulo existir.
 *
 * Usa `mapbox-gl` (já dependência do projeto, sem build nativo) atrás da mesma API
 * usada pelas telas, para não duplicar a lógica de negócio por plataforma. Não é uma
 * reimplementação genérica do SDK: cobre só as props que as duas telas realmente usam.
 */
import React, {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createRoot } from "react-dom/client";
import { View } from "react-native";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

mapboxgl.accessToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN || "";

const MapContext = createContext(null);
const SourceContext = createContext(null);

export function MapView({ style, styleURL, children }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapa, setMapa] = useState(null);

  useEffect(() => {
    const mapa = new mapboxgl.Map({
      container: containerRef.current,
      style: styleURL || "mapbox://styles/mapbox/streets-v12",
      center: [0, 0],
      zoom: 0,
      attributionControl: false,
    });
    mapRef.current = mapa;
    mapa.once("load", () => setMapa(mapa));
    return () => {
      mapa.remove();
      mapRef.current = null;
      setMapa(null);
    };
  }, [styleURL]);

  return (
    <View style={[{ position: "relative" }, style]}>
      <div ref={containerRef} style={{ position: "absolute", inset: 0 }} />
      {mapa ? <MapContext.Provider value={mapa}>{children}</MapContext.Provider> : null}
    </View>
  );
}

export const Camera = forwardRef(function Camera({ centerCoordinate, zoomLevel }, ref) {
  const mapa = useContext(MapContext);
  const posicionadoRef = useRef(false);

  useEffect(() => {
    if (mapa && !posicionadoRef.current) {
      mapa.jumpTo({ center: centerCoordinate, zoom: zoomLevel });
      posicionadoRef.current = true;
    }
  }, [mapa, centerCoordinate, zoomLevel]);

  useImperativeHandle(
    ref,
    () => ({
      setCamera: ({ centerCoordinate: centro, zoomLevel: zoom, animationDuration }) => {
        mapa?.flyTo({ center: centro, zoom, duration: animationDuration ?? 0 });
      },
      fitBounds: (nordeste, sudoeste, padding, duration) => {
        mapa?.fitBounds([sudoeste, nordeste], { padding: padding ?? 0, duration: duration ?? 0 });
      },
    }),
    [mapa]
  );

  return null;
});

export function ShapeSource({ id, shape, onPress, children }) {
  const mapa = useContext(MapContext);
  const layerIdsRef = useRef([]);
  const shapeInicialRef = useRef(shape);
  useEffect(() => {
    shapeInicialRef.current = shape;
  }, [shape]);

  // Criação preguiçosa: React roda os `useEffect` dos filhos (FillLayer/LineLayer)
  // ANTES do efeito deste componente pai, então esperar o próprio efeito do
  // ShapeSource para chamar `addSource` deixava as camadas tentando se registrar
  // numa fonte que ainda não existia (`source "..." not found`). Cada camada chama
  // `garantirFonte()` no seu próprio efeito — quem rodar primeiro cria a fonte.
  // `useCallback` com deps só de `mapa`/`id`: manter a IDENTIDADE estável entre
  // renders é o que permite memoizar `origem` (abaixo) e evitar que FillLayer/
  // LineLayer removam e recriem a layer a cada re-render do pai (ex.: a cada leitura
  // de GPS em GeoLocalizacaoScreen) — achado do code-review desta correção.
  const garantirFonte = useCallback(() => {
    if (mapa && !mapa.getSource(id)) {
      mapa.addSource(id, { type: "geojson", data: shapeInicialRef.current });
    }
  }, [mapa, id]);

  useEffect(() => {
    garantirFonte();
    return () => {
      if (!mapa) return;
      layerIdsRef.current.forEach((layerId) => {
        if (mapa.getLayer(layerId)) mapa.removeLayer(layerId);
      });
      layerIdsRef.current = [];
      if (mapa.getSource(id)) mapa.removeSource(id);
    };
  }, [mapa, id, garantirFonte]);

  useEffect(() => {
    if (mapa && mapa.getSource(id)) {
      mapa.getSource(id).setData(shape);
    }
  }, [mapa, id, shape]);

  // Não depende de `children`: as layers já registradas em `layerIdsRef` no
  // momento do efeito (via `registrarLayer`, que roda antes — filhos montam
  // primeiro) bastam. Lidas de dentro do handler para pegar altas/baixas de
  // layer sem precisar reassinar o clique a cada render.
  useEffect(() => {
    if (!mapa || !onPress) return undefined;
    const layerIds = layerIdsRef.current;
    const handler = (evento) => {
      const features = mapa.queryRenderedFeatures(evento.point, { layers: layerIdsRef.current });
      onPress({ features });
    };
    layerIds.forEach((layerId) => mapa.on("click", layerId, handler));
    return () => {
      layerIds.forEach((layerId) => mapa.off("click", layerId, handler));
    };
  }, [mapa, onPress]);

  const registrarLayer = useCallback((layerId) => {
    if (!layerIdsRef.current.includes(layerId)) {
      layerIdsRef.current = [...layerIdsRef.current, layerId];
    }
  }, []);

  const origem = useMemo(
    () => ({ sourceId: id, garantirFonte, registrarLayer }),
    [id, garantirFonte, registrarLayer]
  );

  return <SourceContext.Provider value={origem}>{children}</SourceContext.Provider>;
}

function useCamadaGeoJson(tipo, id, converterEstilo) {
  const mapa = useContext(MapContext);
  const origem = useContext(SourceContext);

  useEffect(() => {
    if (!mapa || !origem) return undefined;
    origem.garantirFonte();
    origem.registrarLayer(id);
    if (!mapa.getLayer(id)) {
      mapa.addLayer({ id, type: tipo, source: origem.sourceId, paint: converterEstilo() });
    }
    return () => {
      if (mapa.getLayer(id)) mapa.removeLayer(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- adiciona a layer uma vez; paint é reaplicado no efeito abaixo.
  }, [mapa, origem, id]);

  useEffect(() => {
    if (mapa && mapa.getLayer(id)) {
      const paint = converterEstilo();
      Object.entries(paint).forEach(([propriedade, valor]) => {
        mapa.setPaintProperty(id, propriedade, valor);
      });
    }
  });
}

export function FillLayer({ id, style = {} }) {
  useCamadaGeoJson("fill", id, () => ({
    "fill-color": style.fillColor,
    ...(style.fillOpacity !== undefined ? { "fill-opacity": style.fillOpacity } : {}),
  }));
  return null;
}

export function LineLayer({ id, style = {} }) {
  useCamadaGeoJson("line", id, () => ({
    "line-color": style.lineColor,
    ...(style.lineWidth !== undefined ? { "line-width": style.lineWidth } : {}),
  }));
  return null;
}

// BUG-10 (ver GeoLocalizacaoScreen): âncora {x:0,y:0.5} centraliza a coordenada na
// borda esquerda do marcador. mapbox-gl não aceita frações — só as palavras-chave
// abaixo — por isso o conversor cobre só as combinações realmente usadas no app.
function converterAncora(anchor) {
  if (!anchor) return "center";
  const { x = 0.5, y = 0.5 } = anchor;
  if (x <= 0.1 && Math.abs(y - 0.5) < 0.1) return "left";
  if (x >= 0.9 && Math.abs(y - 0.5) < 0.1) return "right";
  if (y <= 0.1) return "top";
  if (y >= 0.9) return "bottom";
  return "center";
}

export function MarkerView({ coordinate, anchor, children }) {
  const mapa = useContext(MapContext);
  const [elemento] = useState(() => document.createElement("div"));
  const marcadorRef = useRef(null);
  const raizRef = useRef(null);
  const [longitude, latitude] = coordinate;

  useEffect(() => {
    if (!mapa) return undefined;
    const marcador = new mapboxgl.Marker({ element: elemento, anchor: converterAncora(anchor) })
      .setLngLat([longitude, latitude])
      .addTo(mapa);
    marcadorRef.current = marcador;
    return () => marcador.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reposicionamento tratado no efeito de coordenadas abaixo.
  }, [mapa, elemento]);

  useEffect(() => {
    marcadorRef.current?.setLngLat([longitude, latitude]);
  }, [longitude, latitude]);

  useEffect(() => {
    if (!raizRef.current) {
      raizRef.current = createRoot(elemento);
    }
    raizRef.current.render(children);
  }, [elemento, children]);

  useEffect(() => {
    const raizAtual = raizRef.current;
    return () => raizAtual?.unmount();
  }, []);

  return null;
}
