/**
 * Design System "Clinical Sanctuary" v2.0 — tokens.
 * Fonte: Documentos/03-ui-ux/Padrao-UI-UX-v2.0.md (§5).
 *
 * Tipografia (Manrope/Inter) ainda não é carregada via expo-font; as escalas
 * abaixo aplicam peso/tamanho/line-height/letterSpacing com a fonte do sistema.
 * O carregamento das famílias tipográficas fica para o épico de polimento (E6-02).
 */

export const colors = {
  // Primárias
  primary: "#006193",
  onPrimary: "#ffffff",
  primaryContainer: "#007bb8",
  onPrimaryContainer: "#fcfcff",
  primaryFixed: "#cce5ff",
  onPrimaryFixed: "#001e31",
  primaryFixedDim: "#91ccff",
  onPrimaryFixedVariant: "#004b73",

  // Secundárias
  secondary: "#006a6a",
  onSecondary: "#ffffff",
  secondaryContainer: "#90efef",
  onSecondaryContainer: "#006e6e",

  // Terciárias
  tertiary: "#884e00",
  onTertiary: "#ffffff",
  tertiaryContainer: "#ab6300",
  onTertiaryContainer: "#fffbff",

  // Erro
  error: "#ba1a1a",
  onError: "#ffffff",
  errorContainer: "#ffdad6",
  onErrorContainer: "#93000a",

  // Superfícies (hierarquia tonal — regra "no-line")
  surface: "#f7f9fb",
  surfaceContainerLowest: "#ffffff",
  surfaceContainerLow: "#f2f4f6",
  surfaceContainer: "#eceef0",
  surfaceContainerHigh: "#e6e8ea",
  surfaceContainerHighest: "#e0e3e5",
  surfaceVariant: "#e0e3e5",
  onSurface: "#191c1e",
  onSurfaceVariant: "#3f4850",
  outline: "#6f7881",
  outlineVariant: "#bfc7d2",
  inverseSurface: "#2d3133",
  inverseOnSurface: "#eff1f3",
  inversePrimary: "#91ccff",
  background: "#f7f9fb",

  // Semânticos (contexto paciente)
  ratingFilled: "#884e00",
  ratingEmpty: "#bfc7d2",
  geoActive: "#006a6a",
  geoInactive: "#3f4850",
  successBg: "#90efef",
  warningBg: "#ffdcbf",
  onWarning: "#2d1600",
  skeleton: "#e6e8ea",
  overlayScrim: "rgba(25,28,30,0.4)",
};

export const gradients = {
  // Gradiente primário (assinatura): 135°.
  primary: ["#006193", "#007bb8"],
  background: ["#f7f9fb", "#eef2f7"],
};

export const typography = {
  displayLg: { fontSize: 32, lineHeight: 40, fontWeight: "800", letterSpacing: -0.5 },
  displayMd: { fontSize: 28, lineHeight: 36, fontWeight: "800", letterSpacing: -0.5 },
  displaySm: { fontSize: 24, lineHeight: 32, fontWeight: "700", letterSpacing: -0.3 },
  headlineMd: { fontSize: 22, lineHeight: 30, fontWeight: "700", letterSpacing: -0.3 },
  headlineSm: { fontSize: 20, lineHeight: 28, fontWeight: "700", letterSpacing: -0.2 },
  titleLg: { fontSize: 18, lineHeight: 26, fontWeight: "600", letterSpacing: -0.2 },
  titleMd: { fontSize: 16, lineHeight: 24, fontWeight: "600", letterSpacing: 0 },
  bodyLg: { fontSize: 16, lineHeight: 24, fontWeight: "400", letterSpacing: 0 },
  bodyMd: { fontSize: 14, lineHeight: 21, fontWeight: "400", letterSpacing: 0 },
  bodySm: { fontSize: 12, lineHeight: 18, fontWeight: "400", letterSpacing: 0 },
  labelLg: { fontSize: 14, lineHeight: 20, fontWeight: "600", letterSpacing: 0.1 },
  labelMd: { fontSize: 12, lineHeight: 16, fontWeight: "600", letterSpacing: 0.5 },
  labelSm: { fontSize: 11, lineHeight: 16, fontWeight: "600", letterSpacing: 1 },
  numeric: { fontWeight: "700", fontVariant: ["tabular-nums"] },
};

export const spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s8: 32,
  s10: 40,
  s12: 48,
  s16: 64,
};

export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  full: 9999,
};

export const shadows = {
  cloud1: {
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  cloud2: {
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 6,
  },
  primaryGlow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  glass: {
    shadowColor: colors.onSurface,
    shadowOffset: { width: 0, height: -8 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
};

export const motion = {
  durationFast: 120,
  durationBase: 200,
  durationSlow: 300,
  easingStandard: [0.2, 0, 0, 1],
  easingEnter: [0.0, 0.0, 0.2, 1],
  easingExit: [0.4, 0, 1, 1],
};

export const touchTarget = {
  min: 48,
};

const theme = {
  colors,
  gradients,
  typography,
  spacing,
  radii,
  shadows,
  motion,
  touchTarget,
};

export default theme;
