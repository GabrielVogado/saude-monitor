import * as Location from "expo-location";

/**
 * Idade máxima de uma leitura de GPS em cache para ainda valer como "onde a pessoa está"
 * no momento do toque em "Check-in".
 */
const IDADE_MAXIMA_POSICAO_MS = 2 * 60 * 1000;

/**
 * Prazo para uma leitura ao vivo responder. É uma ação de toque: melhor seguir sem
 * posição do que deixar o botão parado esperando o GPS.
 */
const TIMEOUT_LEITURA_GPS_MS = 5 * 1000;

function aguardarComTimeout(promise, timeoutEmMs) {
  let timer;
  return Promise.race([
    promise,
    new Promise((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error("timeout")), timeoutEmMs);
    }),
  ]).finally(() => clearTimeout(timer));
}

function converterParaGeoJson(coords) {
  return { type: "Point", coordinates: [coords.longitude, coords.latitude] };
}

/**
 * Posição atual para o check-in manual (SEG-01), ou `undefined` quando não houver.
 *
 * O check-in manual continua valendo de qualquer lugar. Com a posição, o servidor confere
 * se a pessoa está no hospital, e só então a visita e a avaliação dela entram no indicador
 * público. Nunca pede permissão: o check-in manual é justamente o caminho de quem negou
 * a localização, e um diálogo aqui atrasaria o toque.
 */
export async function obterPosicaoParaCheckinManual() {
  try {
    const { granted } = await Location.getForegroundPermissionsAsync();
    if (!granted) {
      return undefined;
    }
    const recente = await Location.getLastKnownPositionAsync({ maxAge: IDADE_MAXIMA_POSICAO_MS });
    if (recente) {
      return converterParaGeoJson(recente.coords);
    }
    const atual = await aguardarComTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      TIMEOUT_LEITURA_GPS_MS
    );
    return converterParaGeoJson(atual.coords);
  } catch {
    return undefined;
  }
}
