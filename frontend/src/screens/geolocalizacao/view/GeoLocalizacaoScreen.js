// ADR-002 (Documentos/02-arquitetura-tecnica/Arvore-Tecnologica-v2.0.md): geofencing
// nativo (expo-task-manager + startGeofencingAsync, ver `GeofencingTaskService.js`) é a
// fonte de verdade do ciclo de vida das visitas (check-in/checkout automáticos, E2-01/02).
// Esta tela permanece apenas como ferramenta de depuração/mapa com `watchPositionAsync`
// em foreground — não dispara check-in/checkout e não deve ser alterada para isso.
import React, { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, Map, Marker } from "@maplibre/maplibre-react-native";
import {
  GeolocalizacaoProvider,
  useGeolocalizacao,
} from "../service/GeoLocalizacaoService";
import { getInitialViewState, OSM_RASTER_STYLE } from "../../../utils/mapStyle";
import { colors, typography, spacing, radii } from "../../../theme";

const BRASIL_REGION = {
  latitude: -14.235,
  longitude: -51.9253,
  latitudeDelta: 35,
  longitudeDelta: 35,
};

function GeolocalizacaoContent() {
  const cameraRef = useRef(null);
  const {
    coordenadas,
    carregando,
    permissaoConcedida,
    erro,
    iniciarMonitoramento,
    pararMonitoramento,
  } = useGeolocalizacao();

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

  const centralizar = () => {
    const alvo = getInitialViewState(regionAtual);
    cameraRef.current?.easeTo({
      center: alvo.center,
      zoom: alvo.zoom,
      duration: 500,
    });
  };

  useEffect(() => {
    iniciarMonitoramento();
    return () => {
      pararMonitoramento();
    };
  }, [iniciarMonitoramento, pararMonitoramento]);

  useEffect(() => {
    if (coordenadas) {
      centralizar();
    }
  }, [coordenadas, regionAtual]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenHeaderTitle}>Mapa de Geolocalização</Text>
      </View>

      <Map style={styles.map} mapStyle={OSM_RASTER_STYLE}>
        <Camera ref={cameraRef} initialViewState={getInitialViewState(BRASIL_REGION)} />

        {!coordenadas && (
          <Marker lngLat={[BRASIL_REGION.longitude, BRASIL_REGION.latitude]}>
            <View style={styles.markerDot} />
          </Marker>
        )}

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

export default function GeoLocalizacaoScreen() {
  return (
    <GeolocalizacaoProvider>
      <GeolocalizacaoContent />
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
});