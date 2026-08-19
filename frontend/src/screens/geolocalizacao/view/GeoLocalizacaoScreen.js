import React, { useEffect, useMemo, useRef } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Marker } from "react-native-maps";
import {
  GeolocalizacaoProvider,
  useGeolocalizacao,
} from "../service/GeoLocalizacaoService";

const BRASIL_REGION = {
  latitude: -14.235,
  longitude: -51.9253,
  latitudeDelta: 35,
  longitudeDelta: 35,
};

function GeolocalizacaoContent() {
  const mapRef = useRef(null);
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

  useEffect(() => {
    iniciarMonitoramento();
    return () => {
      pararMonitoramento();
    };
  }, [iniciarMonitoramento, pararMonitoramento]);

  useEffect(() => {
    if (coordenadas) {
      mapRef.current?.animateToRegion(regionAtual, 500);
    }
  }, [coordenadas, regionAtual]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screenHeader}>
        <Text style={styles.screenHeaderTitle}>Mapa de Geolocalizacao</Text>
      </View>

      <MapView ref={mapRef} style={styles.map} initialRegion={BRASIL_REGION}>
        {!coordenadas && (
          <Marker
            coordinate={{
              latitude: BRASIL_REGION.latitude,
              longitude: BRASIL_REGION.longitude,
            }}
            title="Brasil"
            description="Aguardando sua localizacao atual"
          />
        )}

        {coordenadas && (
          <Marker
            coordinate={{
              latitude: coordenadas.latitude,
              longitude: coordenadas.longitude,
            }}
            title="Sua posicao"
            description="Posicao atual em tempo real"
          />
        )}
      </MapView>

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
          <TouchableOpacity
            style={styles.centerButton}
            onPress={() => {
              mapRef.current?.animateToRegion(regionAtual, 500);
            }}
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
});

