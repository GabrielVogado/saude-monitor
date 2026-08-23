import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Star } from "lucide-react-native";
import { colors, spacing, typography } from "../theme/tokens";

/**
 * Avaliação por estrelas (modo exibição agregada).
 * Suporta estrelas parciais (ex.: 4.2) via recorte de largura.
 */
export default function CSRatingStars({
  nota,
  size = 16,
  max = 5,
  showLabel = false,
  labelMap = { 1: "Péssimo", 2: "Ruim", 3: "Regular", 4: "Bom", 5: "Excelente" },
}) {
  const valor = nota === null || nota === undefined || Number.isNaN(Number(nota)) ? 0 : Number(nota);

  const fractions = Array.from({ length: max }, (_, i) =>
    Math.max(0, Math.min(1, valor - i))
  );

  return (
    <View style={styles.row}>
      <View
        style={styles.stars}
        accessibilityRole="image"
        accessibilityLabel={`Nota ${valor.toFixed(1)} de ${max}`}
      >
        {fractions.map((fraction, i) => (
          <View key={i} style={{ width: size, height: size }}>
            <Star size={size} color={colors.ratingEmpty} />
            {fraction > 0 ? (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { overflow: "hidden", width: size * fraction },
                ]}
              >
                <Star size={size} color={colors.ratingFilled} fill={colors.ratingFilled} />
              </View>
            ) : null}
          </View>
        ))}
      </View>

      {showLabel && valor > 0 ? (
        <Text style={styles.label}>
          {`${valor.toFixed(1).replace(".", ",")} — ${labelMap[Math.round(valor)] || ""}`}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s2,
  },
  stars: {
    flexDirection: "row",
    gap: spacing.s1,
  },
  label: {
    ...typography.bodySm,
    color: colors.onSurfaceVariant,
  },
});
