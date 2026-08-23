import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { colors, radii, spacing } from "../theme/tokens";

/**
 * Skeleton de carregamento com pulso de opacidade (0.6 -> 1.0, 1.2s).
 * `CSLoadingList` renderiza blocos no formato de cards.
 */
export function CSLoading({ height = 16, width = "100%", radius = radii.sm, style }) {
  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.6,
          duration: 600,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { height, width, borderRadius: radius, backgroundColor: colors.skeleton, opacity },
        style,
      ]}
    />
  );
}

export function CSLoadingList({ count = 3 }) {
  return (
    <View style={styles.list}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.card}>
          <CSLoading width={48} height={48} radius={radii.full} />
          <View style={styles.cardBody}>
            <CSLoading width="70%" height={18} />
            <CSLoading width="45%" height={12} />
            <CSLoading width="90%" height={12} />
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    padding: spacing.s4,
    gap: spacing.s4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s3,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: radii.xl,
    padding: spacing.s5,
  },
  cardBody: {
    flex: 1,
    gap: spacing.s2,
  },
});

export default CSLoading;
