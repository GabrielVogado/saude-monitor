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
        <Text style={styles.screenHeaderTitle}>Mapa de Geolocalizacao</Text>
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
            <ActivityIndicator size="small" color="#0C4A6E" />
            <Text style={styles.infoText}>Monitorando GPS em tempo real...</Text>
          </View>
        )}

        {!carregando && coordenadas && (
          <>
            <Text style={styles.title}>Localizacao atual</Text>
            <Text style={styles.infoText}>Latitude: {coordenadas.latitude.toFixed(6)}</Text>
            <Text style={styles.infoText}>Longitude: {coordenadas.longitude.toFixed(6)}</Text>
            <Text style={styles.infoSubText}>
              Precisao: {coordenadas.accuracy ? `${Math.round(coordenadas.accuracy)}m` : "N/D"}
            </Text>
          </>
        )}

        {!coordenadas && !carregando && permissaoConcedida && (
          <Text style={styles.infoText}>Aguardando primeira leitura do GPS...</Text>
        )}

        {erro && <Text style={styles.errorText}>{erro}</Text>}

        {!!erro && (
          <TouchableOpacity style={styles.retryButton} onPress={iniciarMonitoramento}>
            <Text style={styles.retryText}>Tentar novamente</Text>
          </TouchableOpacity>
        )}

        {!!coordenadas && (
          <TouchableOpacity style={styles.centerButton} onPress={centralizar}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  screenHeader: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, backgroundColor: "#FFFFFF" },
  screenHeaderTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  map: { flex: 1 },
  infoBox: { backgroundColor: "#F8FAFC", borderTopWidth: 1, borderColor: "#E2E8F0", paddingHorizontal: 16, paddingVertical: 12 },
  title: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 6 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoText: { color: "#334155", fontSize: 14 },
  infoSubText: { color: "#64748B", fontSize: 13, marginTop: 2 },
  errorText: { color: "#B91C1C", marginTop: 10, fontSize: 13 },
  retryButton: { marginTop: 10, alignSelf: "flex-start", backgroundColor: "#0EA5E9", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  retryText: { color: "#FFFFFF", fontWeight: "600" },
  centerButton: { marginTop: 10, alignSelf: "flex-start", backgroundColor: "#0C4A6E", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  centerText: { color: "#FFFFFF", fontWeight: "600" },
  markerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#64748B",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  userDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#0C4A6E",
    borderWidth: 3,
    borderColor: "#FFFFFF",
  },
});
