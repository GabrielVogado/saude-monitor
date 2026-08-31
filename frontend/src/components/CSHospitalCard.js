import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Building2 } from "lucide-react-native";
import { colors, radii, shadows, spacing, typography } from "../theme/tokens";
import { formatarDuracao, formatarNota } from "../utils/format";
import CSRatingStars from "./CSRatingStars";
import CSBadge from "./CSBadge";

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

/**
 * Card de hospital (lista/ranking) — card inteiro clicável.
 *
 * Navegação revisada: aceita `onCheckin`/`checkinLoading`/`checkinAtivo` para exibir um
 * botão compacto de check-in manual no próprio card (sem abrir o detalhe). Ao tocar no
 * corpo do card (fora do botão), `onPress` abre o detalhe como antes.
 */
export default function CSHospitalCard({
  hospital,
  onPress,
  distanciaKm,
  onCheckin,
  checkinLoading,
  checkinAtivo,
  checkinDesabilitado = false,
}) {
  const indicadores = hospital?.indicadores;
  const temIndicadores =
    indicadores?.notaMedia !== null &&
    indicadores?.notaMedia !== undefined &&
    indicadores?.nAvaliacoes >= 5;

  const tipoLabel = TIPO_LABEL[hospital?.tipo] || hospital?.tipo || "Hospital";
  const categoriaLabel = CATEGORIA_LABEL[hospital?.categoria] || hospital?.categoria;
  const tipoUnidade =
    typeof hospital?.tipoUnidade === "string" && hospital.tipoUnidade.trim()
      ? hospital.tipoUnidade
      : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${hospital?.nome}, ${categoriaLabel || tipoLabel}`}
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.avatar}>
        <Building2 size={24} color={colors.primary} />
      </View>

      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>
          {hospital?.nome}
        </Text>

        <View style={styles.metaRow}>
          {categoriaLabel ? (
            <CSBadge label={categoriaLabel} variant="info" />
          ) : (
            <CSBadge label={tipoLabel} variant="info" />
          )}
          {tipoLabel && categoriaLabel ? (
            <CSBadge label={tipoLabel} variant="neutral" />
          ) : null}
          {distanciaKm !== null && distanciaKm !== undefined ? (
            <Text style={styles.distance}>{distanciaKm.toFixed(1)} km</Text>
          ) : null}
        </View>

        {tipoUnidade ? (
          <Text style={styles.unitType} numberOfLines={1}>
            {tipoUnidade}
          </Text>
        ) : null}

        {temIndicadores ? (
          <View style={styles.ratingRow}>
            <CSRatingStars nota={indicadores.notaMedia} size={16} />
            <Text style={styles.ratingValue}>{formatarNota(indicadores.notaMedia)}</Text>
            <Text style={styles.ratingCount}>{indicadores.nAvaliacoes} avaliações</Text>
          </View>
        ) : (
          <Text style={styles.noRating}>Ainda sem avaliações suficientes</Text>
        )}

        {temIndicadores && indicadores.tempoMedianoMinutos != null ? (
          <Text style={styles.timeMetric}>
            Tempo médio: {formatarDuracao(indicadores.tempoMedianoMinutos)}
          </Text>
        ) : null}

        {onCheckin && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              checkinAtivo
                ? `${hospital?.nome} — ver check-in ativo`
                : `Fazer check-in em ${hospital?.nome}`
            }
            disabled={checkinLoading || checkinDesabilitado}
            onPress={(event) => {
              event.stopPropagation();
              onCheckin();
            }}
            style={({ pressed }) => [
              styles.checkinButton,
              checkinAtivo && styles.checkinButtonActive,
              pressed && styles.checkinButtonPressed,
              (checkinLoading || checkinDesabilitado) && styles.checkinButtonDisabled,
            ]}
          >
            <Text
              style={[
                styles.checkinText,
                checkinAtivo && styles.checkinTextActive,
              ]}
            >
              {checkinLoading
                ? "Enviando..."
                : checkinAtivo
                  ? "Em visita — ver"
                  : "Check-in"}
            </Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.s3,
    minHeight: 80,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: spacing.s5,
    ...shadows.cloud1,
  },
  pressed: {
    backgroundColor: colors.surfaceContainer,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surfaceContainer,
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
    gap: spacing.s2,
  },
  name: {
    ...typography.titleLg,
    color: colors.onSurface,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: spacing.s2,
  },
  distance: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  unitType: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  ratingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s2,
  },
  ratingValue: {
    ...typography.numeric,
    fontSize: 16,
    color: colors.onSurface,
  },
  ratingCount: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  noRating: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  timeMetric: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
  checkinButton: {
    alignSelf: "flex-start",
    minHeight: 40,
    paddingHorizontal: spacing.s4,
    paddingVertical: spacing.s2,
    borderRadius: radii.md,
    backgroundColor: colors.primary,
    justifyContent: "center",
    marginTop: spacing.s2,
  },
  checkinButtonActive: {
    backgroundColor: colors.surfaceContainer,
  },
  checkinButtonPressed: {
    opacity: 0.8,
  },
  checkinButtonDisabled: {
    opacity: 0.6,
  },
  checkinText: {
    ...typography.labelMd,
    color: colors.onPrimary,
    fontWeight: "600",
  },
  checkinTextActive: {
    color: colors.primary,
  },
});
