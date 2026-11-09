/**
 * Implementação Web do adaptador de mapa (`utils/mapkit`) usado por GeoLocalizacaoScreen
 * e HospitalDetalheScreen (MapView, Camera, ShapeSource, FillLayer, LineLayer,
 * MarkerView). Ver o comentário de `index.js` para o porquê deste módulo existir.
 *
 * Usa `maplibre-gl` (sem build nativo) atrás da mesma API usada pelas telas, para não
 * duplicar a lógica de negócio por plataforma. Não é uma reimplementação genérica do
 * SDK: cobre só as props que as duas telas realmente usam. Até 11/2026 era `mapbox-gl`;
 * as duas bibliotecas têm a mesma origem e a mesma API para o que usamos aqui.
 *
 * Fica na linha 5 do `maplibre-gl`: a 6 é só ESM e carrega o worker por
 * `import.meta.url`, que o bundler Web do Metro não resolve.
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
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { MAP_STYLE } from "../mapStyle";
import { pinturaDaLinha, pinturaDoPreenchimento } from "./paint";

const MapContext = createContext(null);
const SourceContext = createContext(null);

// React desmonta uma árvore de cima para baixo: quando `mapaMontado` vira false em
// GeoLocalizacaoScreen, o cleanup do PRÓPRIO `MapView` (`mapa.remove()`) roda antes
// dos cleanups de ShapeSource/FillLayer/LineLayer, que tentam `getLayer`/`removeLayer`/
// `removeSource` num mapa que a biblioteca já destruiu por dentro — lança
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
    // A atribuição ao OpenStreetMap/OpenMapTiles é exigida pelo provedor dos tiles;
    // compacta para não cobrir o card do hospital sobre o mapa.
    const mapa = new maplibregl.Map({
      container: containerRef.current,
      style: styleURL || MAP_STYLE,
      center: [0, 0],
      zoom: 0,
      attributionControl: { compact: true },
    });
    mapRef.current = mapa;
    // `on` e não `once`: o `once` do maplibre-gl v5 também é tipado como Promise, e o
    // `load` só dispara uma vez por mapa.
    mapa.on("load", () => setMapa(mapa));

    // O container muda de altura sem a janela mudar (a mensagem de GPS negado e o
    // botão "Tentar novamente" entram depois do mapa montar e encolhem o
    // `mapContainer`). Com o `mapbox-gl`, que só reagia a resize da janela, o canvas
    // ficava com a altura antiga (615 px num container de 526): mapa descentralizado e
    // ~90 px cortados embaixo. O observador garante o `resize()` em qualquer versão do
    // GL JS. Na versão nativa isso é automático.
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
  const [longitude, latitude] = centerCoordinate ?? [];

  // Posiciona quando o mapa fica pronto e de novo só quando os NÚMEROS mudam (mesma
  // regra do adaptador nativo): o Detalhe do Hospital recentra quando o hospital
  // carrega, e um re-render com a mesma posição não desfaz o zoom do usuário.
  useEffect(() => {
    if (mapa) {
      mapa.jumpTo({ center: [longitude, latitude], zoom: zoomLevel });
    }
  }, [mapa, longitude, latitude, zoomLevel]);

  useImperativeHandle(
    ref,
    () => ({
      setCamera: ({ centerCoordinate: centro, zoomLevel: zoom, animationDuration }) => {
        // Só repassa o que veio: no GL JS, `flyTo({ zoom: undefined })` conta como
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

export function FillLayer({ id, style }) {
  useCamadaGeoJson("fill", id, () => pinturaDoPreenchimento(style));
  return null;
}

export function LineLayer({ id, style }) {
  useCamadaGeoJson("line", id, () => pinturaDaLinha(style));
  return null;
}

// Sem `anchor`: os marcadores do app são simétricos e a âncora padrão (centro) põe a
// coordenada no meio do ícone — ver BUG-10 em GeoLocalizacaoScreen. O GL JS só
// aceita palavras-chave de âncora, não frações como `{x: 0, y: 0.5}` do SDK nativo.
export function MarkerView({ coordinate, children }) {
  const mapa = useContext(MapContext);
  const [elemento] = useState(() => document.createElement("div"));
  const marcadorRef = useRef(null);
  const raizRef = useRef(null);
  const [longitude, latitude] = coordinate;

  useEffect(() => {
    if (!mapa) return undefined;
    const marcador = new maplibregl.Marker({ element: elemento })
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
