/**
 * Estilo do mapa (MapLibre + OpenFreeMap) e conversão de região legada em posição de
 * câmera.
 */
import { getInitialViewState, MAP_STYLE } from "../../utils/mapStyle";

describe("MAP_STYLE", () => {
  test("usa o estilo vetorial Liberty do OpenFreeMap, que não exige chave de acesso", () => {
    expect(MAP_STYLE).toBe("https://tiles.openfreemap.org/styles/liberty");
  });
});

describe("getInitialViewState", () => {
  test("converte o longitudeDelta em zoom por log2(360 / delta)", () => {
    expect(getInitialViewState({ latitude: -15.8, longitude: -47.9, longitudeDelta: 0.02 })).toEqual(
      { centerCoordinate: [-47.9, -15.8], zoomLevel: 14 }
    );
    expect(getInitialViewState({ latitude: 0, longitude: 0, longitudeDelta: 35 })).toEqual({
      centerCoordinate: [0, 0],
      zoomLevel: 3,
    });
  });

  test("sem longitudeDelta, assume 0.02 — o enquadramento de um hospital", () => {
    expect(getInitialViewState({ latitude: -15.8, longitude: -47.9 }).zoomLevel).toBe(14);
  });

  test("nunca devolve zoom fora de [0, 19]", () => {
    expect(getInitialViewState({ latitude: 0, longitude: 0, longitudeDelta: 0.0000001 }).zoomLevel).toBe(19);
    expect(getInitialViewState({ latitude: 0, longitude: 0, longitudeDelta: 100000 }).zoomLevel).toBe(0);
  });

  test("sem região, não quebra — devolve coordenadas indefinidas no zoom padrão", () => {
    // A tela chama isto com o que tiver; um `undefined` aqui não pode derrubar o mapa.
    expect(getInitialViewState()).toEqual({ centerCoordinate: [undefined, undefined], zoomLevel: 14 });
  });
});
