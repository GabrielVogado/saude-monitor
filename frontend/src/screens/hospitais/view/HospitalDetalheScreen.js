import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Camera, GeoJSONSource, Layer, Map, Marker } from "@maplibre/maplibre-react-native";
import { Building2, Clock, Mail, MapPin, Phone } from "lucide-react-native";
import {
  CSBadge,
  CSButton,
  CSCard,
  CSHeader,
  CSEmptyState,
  CSLoading,
  CSRatingStars,
} from "../../../components";
import { colors, radii, spacing, typography } from "../../../theme/tokens";
import HospitalService from "../service/HospitalService";
import VisitaService from "../../visitas/service/VisitaService";
import { agendarFeedback } from "../../feedback/service/FeedbackNotificationService";
import {
  calcularCentroide,
  coordenadasParaGeoJson,
  geojsonParaCoordenadas,
} from "../../../utils/geojson";
import { getInitialViewState, OSM_RASTER_STYLE } from "../../../utils/mapStyle";
import {
  formatarData,
  formatarDuracao,
  formatarNota,
  formatarPeriodo,
} from "../../../utils/format";

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
  const [indicadores, setIndicadores] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  // Navegação revisada: visita ativa do modo MANUAL deste hospital — exibe temporizador
  // hh:mm:ss + botão de checkout ("Não estou aqui"). Só é mostrada quando a visita ativa
  // veio do check-in manual (§ específico), jamais para visitas GEOFENCE ou de outro hospital.
  const [visitaManual, setVisitaManual] = useState(null);
  const [agora, setAgora] = useState(Date.now());
  const [enviandoCheckout, setEnviandoCheckout] = useState(false);

  const carregar = async () => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await HospitalService.buscarPorId(id);
      setHospital(dados);

      // Indicadores enriquecidos do endpoint dedicado (§3.5 / E4-01..E4-04).
      // Se falhar (ex.: agregado ainda materializando), mantém os embutidos do detalhe.
      try {
        const ind = await HospitalService.buscarIndicadores(id);
        setIndicadores(ind);
      } catch {
        setIndicadores(dados?.indicadores || null);
      }
    } catch (e) {
      setErro(e.message || "Não foi possível carregar o hospital.");
    } finally {
      setCarregando(false);
    }
  };

  useEffect(() => {
    if (id) carregar();
  }, [id]);

  // Sincroniza o estado da visita manual ao focar a tela (ex.: ao voltar do check-in
  // da lista Hospital → este detalhe). Modo anônimo usa `dispositivoId` (§3.3).
  const carregarVisitaManual = async () => {
    try {
      const data = await VisitaService.buscarAtiva();
      const visita = data?.visita || null;
      setVisitaManual(
        visita && visita.origem === "MANUAL" && visita.hospitalId === id ? visita : null
      );
      if (visita?.origem === "MANUAL" && visita.hospitalId === id) {
        setAgora(Date.now());
      }
    } catch {
      setVisitaManual(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      if (id) carregarVisitaManual();
    }, [id])
  );

  // Temporizador hh:mm:ss atualizado a cada segundo enquanto houver visita manual ativa.
  useEffect(() => {
    if (!visitaManual) {
      return undefined;
    }
    const timer = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [visitaManual]);

  const encerrarVisitaManual = async () => {
    if (!visitaManual) return;
    setEnviandoCheckout(true);
    try {
      await VisitaService.checkout(visitaManual.id, { encerramentoManual: true });
      // Épico 03 — E3-01: agenda o pedido de feedback ~1–5 min após a saída.
      agendarFeedback({
        visitaId: visitaManual.id,
        hospitalId: visitaManual.hospitalId,
        hospitalNome: hospital?.nome,
        saidaEm: new Date().toISOString(),
      });
      setVisitaManual(null);
    } catch (e) {
      Alert.alert(
        "Check-out",
        e.message || "Não foi possível finalizar o check-out. Tente novamente."
      );
    } finally {
      setEnviandoCheckout(false);
    }
  };

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

  const dadosIndicadores = indicadores || hospital.indicadores;
  const temIndicadores =
    dadosIndicadores?.indicadoresDisponiveis !== false &&
    dadosIndicadores?.notaMedia !== null &&
    dadosIndicadores?.notaMedia !== undefined;

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

  // Formata o tempo decorrido como hh:mm:ss (temporizador do check-in manual).
  const temporizadorTexto = useMemo(() => {
    if (!visitaManual?.entrada) return "00:00:00";
    const decorrido = Math.max(0, Math.floor((agora - new Date(visitaManual.entrada).getTime()) / 1000));
    const h = Math.floor(decorrido / 3600);
    const m = Math.floor((decorrido % 3600) / 60);
    const s = decorrido % 60;
    const pad = (n) => String(n).padStart(2, "0");
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }, [visitaManual, agora]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <CSHeader title={hospital.nome} onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {visitaManual && (
          <CSCard style={styles.section}>
            <Text style={styles.checkinActiveTitle}>
              Check-in manual ativo
            </Text>
            <Text style={styles.checkinSubtitle}>
              Você está em {hospital.nome}
            </Text>
            <Text
              accessibilityLabel={`Tempo de permanência ${temporizadorTexto}`}
              style={styles.temporizador}
            >
              {temporizadorTexto}
            </Text>
            <Text style={styles.temporizadorLabel}>tempo de permanência</Text>
            <CSButton
              label="Não estou aqui"
              onPress={encerrarVisitaManual}
              loading={enviandoCheckout}
              disabled={enviandoCheckout}
              variant="tertiary"
              style={styles.checkoutButton}
            />
          </CSCard>
        )}

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
                <Text style={styles.notaValue}>{formatarNota(dadosIndicadores.notaMedia)}</Text>
                <CSRatingStars nota={dadosIndicadores.notaMedia} size={20} />
                <Text style={styles.notaCount}>
                  {dadosIndicadores.nAvaliacoes} avaliações
                </Text>
              </View>

              {dadosIndicadores.tempoMedianoMinutos != null ? (
                <View style={styles.metricRow}>
                  <Text style={styles.metricLabel}>Tempo médio de atendimento</Text>
                  <Text style={styles.metricValue}>
                    {formatarDuracao(dadosIndicadores.tempoMedianoMinutos)}
                  </Text>
                </View>
              ) : null}

              {dadosIndicadores.nVisitas != null ? (
                <Text style={styles.transparencia}>
                  com base em {dadosIndicadores.nVisitas} atendimentos no período
                </Text>
              ) : null}

              {formatarPeriodo(dadosIndicadores.periodo) ? (
                <Text style={styles.transparencia}>
                  Período: {formatarPeriodo(dadosIndicadores.periodo)}
                </Text>
              ) : null}

              {dadosIndicadores.atualizadoEm ? (
                <Text style={styles.atualizado}>
                  Atualizado em {formatarData(dadosIndicadores.atualizadoEm)}
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
  checkinActiveTitle: {
    ...typography.titleMd,
    color: colors.geoActive,
  },
  checkinSubtitle: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
    marginTop: spacing.s1,
  },
  temporizador: {
    fontSize: 40,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: colors.onSurface,
    marginTop: spacing.s2,
  },
  temporizadorLabel: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginBottom: spacing.s2,
  },
  checkoutButton: {
    marginTop: spacing.s2,
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
  transparencia: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  semIndicadores: {
    ...typography.bodyMd,
    color: colors.onSurfaceVariant,
  },
});
