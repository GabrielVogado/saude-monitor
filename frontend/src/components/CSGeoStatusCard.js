import React, {useEffect, useState} from "react";
import {StyleSheet, Text} from "react-native";
import CSCard from "./CSCard";
import CSButton from "./CSButton";
import {colors, typography, spacing} from "../theme";

/**
 * Card de visita ativa (E2-07): exibe o hospital e um cronômetro de permanência,
 * atualizado a cada minuto, com botão "Não estou aqui" para encerramento manual
 * (F-04 CA#3). Acessível via `accessibilityLiveRegion="polite"`.
 *
 * Quando `visita.status === "GPS_INTERROMPIDO"` (E2-05/RN-06: sem sinal de GPS por mais
 * de 10min, encerrada automaticamente pelo backend), o card vira somente leitura: sem
 * cronômetro ativo nem botão "Não estou aqui" — não há mais nada a fazer sobre essa visita.
 *
 * E6-02: cores migradas para os tokens do Design System v2.0 (`theme/tokens.js`).
 */
export default function CSGeoStatusCard({ visita, onEncerrar, onSinalizarTipo }) {
  const [agora, setAgora] = useState(Date.now());
  const gpsInterrompido = visita?.status === "GPS_INTERROMPIDO";

  useEffect(() => {
    if (gpsInterrompido) {
      return undefined;
    }
    const timer = setInterval(() => setAgora(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, [gpsInterrompido]);

  if (gpsInterrompido) {
    return (
      <CSCard accessibilityLiveRegion="polite">
        <Text style={styles.warningTitle}>
          Localização perdida - visita encerrada automaticamente
        </Text>
        <Text style={styles.warningDescription}>
          Não conseguimos confirmar sua localização em {visita?.hospitalNome || "o hospital"}{" "}
          por mais de 10 minutos.
        </Text>
      </CSCard>
    );
  }

  const entrada = visita?.entrada ? new Date(visita.entrada).getTime() : null;
  const minutos = entrada ? Math.max(0, Math.floor((agora - entrada) / 60000)) : 0;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  const cronometro = `${String(horas).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;

  const podeSinalizarTipo = minutos >= 12 * 60;

  return (
    <CSCard accessibilityLiveRegion="polite">
      <Text style={styles.activeTitle}>
        Você está em {visita?.hospitalNome || "um hospital"}
      </Text>
      <Text style={styles.cronometro}>{cronometro}</Text>
      <Text style={styles.activeDescription}>tempo de permanência</Text>

      {podeSinalizarTipo && onSinalizarTipo && (
        <CSButton
          label="Estou em observação ou internado"
          onPress={onSinalizarTipo}
          variant="secondary"
          style={{ marginTop: spacing.s2 }}
        />
      )}

      {onEncerrar && (
        <CSButton
          label="Não estou aqui"
          onPress={onEncerrar}
          variant="tertiary"
          style={{ marginTop: spacing.s2 }}
        />
      )}
    </CSCard>
  );
}

const styles = StyleSheet.create({
  warningTitle: {
    ...typography.titleMd,
    color: colors.error,
  },
  warningDescription: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
    marginTop: spacing.s1,
  },
  activeTitle: {
    ...typography.titleMd,
    color: colors.geoActive,
  },
  cronometro: {
    fontSize: 28,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: colors.onSurface,
    marginVertical: spacing.s1,
  },
  activeDescription: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
});