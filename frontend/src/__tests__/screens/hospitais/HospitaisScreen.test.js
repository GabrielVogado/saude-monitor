/**
 * Listagem de hospitais (E1-03) — botão de check-in manual no card.
 *
 * Cobre o outro lado da regressão corrigida em HospitalDetalheScreen: o check-in
 * bem-sucedido aqui navega imediatamente para `HospitalDetalhe` (fazerCheckin,
 * HospitaisScreen.js). Antes da correção, essa navegação caía numa tela que
 * quebrava com "Rendered more hooks than during the previous render" — por isso o
 * usuário via o app fechar sozinho logo ao tocar em "Check-in".
 */
import React from "react";
import { render, fireEvent, screen, waitFor, act } from "@testing-library/react-native";
import { Alert } from "react-native";
import HospitaisScreen from "../../../screens/hospitais/view/HospitaisScreen";
import HospitalService from "../../../screens/hospitais/service/HospitalService";
import VisitaService from "../../../screens/visitas/service/VisitaService";

jest.mock("../../../screens/hospitais/service/HospitalService");
jest.mock("../../../screens/visitas/service/VisitaService");

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback) => {
    const React = require("react");
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
}));

const HOSPITAL_A = { id: "hA", nome: "Hospital A", tipo: "PUBLICO", categoria: "HOSPITAL" };
const HOSPITAL_B = { id: "hB", nome: "Hospital B", tipo: "PRIVADO", categoria: "UPA" };

const NAVEGACAO = { navigate: jest.fn(), goBack: jest.fn() };

function renderizar() {
  return render(<HospitaisScreen navigation={NAVEGACAO} />);
}

describe("HospitaisScreen (E1-03) — check-in manual não derruba mais o app", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    HospitalService.listar.mockResolvedValue({ content: [HOSPITAL_A, HOSPITAL_B] });
    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  test("carrega a lista imediatamente, sem esperar o debounce", async () => {
    renderizar();
    expect(await screen.findByText("Hospital A")).toBeTruthy();
    expect(screen.getByText("Hospital B")).toBeTruthy();
  });

  test("check-in bem-sucedido navega para o detalhe do hospital selecionado", async () => {
    VisitaService.checkin.mockResolvedValue({ id: "v1", hospitalId: "hA", status: "EM_ATENDIMENTO" });

    renderizar();
    await screen.findByText("Hospital A");
    fireEvent.press(screen.getByLabelText("Fazer check-in em Hospital A"));

    await waitFor(() => {
      expect(VisitaService.checkin).toHaveBeenCalledWith({ hospitalId: "hA", origem: "MANUAL" });
    });
    expect(NAVEGACAO.navigate).toHaveBeenCalledWith("HospitalDetalhe", { id: "hA" });
  });

  test("após o check-in, o card do hospital ativo passa a oferecer 'ver' e os demais ficam desabilitados", async () => {
    VisitaService.checkin.mockResolvedValue({ id: "v1", hospitalId: "hA", status: "EM_ATENDIMENTO" });

    renderizar();
    await screen.findByText("Hospital A");
    fireEvent.press(screen.getByLabelText("Fazer check-in em Hospital A"));
    await waitFor(() => expect(NAVEGACAO.navigate).toHaveBeenCalled());

    expect(await screen.findByLabelText("Hospital A — ver check-in ativo")).toBeTruthy();
    expect(screen.getByLabelText("Fazer check-in em Hospital B")).toBeDisabled();
  });

  test("tocar em 'ver' no hospital com visita já ativa apenas reabre o detalhe (idempotente)", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", hospitalId: "hA", origem: "MANUAL" },
    });

    renderizar();
    fireEvent.press(await screen.findByLabelText("Hospital A — ver check-in ativo"));

    expect(NAVEGACAO.navigate).toHaveBeenCalledWith("HospitalDetalhe", { id: "hA" });
    expect(VisitaService.checkin).not.toHaveBeenCalled();
  });

  test("conflito de geofence (409) deixa escolher o hospital correto e refaz o check-in", async () => {
    const conflito = Object.assign(new Error("Encontramos mais de um hospital aqui."), {
      status: 409,
      data: {
        message: "Encontramos mais de um hospital aqui.",
        candidatos: [
          { hospitalId: "hA", nome: "Hospital A" },
          { hospitalId: "hB", nome: "Hospital B" },
        ],
      },
    });
    VisitaService.checkin
      .mockRejectedValueOnce(conflito)
      .mockResolvedValueOnce({ id: "v1", hospitalId: "hB", status: "EM_ATENDIMENTO" });

    renderizar();
    await screen.findByText("Hospital A");
    fireEvent.press(screen.getByLabelText("Fazer check-in em Hospital A"));

    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());
    const [, , botoes] = Alert.alert.mock.calls[0];
    const botaoHospitalB = botoes.find((b) => b.text === "Hospital B");
    await act(async () => {
      botaoHospitalB.onPress();
    });

    await waitFor(() => {
      expect(VisitaService.checkin).toHaveBeenLastCalledWith({ hospitalId: "hB", origem: "MANUAL" });
    });
    expect(NAVEGACAO.navigate).toHaveBeenCalledWith("HospitalDetalhe", { id: "hB" });
  });

  test("erro genérico no check-in mostra alerta e não navega", async () => {
    VisitaService.checkin.mockRejectedValue(new Error("Backend indisponível."));

    renderizar();
    await screen.findByText("Hospital A");
    fireEvent.press(screen.getByLabelText("Fazer check-in em Hospital A"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Check-in", "Backend indisponível.");
    });
    expect(NAVEGACAO.navigate).not.toHaveBeenCalled();
  });
});
