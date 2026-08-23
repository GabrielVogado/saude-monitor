import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Camera, GeoJSONSource, Layer, Map, Marker } from "@maplibre/maplibre-react-native";
import { Trash2, Undo2 } from "lucide-react-native";
import { colors, radii, spacing, touchTarget, typography } from "../../../theme/tokens";
import { calcularCentroide, coordenadasParaGeoJson } from "../../../utils/geojson";
import { getInitialViewState, OSM_RASTER_STYLE } from "../../../utils/mapStyle";

const BRASIL_REGION = {
  latitude: -14.235,
  longitude: -51.9253,
  latitudeDelta: 20,
  longitudeDelta: 20,
};

/**
 * Editor de geofence (E1-02): polígono desenhado no mapa via toques.
 * Controlado: `value` = [{ latitude, longitude }] · `onChange` atualiza.
 */
export default function GeofenceEditor({ value = [], onChange }) {
  const vertices = value;

  const centroide = useMemo(() => calcularCentroide(vertices), [vertices]);
  const geofenceGeoJson = useMemo(() => coordenadasParaGeoJson(vertices), [vertices]);

  const region = useMemo(() => {
    if (centroide) {
      return {
        latitude: centroide.latitude,
        longitude: centroide.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
    }
    return BRASIL_REGION;
  }, [centroide]);

  const handlePress = (event) => {
    const [longitude, latitude] = event.nativeEvent.lngLat;
    onChange([...vertices, { latitude, longitude }]);
  };

  const desfazer = () => onChange(vertices.slice(0, -1));
  const limpar = () => onChange([]);

  const valido = vertices.length >= 3;

  return (
    <View style={styles.container}>
      <Map
        style={styles.map}
        mapStyle={OSM_RASTER_STYLE}
        onPress={handlePress}
        accessibilityLabel="Mapa para desenho do polígono de geofence"
      >
        <Camera initialViewState={getInitialViewState(region)} />

        {valido ? (
          <GeoJSONSource id="geofence" data={geofenceGeoJson}>
            <Layer
              type="fill"
              id="geofence-fill"
              paint={{ "fill-color": "rgba(0,97,147,0.16)" }}
            />
            <Layer
              type="line"
              id="geofence-line"
              paint={{ "line-color": colors.primary, "line-width": 2 }}
            />
          </GeoJSONSource>
        ) : null}

        {vertices.map((v, i) => (
          <Marker key={i} lngLat={[v.longitude, v.latitude]} anchor="center">
            <View style={styles.marker}>
              <Text style={styles.markerText}>{i + 1}</Text>
            </View>
          </Marker>
        ))}
      </Map>

      <View style={styles.controls}>
        <Text style={[styles.hint, valido && styles.hintValid]}>
          {vertices.length === 0
            ? "Toque no mapa para adicionar vértices (mínimo 3)."
            : valido
            ? `${vertices.length} vértices — polígono válido.`
            : `${vertices.length} ${vertices.length === 1 ? "vértice" : "vértices"} — adicione pelo menos 3.`}
        </Text>

        <View style={styles.buttonsRow}>
          <Pressable
            accessibilityRole="button"
            onPress={desfazer}
            disabled={vertices.length === 0}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          >
            <Undo2 size={20} color={colors.primary} />
            <Text style={styles.actionText}>Desfazer</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={limpar}
            disabled={vertices.length === 0}
            style={({ pressed }) => [styles.actionBtn, pressed && styles.pressed]}
          >
            <Trash2 size={20} color={colors.error} />
            <Text style={[styles.actionText, { color: colors.error }]}>Limpar</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: radii.xl,
    overflow: "hidden",
    backgroundColor: colors.surfaceContainerLowest,
  },
  map: {
    height: 280,
    width: "100%",
  },
  marker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.onPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  markerText: {
    ...typography.labelSm,
    color: colors.onPrimary,
    fontSize: 10,
  },
  controls: {
    padding: spacing.s4,
    gap: spacing.s3,
  },
  hint: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  hintValid: {
    color: colors.onSecondaryContainer,
  },
  buttonsRow: {
    flexDirection: "row",
    gap: spacing.s3,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s2,
    minHeight: touchTarget.min,
    paddingHorizontal: spacing.s4,
    borderRadius: radii.md,
    backgroundColor: colors.surfaceContainerLow,
  },
  actionText: {
    ...typography.labelLg,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.7,
  },
});
