// ADR-002 (Documentos/02-arquitetura-tecnica/Arvore-Tecnologica-v2.0.md): geofencing
// nativo (expo-task-manager + startGeofencingAsync, ver `GeofencingTaskService.js`) é a
// fonte de verdade do ciclo de vida das visitas (check-in/checkout automáticos, E2-01/02).
// Esta tela permanece apenas como ferramenta de depuração/mapa com `watchPositionAsync`
// em foreground — não dispara check-in/checkout e não deve ser alterada para isso.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, FillLayer, LineLayer, MapView, MarkerView, ShapeSource } from "@rnmapbox/maps";
import {
  GeolocalizacaoProvider,
  useGeolocalizacao,
} from "../service/GeoLocalizacaoService";
import { getInitialViewState, MAPBOX_STYLE } from "../../../utils/mapStyle";
import {
  centroDoHospital,
  geofencesParaFeatureCollection,
} from "../../../utils/geojson";
import HospitalService from "../../hospitais/service/HospitalService";
import { CSChip } from "../../../components";
import { colors, typography, spacing, radii } from "../../../theme";

// F-07: filtro geo por raio. "Todos" mantém o comportamento anterior (catálogo
// completo); os demais dependem do GPS e são resolvidos pelo backend
// (GET /api/v1/hospitais?latitude&longitude&raioKm).
const RAIOS_KM = [
  { value: null, label: "Todos" },
  { value: 1, label: "1 km" },
  { value: 5, label: "5 km" },
  { value: 10, label: "10 km" },
  { value: 25, label: "25 km" },
];

const BRASIL_REGION = {
  latitude: -14.235,
  longitude: -51.9253,
  latitudeDelta: 35,
  longitudeDelta: 35,
};

function GeolocalizacaoContent({ navigation }) {
  const cameraRef = useRef(null);
  const {
    coordenadas,
    carregando,
    permissaoConcedida,
    erro,
    iniciarMonitoramento,
    pararMonitoramento,
  } = useGeolocalizacao();
  const [hospitais, setHospitais] = useState([]);
  const [erroHospitais, setErroHospitais] = useState(null);
  const [raioKm, setRaioKm] = useState(null);

  // Item 05 (revisão de UX) + F-07: o mapa exibe todos os hospitais ativos e, quando
  // há um raio selecionado com GPS disponível, delega o recorte geográfico ao backend
  // (`raioKm`) em vez de baixar o catálogo inteiro — mitigação do risco de performance
  // com muitos polígonos (§21.6 do Plano de Sprints).
  const posicaoRef = useRef(null);
  posicaoRef.current = coordenadas;
  const temGps = coordenadas !== null;

  // Identifica a carga em andamento: ao trocar o raio (ou o GPS aparecer/desaparecer)
  // no meio da paginação incremental abaixo, a chamada antiga precisa parar de
  // escrever no estado em vez de sobrescrever a lista da carga nova.
  const cargaEmAndamentoRef = useRef(0);

  const carregarHospitais = useCallback(async () => {
    const posicao = posicaoRef.current;
    const idCarga = ++cargaEmAndamentoRef.current;

    setErroHospitais(null);

    // Filtro por raio exige posição: sem GPS, mantém o catálogo completo (bloco abaixo).
    if (raioKm !== null && posicao) {
      // O recorte geográfico já restringe o resultado a poucos hospitais — cabe
      // numa única página.
      try {
        const data = await HospitalService.listar({
          latitude: posicao.latitude,
          longitude: posicao.longitude,
          raioKm,
          size: 100,
        });
        if (cargaEmAndamentoRef.current === idCarga) {
          setHospitais(data?.content || data || []);
        }
      } catch (e) {
        if (cargaEmAndamentoRef.current === idCarga) {
          setErroHospitais(e.message || "Não foi possível carregar os hospitais.");
        }
      }
      return;
    }

    // "Todos": o catálogo (~340 hospitais) excede o `size` máximo aceito pelo
    // backend (100, ver HospitalController). Busca todas as páginas em sequência
    // e vai atualizando o mapa lote a lote — mostrar todas as unidades (item 05)
    // sem voltar a montar centenas de marcadores numa única leva, que era o risco
    // de ANR já mitigado (Plano-Sprints-v2.1 §21.6 / BUG-04 no topo deste arquivo).
    let pagina = 0;
    let acumulado = [];
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const data = await HospitalService.listar({ page: pagina, size: 100 });
        if (cargaEmAndamentoRef.current !== idCarga) {
          return;
        }

        const lote = data?.content || [];
        acumulado = pagina === 0 ? lote : acumulado.concat(lote);
        setHospitais(acumulado);

        const total = data?.totalElements ?? acumulado.length;
        if (lote.length === 0 || acumulado.length >= total) {
          break;
        }
        pagina += 1;
      }
    } catch (e) {
      if (cargaEmAndamentoRef.current === idCarga) {
        setErroHospitais(e.message || "Não foi possível carregar os hospitais.");
      }
    }
  }, [raioKm]);

  // Refaz a busca ao trocar o raio e quando o GPS passa a ter (ou perde) posição.
  // Não depende de `coordenadas` diretamente: a posição muda a cada leitura do
  // watchPosition e dispararia uma requisição por atualização.
  useEffect(() => {
    carregarHospitais();
  }, [carregarHospitais, temGps]);

  const regionAtual = useMemo(() => {
    if (!coordenadas) {
      return BRASIL_REGION;
    }

    return {
      latitude: coordenadas.latitude,
      longitude: coordenadas.longitude,
      latitudeDelta: 0.015,
      longitudeDelta: 0.015,
    };
  }, [coordenadas]);

  // F-07: polígonos das geofences renderizados como uma única fonte GeoJSON —
  // muito mais leve que um componente por hospital.
  const geofencesFeatureCollection = useMemo(
    () => geofencesParaFeatureCollection(hospitais),
    [hospitais]
  );

  /**
   * BUG-04 — o mapa precisa ser DESTRUÍDO, não apenas escondido, antes de sair da tela.
   *
   * Navegar direto daqui congelava o app (ANR de 30 a 40 s, 8 ocorrências registradas
   * entre 02/09 e 04/09/2026, sob o MapLibre). A corrida, medida no logcat do S24 Ultra:
   *
   *   14:40:04.115  dedo sobe
   *   14:40:04.140  navigation.navigate      → React Navigation esconde a aba Mapa
   *   14:40:04.166  surfaceDestroyed         → a thread de renderização GL é encerrada
   *   14:40:04.330  handleMessage TAP        → o Android entrega o toque CONFIRMADO,
   *                                            164 ms depois do teardown
   *
   * Esse toque atrasado (o Android segura ~215 ms para distinguir de duplo-toque)
   * caía no mapa sem renderizador vivo e travava a thread principal sem timeout, até
   * o usuário matar o app. A ordem abaixo elimina a corrida em vez de adivinhar o
   * atraso: desmonta o `<MapView>` primeiro, e só no efeito seguinte — depois de o
   * desmonte estar comprometido na árvore — é que navega.
   *
   * Mantido na migração Mapbox (`feature/mapbox-migration`): o mecanismo da trava foi
   * verificado no bytecode do MapLibre, não no Mapbox — mas desmontar-antes-de-navegar
   * continua sendo a ordem segura também aqui (view destruída não recebe toque
   * atrasado), e os testes de regressão abaixo seguem protegendo a ORDEM.
   */
  const [mapaMontado, setMapaMontado] = useState(true);
  const hospitalPendente = useRef(null);

  const abrirHospital = (hospitalId) => {
    if (!hospitalId) {
      return;
    }

    // Só desmonta se houver para onde ir. Desmontar primeiro e descobrir depois que a
    // navegação não acontece deixaria a tela SEM MAPA e sem saída: quem remonta é o
    // evento `focus`, que exige a tela ter perdido o foco antes — e ela não perde se a
    // navegação não ocorreu. O usuário ficaria olhando um buraco entre o cabeçalho e a
    // caixa de informações até trocar de aba.
    if (typeof navigation?.navigate !== "function") {
      return;
    }

    hospitalPendente.current = hospitalId;
    setMapaMontado(false);
  };

  useEffect(() => {
    if (mapaMontado || !hospitalPendente.current) {
      return;
    }

    const id = hospitalPendente.current;
    hospitalPendente.current = null;
    // Achado de 10/09/2026: navegar para a pilha da aba Hospitais (em vez da
    // própria pilha da aba Mapa, "MapaStack" em App.js) trocava de aba por baixo
    // dos panos — voltar do detalhe pousava na lista de Hospitais, não no mapa.
    navigation?.navigate?.("HospitalDetalhe", { id });
  }, [mapaMontado, navigation]);

  // Remonta o mapa ao voltar para a aba. Usa o listener do `navigation` em vez de
  // `useFocusEffect` de propósito: o hook exige um NavigationContainer em volta, e esta
  // tela é renderizada isolada nos testes.
  useEffect(() => {
    const remover = navigation?.addListener?.("focus", () => setMapaMontado(true));
    return () => remover?.();
  }, [navigation]);

  const aoTocarGeofence = (evento) => {
    const feature = evento?.features?.[0];
    abrirHospital(feature?.properties?.id || feature?.id);
  };

  const centralizar = () => {
    const alvo = getInitialViewState(regionAtual);
    cameraRef.current?.setCamera({
      centerCoordinate: alvo.centerCoordinate,
      zoomLevel: alvo.zoomLevel,
      animationDuration: 500,
    });
  };

  // Posição inicial da câmera, calculada uma vez por montagem: a `Camera` do Mapbox
  // acompanha mudanças de props, então recalcular a cada render moveria o mapa
  // sozinho sempre que o GPS atualizasse. O enquadramento nos hospitais continua
  // por conta do efeito `enquadrarHospitais` (fitBounds) abaixo.
  const cameraInicial = useMemo(() => getInitialViewState(BRASIL_REGION), []);

  // Enquadra a câmera para cobrir todos os hospitais cadastrados (item 05) sempre
  // que a lista carregar — assim o "todos os hospitais" é visível de imediato.
  const enquadrarHospitais = useCallback(() => {
    const pontos = hospitais
      .map((h) => centroDoHospital(h))
      .filter(Boolean);
    if (pontos.length === 0) {
      return;
    }

    const lats = pontos.map((p) => p.latitude);
    const lngs = pontos.map((p) => p.longitude);
    cameraRef.current?.fitBounds(
      [Math.max(...lngs), Math.max(...lats)],
      [Math.min(...lngs), Math.min(...lats)],
      48,
      600
    );
  }, [hospitais]);

  // `mapaMontado` entra nas dependências porque o remonte cria uma `<Camera>` NOVA, com
  // a posição inicial de volta em BRASIL_REGION (zoom 3, o país inteiro). Sem re-rodar
  // o enquadramento aqui, quem aproximasse o próprio bairro, tocasse num hospital e
  // voltasse encontraria o mapa zerado. As outras dependências não bastam: a
  // identidade de `hospitais` não muda no desmonte/remonte, então o efeito não
  // dispararia sozinho.
  useEffect(() => {
    if (mapaMontado && hospitais.length > 0) {
      enquadrarHospitais();
    }
  }, [mapaMontado, hospitais, enquadrarHospitais]);

  useEffect(() => {
    iniciarMonitoramento();
    return () => {
      pararMonitoramento();
    };
  }, [iniciarMonitoramento, pararMonitoramento]);

  // Centraliza no GPS apenas quando não há hospitais enquadrados (ex.: base sem
  // cadastro); com hospitais, o usuário usa o botão "Centralizar no meu GPS".
  // Mesmo motivo do efeito acima: sem `mapaMontado` na lista, a base sem hospitais
  // cadastrados voltaria do detalhe enquadrando o Brasil em vez da posição do usuário.
  useEffect(() => {
    if (mapaMontado && coordenadas && hospitais.length === 0) {
      centralizar();
    }
  }, [mapaMontado, coordenadas, regionAtual, hospitais.length]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenHeaderTitle}>Mapa de Geolocalização</Text>

        {/* F-07: filtro geográfico por raio a partir da posição atual. */}
        <View style={styles.filtroRaio}>
          {RAIOS_KM.map((r) => (
            <CSChip
              key={r.label}
              label={r.label}
              selected={raioKm === r.value}
              onPress={() => setRaioKm(r.value)}
            />
          ))}
        </View>

        {raioKm !== null && !coordenadas && (
          <Text style={styles.infoSubText} accessibilityLiveRegion="polite">
            Aguardando o GPS para filtrar hospitais num raio de {raioKm} km.
          </Text>
        )}
      </View>

      {/*
       * BUG-05 — o recorte do mapa é NOSSO, porque a biblioteca desliga o dela.
       *
       * Ao arrastar o mapa, os nomes dos hospitais apareciam por cima do cabeçalho e
       * da caixa de informações — cobrindo justamente os chips de raio, que ficavam
       * ilegíveis e sem alvo visível. Cada marcador (`MarkerView`) é uma View comum,
       * posicionada por coordenada absoluta de projeção: fora da viewport a posição
       * fica negativa (ou maior que a altura) e o desenho escapa para o resto da tela.
       *
       * Basta um ancestral recortando para conter tudo: `overflow: "hidden"` neste
       * container faz o RN limitar o canvas à área do mapa. Mantido na migração
       * Mapbox — o `MarkerView` tem o mesmo modelo de posicionamento.
       *
       * O container também substitui o placeholder que existia aqui: ele tem `flex: 1`
       * e permanece montado quando o `<MapView>` sai (ver `abrirHospital`), então a
       * caixa de informações não salta para junto do cabeçalho no quadro da transição.
       */}
      <View style={styles.mapContainer} testID="mapa-container">
        {/* Desmontado de propósito antes de navegar — ver o comentário do `abrirHospital`. */}
        {mapaMontado ? (
          <MapView style={styles.map} styleURL={MAPBOX_STYLE}>
            <Camera
              ref={cameraRef}
              centerCoordinate={cameraInicial.centerCoordinate}
              zoomLevel={cameraInicial.zoomLevel}
            />

            {!coordenadas && !hospitais.length && (
              <MarkerView coordinate={[BRASIL_REGION.longitude, BRASIL_REGION.latitude]}>
                <View style={styles.markerDot} />
              </MarkerView>
            )}

            {geofencesFeatureCollection.features.length > 0 && (
              <ShapeSource
                id="geofences-hospitais"
                testID="geofences-hospitais"
                shape={geofencesFeatureCollection}
                onPress={aoTocarGeofence}
              >
                <FillLayer
                  id="geofences-preenchimento"
                  style={{ fillColor: colors.primary, fillOpacity: 0.18 }}
                />
                <LineLayer
                  id="geofences-contorno"
                  style={{ lineColor: colors.primary, lineWidth: 2 }}
                />
              </ShapeSource>
            )}

            {hospitais.map((hospital) => {
              const centroide = centroDoHospital(hospital);
              if (!centroide) {
                return null;
              }
              return (
                <MarkerView
                  key={hospital.id}
                  coordinate={[centroide.longitude, centroide.latitude]}
                >
                  <View
                    style={styles.hospitalMarker}
                    accessibilityRole="button"
                    accessibilityLabel={`Abrir detalhe de ${hospital.nome}`}
                    onStartShouldSetResponder={() => true}
                    onResponderRelease={() => abrirHospital(hospital.id)}
                  >
                    <View style={styles.hospitalDot} />
                    <View style={styles.hospitalLabelBox}>
                      <Text style={styles.hospitalLabel} numberOfLines={1}>
                        {hospital.nome}
                      </Text>
                    </View>
                  </View>
                </MarkerView>
              );
            })}

            {coordenadas && (
              <MarkerView coordinate={[coordenadas.longitude, coordenadas.latitude]}>
                <View style={styles.userDot} />
              </MarkerView>
            )}
          </MapView>
        ) : null}
      </View>

      <View style={styles.infoBox}>
        {carregando && (
          <View style={styles.loadingRow}>
            <ActivityIndicator
              size="small"
              color={colors.primary}
              accessibilityLabel="Carregando localização"
            />
            <Text style={styles.infoText}>Monitorando GPS em tempo real...</Text>
          </View>
        )}

        {!carregando && coordenadas && (
          <>
            <Text style={styles.title}>Localização atual</Text>
            <Text style={styles.infoText}>Latitude: {coordenadas.latitude.toFixed(6)}</Text>
            <Text style={styles.infoText}>Longitude: {coordenadas.longitude.toFixed(6)}</Text>
            <Text style={styles.infoSubText}>
              Precisão: {coordenadas.accuracy ? `${Math.round(coordenadas.accuracy)}m` : "N/D"}
            </Text>
          </>
        )}

        {!coordenadas && !carregando && permissaoConcedida && (
          <Text style={styles.infoText}>Aguardando primeira leitura do GPS...</Text>
        )}

        {erro && (
          <Text style={styles.errorText} accessibilityLiveRegion="polite">
            {erro}
          </Text>
        )}

        {erroHospitais && (
          <Text style={styles.errorText} accessibilityLiveRegion="polite">
            {erroHospitais}
          </Text>
        )}

        {!!erro && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={iniciarMonitoramento}
            accessibilityRole="button"
            accessibilityLabel="Tentar novamente"
          >
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        )}

        {!!coordenadas && (
          <TouchableOpacity
            style={styles.centerButton}
            onPress={centralizar}
            accessibilityRole="button"
            accessibilityLabel="Centralizar no meu GPS"
          >
            <Text style={styles.centerText}>Centralizar no meu GPS</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

export default function GeoLocalizacaoScreen({ navigation }) {
  return (
    <GeolocalizacaoProvider>
      <GeolocalizacaoContent navigation={navigation} />
    </GeolocalizacaoProvider>
  );
}

// E6-02: cores migradas para os tokens do Design System v2.0.
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surfaceContainerLowest },
  screenHeader: {
    paddingHorizontal: spacing.s4,
    paddingTop: spacing.s3,
    paddingBottom: spacing.s2,
    backgroundColor: colors.surfaceContainerLowest,
  },
  screenHeaderTitle: { ...typography.titleMd, color: colors.onSurface },
  filtroRaio: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s2,
    marginTop: spacing.s2,
  },
  // `overflow: "hidden"` não é enfeite: é o único recorte da subárvore do mapa.
  // Ver o comentário do JSX (BUG-05) — o `MarkerView` posiciona marcadores fora da
  // viewport, e sem este container os rótulos dos hospitais vazam por cima do
  // cabeçalho e da caixa de informações.
  mapContainer: { flex: 1, overflow: "hidden" },
  map: { flex: 1 },
  infoBox: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.outlineVariant,
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s3,
  },
  title: { ...typography.titleMd, color: colors.onSurface, marginBottom: spacing.s2 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: spacing.s2 },
  infoText: { color: colors.onSurfaceVariant, ...typography.bodyMd },
  infoSubText: { color: colors.onSurfaceVariant, fontSize: 13, marginTop: 2 },
  errorText: { color: colors.error, marginTop: spacing.s3, fontSize: 13 },
  retryButton: {
    marginTop: spacing.s3,
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
    borderRadius: radii.sm,
    minHeight: 48,
    justifyContent: "center",
  },
  retryText: { color: colors.onPrimary, fontWeight: "600" },
  centerButton: {
    marginTop: spacing.s3,
    alignSelf: "flex-start",
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.s3,
    paddingVertical: spacing.s2,
    borderRadius: radii.sm,
    minHeight: 48,
    justifyContent: "center",
  },
  centerText: { color: colors.onPrimary, fontWeight: "600" },
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.outline,
    borderWidth: 2,
    borderColor: colors.surfaceContainerLowest,
  },
  userDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.surfaceContainerLowest,
  },
  hospitalMarker: {
    flexDirection: "row",
    alignItems: "center",
  },
  hospitalDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.geoActive,
    borderWidth: 3,
    borderColor: colors.surfaceContainerLowest,
  },
  hospitalLabelBox: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xs,
    paddingHorizontal: spacing.s2,
    paddingVertical: 2,
    marginLeft: spacing.s1,
  },
  hospitalLabel: {
    ...typography.labelSm,
    color: colors.onSurface,
    maxWidth: 140,
  },
});