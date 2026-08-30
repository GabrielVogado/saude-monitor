import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },

  header: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: "#0F172A" },

  content: { padding: 16 },

  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardTitle: { fontSize: 16, fontWeight: "700", color: "#0F172A", marginBottom: 12 },

  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#0C4A6E",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { color: "#FFFFFF", fontSize: 26, fontWeight: "700" },
  userName: { fontSize: 18, fontWeight: "700", color: "#0F172A" },
  userEmail: { fontSize: 14, color: "#64748B", marginTop: 2 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#E2E8F0",
  },
  rowLabel: { fontSize: 15, color: "#0F172A", fontWeight: "500" },
  rowValue: { fontSize: 14, color: "#475569" },

  semAcesso: { alignItems: "center", paddingVertical: 20 },
  semAcessoTitle: { fontSize: 17, fontWeight: "700", color: "#0F172A", marginTop: 12, marginBottom: 6 },
  semAcessoText: { fontSize: 14, color: "#64748B", textAlign: "center", marginBottom: 16 },

  button: {
    backgroundColor: "#0C4A6E",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonSecondary: {
    backgroundColor: "#E2E8F0",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: { color: "#FFFFFF", fontSize: 15, fontWeight: "600" },
  buttonTextSecondary: { color: "#0F172A", fontSize: 15, fontWeight: "600" },

  dangerButton: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  dangerButtonText: { color: "#B91C1C", fontSize: 15, fontWeight: "600" },

  status: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusAtivo: { backgroundColor: "#DCFCE7" },
  statusAtivoText: { color: "#15803D", fontSize: 12, fontWeight: "700" },
  statusInativo: { backgroundColor: "#F1F5F9" },
  statusInativoText: { color: "#475569", fontSize: 12, fontWeight: "700" },

  link: { color: "#0C4A6E", fontSize: 14, fontWeight: "600" },

  footerNote: { fontSize: 12, color: "#64748B", marginTop: 10, lineHeight: 17 },
});
