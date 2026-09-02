// ADR-002 (Documentos/02-arquitetura-tecnica/Arvore-Tecnologica-v2.0.md): geofencing
// nativo (expo-task-manager + startGeofencingAsync, ver `GeofencingTaskService.js`) é a
// fonte de verdade do ciclo de vida das visitas (check-in/checkout automáticos, E2-01/02).
// Esta tela permanece apenas como ferramenta de depuração/mapa com `watchPositionAsync`
// em foreground — não dispara check-in/checkout e não deve ser alterada para isso.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, GeoJSONSource, Layer, Map, Marker } from "@maplibre/maplibre-react-native";
import {
  GeolocalizacaoProvider,
  useGeolocalizacao,
} from "../service/GeoLocalizacaoService";
import { getInitialViewState, OSM_RASTER_STYLE } from "../../../utils/mapStyle";
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

  const carregarHospitais = useCallback(async () => {
    const posicao = posicaoRef.current;

    // Filtro por raio exige posição: sem GPS, mantém o catálogo completo.
    const filtros =
      raioKm !== null && posicao
        ? {
            latitude: posicao.latitude,
            longitude: posicao.longitude,
            raioKm,
            size: 100,
          }
        : { size: 100 };

    setErroHospitais(null);
    try {
      const data = await HospitalService.listar(filtros);
      setHospitais(data?.content || data || []);
    } catch (e) {
      setErroHospitais(e.message || "Não foi possível carregar os hospitais.");
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

  // Toque no polígono abre o detalhe do hospital (aba Hospitais → HospitalDetalhe).
  const abrirHospital = (hospitalId) => {
    if (!hospitalId) {
      return;
    }
    navigation?.navigate?.("Hospitais", {
      screen: "HospitalDetalhe",
      params: { id: hospitalId },
    });
  };

  const aoTocarGeofence = (evento) => {
    const feature = evento?.features?.[0];
    abrirHospital(feature?.properties?.id || feature?.id);
  };

  const centralizar = () => {
    const alvo = getInitialViewState(regionAtual);
    cameraRef.current?.easeTo({
      center: alvo.center,
      zoom: alvo.zoom,
      duration: 500,
    });
  };

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

  useEffect(() => {
    if (hospitais.length > 0) {
      enquadrarHospitais();
    }
  }, [hospitais, enquadrarHospitais]);

  useEffect(() => {
    iniciarMonitoramento();
    return () => {
      pararMonitoramento();
    };
  }, [iniciarMonitoramento, pararMonitoramento]);

  // Centraliza no GPS apenas quando não há hospitais enquadrados (ex.: base sem
  // cadastro); com hospitais, o usuário usa o botão "Centralizar no meu GPS".
  useEffect(() => {
    if (coordenadas && hospitais.length === 0) {
      centralizar();
    }
  }, [coordenadas, regionAtual, hospitais.length]);

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

      <Map style={styles.map} mapStyle={OSM_RASTER_STYLE}>
        <Camera ref={cameraRef} initialViewState={getInitialViewState(BRASIL_REGION)} />

        {!coordenadas && !hospitais.length && (
          <Marker lngLat={[BRASIL_REGION.longitude, BRASIL_REGION.latitude]}>
            <View style={styles.markerDot} />
          </Marker>
        )}

        {geofencesFeatureCollection.features.length > 0 && (
          <GeoJSONSource
            id="geofences-hospitais"
            testID="geofences-hospitais"
            data={geofencesFeatureCollection}
            onPress={aoTocarGeofence}
          >
            <Layer
              id="geofences-preenchimento"
              type="fill"
              paint={{ "fill-color": colors.primary, "fill-opacity": 0.18 }}
            />
            <Layer
              id="geofences-contorno"
              type="line"
              paint={{ "line-color": colors.primary, "line-width": 2 }}
            />
          </GeoJSONSource>
        )}

        {hospitais.map((hospital) => {
          const centroide = centroDoHospital(hospital);
          if (!centroide) {
            return null;
          }
          return (
            <Marker key={hospital.id} lngLat={[centroide.longitude, centroide.latitude]}>
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
            </Marker>
          );
        })}

        {coordenadas && (
          <Marker lngLat={[coordenadas.longitude, coordenadas.latitude]}>
            <View style={styles.userDot} />
          </Marker>
        )}
      </Map>

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