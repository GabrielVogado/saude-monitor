/**
 * Adaptador do mapa nativo (`@maplibre/maplibre-react-native` v11) para a API que
 * GeoLocalizacaoScreen e HospitalDetalheScreen usam: `MapView`, `Camera` (por ref:
 * `setCamera` e `fitBounds`), `ShapeSource`, `FillLayer`, `LineLayer` e `MarkerView`.
 *
 * As telas importam só daqui. A variante `index.web.js` faz o mesmo papel com
 * `maplibre-gl`, porque a biblioteca nativa não tem build Web. Manter essa API comum
 * deixa a troca de SDK (Mapbox até 11/2026, MapLibre agora) restrita a estes dois
 * arquivos, sem mexer na lógica das telas.
 *
 * A v11 renomeou os componentes e passou a câmera para o modelo do MapLibre GL JS
 * (`setStop` com `center`, `zoom`, `bounds`, `padding` e `duration`). As conversões
 * ficam aqui; não é uma reimplementação genérica, cobre só as props que as telas usam.
 */
import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Camera as CameraMapLibre,
  GeoJSONSource,
  Layer,
  Map as MapaMapLibre,
  Marker,
} from "@maplibre/maplibre-react-native";
import { MAP_STYLE } from "../mapStyle";
import { pinturaDaLinha, pinturaDoPreenchimento } from "./paint";

/**
 * Manda a câmera para uma parada sem derrubar a tela.
 *
 * `setStop` lança se o componente nativo ainda não existe e devolve uma Promise que
 * rejeita se o módulo nativo falhar. Nos dois casos o mapa só deixa de se mover, então
 * basta registrar o aviso.
 */
function moverCamera(camera, parada) {
  try {
    camera?.setStop(parada)?.catch?.((error_) => avisarFalhaDaCamera(error_));
  } catch (error_) {
    avisarFalhaDaCamera(error_);
  }
}

function avisarFalhaDaCamera(erro) {
  // eslint-disable-next-line no-console
  console.warn("mapkit: a câmera não pôde se mover", erro?.message);
}

function paddingEmTodosOsLados(valor = 0) {
  return { top: valor, right: valor, bottom: valor, left: valor };
}

export function MapView({ style, styleURL, onDidFinishLoadingMap, children }) {
  // A v11 entrega um evento nativo; as telas tratam o callback como "mapa pronto", sem
  // argumento (igual ao adaptador Web). Um enquadramento pedido antes disso pode se
  // perder no nativo: por isso a tela enquadra de novo neste aviso.
  const aoTerminarDeCarregar = useCallback(() => onDidFinishLoadingMap?.(), [onDidFinishLoadingMap]);

  return (
    <MapaMapLibre
      style={style}
      mapStyle={styleURL || MAP_STYLE}
      onDidFinishLoadingMap={aoTerminarDeCarregar}
      logo={false}
      attribution
    >
      {children}
    </MapaMapLibre>
  );
}

/**
 * Câmera com posição inicial por props e movimentos por ref.
 *
 * A posição das props entra como `initialViewState` (lida uma vez pelo nativo) e,
 * depois, só um valor NOVO de centro ou zoom move a câmera. Assim um re-render com os
 * mesmos números (cada leitura de GPS em GeoLocalizacaoScreen) não desfaz o zoom do
 * usuário, e o Detalhe do Hospital ainda recentra quando o hospital termina de carregar.
 */
export const Camera = forwardRef(function Camera({ centerCoordinate, zoomLevel }, ref) {
  const cameraRef = useRef(null);
  const [posicaoInicial] = useState(() => ({ center: centerCoordinate, zoom: zoomLevel }));
  const primeiraPosicaoRef = useRef(true);
  const [longitude, latitude] = centerCoordinate ?? [];

  useEffect(() => {
    if (primeiraPosicaoRef.current) {
      primeiraPosicaoRef.current = false;
      return;
    }
    if (longitude === undefined || latitude === undefined) {
      return;
    }
    moverCamera(cameraRef.current, { center: [longitude, latitude], zoom: zoomLevel, duration: 0 });
  }, [longitude, latitude, zoomLevel]);

  useImperativeHandle(
    ref,
    () => ({
      setCamera: ({ centerCoordinate: centro, zoomLevel: zoom, animationDuration }) => {
        // Só repassa o que veio: centralizar sem `zoomLevel` mantém o zoom do usuário.
        const parada = { duration: animationDuration ?? 0, easing: animationDuration ? "ease" : undefined };
        if (centro !== undefined) parada.center = centro;
        if (zoom !== undefined) parada.zoom = zoom;
        moverCamera(cameraRef.current, parada);
      },
      // Mesma assinatura do SDK anterior: cantos nordeste e sudoeste `[lng, lat]`. A v11
      // recebe a caixa como `[oeste, sul, leste, norte]`.
      fitBounds: (nordeste, sudoeste, padding, duration) => {
        moverCamera(cameraRef.current, {
          bounds: [sudoeste[0], sudoeste[1], nordeste[0], nordeste[1]],
          padding: paddingEmTodosOsLados(padding),
          duration: duration ?? 0,
          easing: duration ? "ease" : undefined,
        });
      },
    }),
    []
  );

  return <CameraMapLibre ref={cameraRef} initialViewState={posicaoInicial} />;
});

/**
 * Fonte GeoJSON. O toque devolve `{ features }`, como as telas esperam; a v11 entrega
 * as features dentro de `nativeEvent`.
 */
export function ShapeSource({ id, shape, onPress, testID, children }) {
  // A biblioteca serializa um objeto a cada render; com ~340 geofences e um render por
  // leitura de GPS, serializar só quando o GeoJSON muda poupa a thread de JS.
  const dados = useMemo(() => JSON.stringify(shape), [shape]);
  const aoTocar = useCallback((evento) => onPress?.({ features: evento?.nativeEvent?.features ?? [] }), [onPress]);

  return (
    <GeoJSONSource id={id} testID={testID} data={dados} onPress={onPress ? aoTocar : undefined}>
      {children}
    </GeoJSONSource>
  );
}

// `source` chega injetado pela `GeoJSONSource` (ela clona os filhos com o próprio id).
export function FillLayer({ id, source, style }) {
  return <Layer type="fill" id={id} source={source} paint={pinturaDoPreenchimento(style)} />;
}

export function LineLayer({ id, source, style }) {
  return <Layer type="line" id={id} source={source} paint={pinturaDaLinha(style)} />;
}

// Âncora no centro (padrão da v11): os marcadores do app são simétricos e a coordenada
// fica no meio do ícone, o que mantém o marcador dentro do geofence (BUG-10).
export function MarkerView({ coordinate, testID, children }) {
  return (
    <Marker lngLat={coordinate} testID={testID}>
      {children}
    </Marker>
  );
}
