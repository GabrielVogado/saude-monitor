import React, {useEffect, useState} from "react";
import {Text, View} from "react-native";
import CSCard from "./CSCard";
import CSButton from "./CSButton";

/**
 * Card de visita ativa (E2-07): exibe o hospital e um cronômetro de permanência,
 * atualizado a cada minuto, com botão "Não estou aqui" para encerramento manual
 * (F-04 CA#3). Acessível via `accessibilityLiveRegion="polite"`.
 */
export default function CSGeoStatusCard({ visita, onEncerrar, onSinalizarTipo }) {
  const [agora, setAgora] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const entrada = visita?.entrada ? new Date(visita.entrada).getTime() : null;
  const minutos = entrada ? Math.max(0, Math.floor((agora - entrada) / 60000)) : 0;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  const cronometro = `${String(horas).padStart(2, "0")}:${String(resto).padStart(2, "0")}`;

  const podeSinalizarTipo = minutos >= 12 * 60;

  return (
    <CSCard accessibilityLiveRegion="polite">
      <Text style={{ fontSize: 14, fontWeight: "600", color: "#0b6e4f" }}>
        Você está em {visita?.hospitalNome || "um hospital"}
      </Text>
      <Text style={{ fontSize: 28, fontWeight: "700", fontVariant: ["tabular-nums"], marginVertical: 4 }}>
        {cronometro}
      </Text>
      <Text style={{ fontSize: 12, color: "#666" }}>tempo de permanência</Text>

      {podeSinalizarTipo && onSinalizarTipo && (
        <CSButton
          label="Estou em observação ou internado"
          onPress={onSinalizarTipo}
          variant="secondary"
          style={{ marginTop: 8 }}
        />
      )}

      {onEncerrar && (
        <CSButton
          label="Não estou aqui"
          onPress={onEncerrar}
          variant="tertiary"
          style={{ marginTop: 8 }}
        />
      )}
    </CSCard>
  );
}
