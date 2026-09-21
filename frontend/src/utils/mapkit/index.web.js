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

// React desmonta uma árvore de cima para baixo: quando `mapaMontado` vira false em
// GeoLocalizacaoScreen, o cleanup do PRÓPRIO `MapView` (`mapa.remove()`) roda antes
// dos cleanups de ShapeSource/FillLayer/LineLayer, que tentam `getLayer`/`removeLayer`/
// `removeSource` num mapa que o mapbox-gl já destruiu por dentro — lança
// "Cannot read properties of undefined" (achado ao clicar num marcador de hospital
// no mapa: a tela ficava em branco). Cleanup de mapa é best-effort por natureza — se
// o mapa já não existe mais, não há nada a desfazer.
function operacaoSegura(fn) {
  try {
    fn();
  } catch {
    // mapa já destruído — nada a fazer.
  }
}

export function MapView({ style, styleURL, onDidFinishLoadingMap, children }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const [mapa, setMapa] = useState(null);

  // Os filhos (a `Camera` entre eles) só montam DEPOIS do `load`, então o `cameraRef` da
  // tela ainda é `null` quando o efeito dela roda no remonte — o `fitBounds` de "voltar do
  // detalhe" caía no vazio e o mapa ficava no Brasil inteiro. Este efeito roda depois do
  // commit que monta os filhos (refs já ligados): é o momento em que o nativo também
  // chama `onDidFinishLoadingMap`, com a câmera pronta.
  useEffect(() => {
    if (mapa) onDidFinishLoadingMap?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- só quando o mapa carrega; o efeito nasce no mesmo render em que `mapa` muda, então já enxerga o callback atual.
  }, [mapa]);

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

    // O `mapbox-gl` só reage a resize da JANELA. Aqui o container muda de altura sem a
    // janela mudar (a mensagem de GPS negado e o botão "Tentar novamente" entram depois
    // do mapa montar e encolhem o `mapContainer`): o canvas ficava com a altura antiga
    // (615 px num container de 526) — mapa descentralizado e ~90 px cortados embaixo.
    // Na versão nativa isso é automático; aqui é o observador que faz o papel.
    const observador =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => mapa.resize()) : null;
    observador?.observe(containerRef.current);

    return () => {
      observador?.disconnect();
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
        // Só repassa o que veio: no `mapbox-gl`, `flyTo({ zoom: undefined })` conta como
        // "zoom informado" (`'zoom' in options`), vira NaN e o voo é descartado sem erro —
        // a câmera simplesmente não se mexia ao centralizar sem alterar o zoom.
        const opcoes = { duration: animationDuration ?? 0 };
        if (centro !== undefined) opcoes.center = centro;
        if (zoom !== undefined) opcoes.zoom = zoom;
        mapa?.flyTo(opcoes);
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
      operacaoSegura(() => {
        layerIdsRef.current.forEach((layerId) => {
          if (mapa.getLayer(layerId)) mapa.removeLayer(layerId);
        });
        layerIdsRef.current = [];
        if (mapa.getSource(id)) mapa.removeSource(id);
      });
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
      operacaoSegura(() => {
        if (mapa.getLayer(id)) mapa.removeLayer(id);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- adiciona a layer uma vez; paint é reaplicado no efeito abaixo.
  }, [mapa, origem, id]);

  useEffect(() => {
    operacaoSegura(() => {
      if (mapa && mapa.getLayer(id)) {
        const paint = converterEstilo();
        Object.entries(paint).forEach(([propriedade, valor]) => {
          mapa.setPaintProperty(id, propriedade, valor);
        });
      }
    });
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

// Sem `anchor`: os marcadores do app são simétricos e a âncora padrão (centro) põe a
// coordenada no meio do ícone — ver BUG-10 em GeoLocalizacaoScreen. O `mapbox-gl` só
// aceita palavras-chave de âncora, não frações como `{x: 0, y: 0.5}` do SDK nativo.
export function MarkerView({ coordinate, children }) {
  const mapa = useContext(MapContext);
  const [elemento] = useState(() => document.createElement("div"));
  const marcadorRef = useRef(null);
  const raizRef = useRef(null);
  const [longitude, latitude] = coordinate;

  useEffect(() => {
    if (!mapa) return undefined;
    const marcador = new mapboxgl.Marker({ element: elemento })
      .setLngLat([longitude, latitude])
      .addTo(mapa);
    marcadorRef.current = marcador;
    return () => operacaoSegura(() => marcador.remove());
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
    return () => {
      // Desmontagem em massa (ex.: sair do mapa com ~300 marcadores montados)
      // aciona os cleanups de TODOS os MarkerView no mesmo commit do React-Native-
      // Web. `root.unmount()` de um `createRoot` separado é, ele mesmo, uma
      // desmontagem síncrona — chamá-la aqui dispara "Attempted to synchronously
      // unmount a root while React was already rendering" em cada marcador e deixa
      // a tela em branco (achado ao testar o clique num marcador real). Adiar para
      // depois do commit atual resolve.
      queueMicrotask(() => raizAtual?.unmount());
    };
  }, []);

  return null;
}
