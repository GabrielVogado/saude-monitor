import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Camera, GeoJSONSource, Layer, Map, Marker } from "@maplibre/maplibre-react-native";
import { Building2, Clock, Mail, MapPin, Pencil, Phone } from "lucide-react-native";
import {
  CSBadge,
  CSCard,
  CSHeader,
  CSEmptyState,
  CSIconButton,
  CSLoading,
  CSRatingStars,
} from "../../../components";
import { colors, radii, spacing, typography } from "../../../theme/tokens";
import HospitalService from "../service/HospitalService";
import {
  calcularCentroide,
  coordenadasParaGeoJson,
  geojsonParaCoordenadas,
} from "../../../utils/geojson";
import { getInitialViewState, OSM_RASTER_STYLE } from "../../../utils/mapStyle";
import { formatarDuracao, formatarNota } from "../../../utils/format";

const TIPO_LABEL = {
  PUBLICO: "Público",
  PRIVADO: "Privado",
  FILANTROPICO: "Filantrópico",
};

const CATEGORIA_LABEL = {
  HOSPITAL: "Hospital",
  UPA: "UPA",
  UBS: "UBS",
  OUTRO: "Outro",
};

const BRASIL_REGION = {
  latitude: -14.235,
  longitude: -51.9253,
  latitudeDelta: 20,
  longitudeDelta: 20,
};

/**
 * Detalhe público do hospital: dados, geofence no mapa e indicadores.
 */
export default function HospitalDetalheScreen({ navigation, route }) {
  const { id } = route.params || {};

  const [hospital, setHospital] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await HospitalService.buscarPorId(id);
      setHospital(dados);
    } catch (e) {
      setErro(e.message || "Não foi possível carregar o hospital.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (id) carregar();
  }, [id]);

  const coordenadas = useMemo(
    () => (hospital?.geofence ? geojsonParaCoordenadas(hospital.geofence) : []),
    [hospital]
  );
  const geofenceGeoJson = useMemo(
    () => coordenadasParaGeoJson(coordenadas),
    [coordenadas]
  );
  const centroide = useMemo(() => calcularCentroide(coordenadas), [coordenadas]);

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

  if (carregando) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <CSHeader title="Hospital" onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <CSLoading width="90%" height={20} />
          <CSLoading width="60%" height={14} />
          <CSLoading width="100%" height={180} radius={radii.xl} />
        </View>
      </SafeAreaView>
    );
  }

  if (erro || !hospital) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <CSHeader title="Hospital" onBack={() => navigation.goBack()} />
        <CSEmptyState
          icon={MapPin}
          title="Não foi possível carregar"
          message={erro || "Hospital não encontrado."}
          actionLabel="Tentar novamente"
          onAction={carregar}
        />
      </SafeAreaView>
    );
  }

  const indicadores = hospital.indicadores;
  const temIndicadores =
    indicadores?.indicadoresDisponiveis !== false &&
    indicadores?.notaMedia !== null &&
    indicadores?.notaMedia !== undefined;

  // Novos campos (opcionais) — tratados com segurança quando ausentes.
  const tipoUnidade =
    typeof hospital?.tipoUnidade === "string" && hospital.tipoUnidade.trim()
      ? hospital.tipoUnidade
      : null;
  const horarioTexto =
    typeof hospital?.horarioFuncionamento === "string" &&
    hospital.horarioFuncionamento.trim()
      ? hospital.horarioFuncionamento
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <CSHeader
        title={hospital.nome}
        onBack={() => navigation.goBack()}
        rightAction={
          <CSIconButton
            icon={Pencil}
            color={colors.primary}
            accessibilityLabel="Editar hospital"
            onPress={() => navigation.navigate("HospitalForm", { mode: "edit", hospital })}
          />
        }
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {coordenadas.length > 0 ? (
          <View style={styles.mapContainer}>
            <Map style={styles.map} mapStyle={OSM_RASTER_STYLE}>
              <Camera initialViewState={getInitialViewState(region)} />
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
              {centroide ? (
                <Marker lngLat={[centroide.longitude, centroide.latitude]}>
                  <View style={styles.mapMarker}>
                    <Building2 size={18} color={colors.onPrimary} />
                  </View>
                </Marker>
              ) : null}
            </Map>
          </View>
        ) : null}

        <View style={styles.badgesRow}>
          <CSBadge label={TIPO_LABEL[hospital.tipo] || hospital.tipo} variant="info" />
          {hospital.categoria ? (
            <CSBadge
              label={CATEGORIA_LABEL[hospital.categoria] || hospital.categoria}
              variant="neutral"
            />
          ) : null}
          {tipoUnidade ? (
            <CSBadge label={tipoUnidade} variant="warning" />
          ) : null}
          <CSBadge label={hospital.ativo ? "Ativo" : "Inativo"} variant={hospital.ativo ? "positive" : "neutral"} />
        </View>

        <CSCard style={styles.section}>
          <Text style={styles.sectionTitle}>Endereço</Text>
          <View style={styles.infoRow}>
            <MapPin size={18} color={colors.outline} />
            <Text style={styles.infoText}>
              {hospital.endereco?.logradouro}, {hospital.endereco?.cidade} — {hospital.endereco?.uf}
              {hospital.endereco?.cep ? ` · CEP ${hospital.endereco.cep}` : ""}
            </Text>
          </View>
        </CSCard>

        <CSCard style={styles.section}>
          <Text style={styles.sectionTitle}>Contato</Text>
          {hospital.contato?.telefone ? (
            <View style={styles.infoRow}>
              <Phone size={18} color={colors.outline} />
              <Text style={styles.infoText}>{hospital.contato.telefone}</Text>
            </View>
          ) : null}
          {hospital.contato?.email ? (
            <View style={styles.infoRow}>
              <Mail size={18} color={colors.outline} />
              <Text style={styles.infoText}>{hospital.contato.email}</Text>
            </View>
          ) : null}
        </CSCard>

        <CSCard style={styles.section}>
          <Text style={styles.sectionTitle}>Horário de funcionamento</Text>
          <View style={styles.infoRow}>
            <Clock size={18} color={colors.outline} />
            {horarioTexto ? (
              <Text style={styles.infoText}>{horarioTexto}</Text>
            ) : (
              <Text style={styles.infoTextMuted}>Horário não informado</Text>
            )}
          </View>
        </CSCard>

        <CSCard style={styles.section}>
          <Text style={styles.sectionTitle}>Avaliação pública</Text>

          {temIndicadores ? (
            <View style={styles.indicadores}>
              <View style={styles.notaBlock}>
                <Text style={styles.notaValue}>{formatarNota(indicadores.notaMedia)}</Text>
                <CSRatingStars nota={indicadores.notaMedia} size={20} />
                <Text style={styles.notaCount}>
                  {indicadores.nAvaliacoes} avaliações nos últimos 90 dias
                </Text>
              </View>

              {indicadores.tempoMedianoMinutos != null ? (
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Tempo médio de atendimento</Text>
                  <Text style={styles.metricValue}>
                    {formatarDuracao(indicadores.tempoMedianoMinutos)}
                  </Text>
                </View>
              ) : null}

              {indicadores.atualizadoEm ? (
                <Text style={styles.atualizado}>
                  Atualizado em{" "}
                  {new Date(indicadores.atualizadoEm).toLocaleDateString("pt-BR")}
                </Text>
              ) : null}
            </View>
          ) : (
            <Text style={styles.semIndicadores}>
              Ainda sem avaliações suficientes — os indicadores aparecem após pelo menos 5
              avaliações.
            </Text>
          )}
        </CSCard>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  scrollContent: {
    padding: spacing.s4,
    gap: spacing.s4,
    paddingBottom: spacing.s12,
  },
  loadingContainer: {
    padding: spacing.s4,
    gap: spacing.s4,
  },
  mapContainer: {
    borderRadius: radii.xl,
    overflow: "hidden",
  },
  map: {
    height: 200,
    width: "100%",
  },
  mapMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  badgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s2,
  },
  section: {
    gap: spacing.s3,
  },
  sectionTitle: {
    ...typography.titleMd,
    color: colors.onSurface,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.s2,
  },
  infoText: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    flex: 1,
  },
  infoTextMuted: {
    ...typography.bodyMd,
    color: colors.outline,
    fontStyle: "italic",
    flex: 1,
  },
  indicadores: {
    gap: spacing.s4,
  },
  notaBlock: {
    alignItems: "center",
    gap: spacing.s2,
  },
  notaValue: {
    ...typography.displayLg,
    color: colors.onSurface,
  },
  notaCount: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  metricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.s3,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceContainer,
  },
  metricLabel: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
  },
  metricValue: {
    ...typography.titleLg,
    color: colors.onSurface,
  },
  atualizado: {
    ...typography.bodySm,
    color: colors.outline,
  },
  semIndicadores: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
  },
});
