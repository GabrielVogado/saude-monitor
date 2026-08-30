/**
 * Formulário de feedback pós-saída (Épico 03 — F-05/E3-02).
 * Verifica o fluxo de 4 telas ramificado/pulável (RN-10/RN-11), a obrigatoriedade da
 * nota (RN-11), o branch de motivo quando não atendido, o payload enviado e a tela de
 * agradecimento (E3-06) — além do dedupe (RN-12, 409 -> "já avaliado").
 */
import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import FeedbackFormScreen from "../../../screens/feedback/view/FeedbackFormScreen";
import FeedbackService from "../../../screens/feedback/service/FeedbackService";
import { concluirFeedback } from "../../../screens/feedback/service/FeedbackNotificationService";

jest.mock("../../../screens/feedback/service/FeedbackService");
jest.mock("../../../screens/feedback/service/FeedbackNotificationService");

function renderizar() {
  const navigation = { goBack: jest.fn() };
  const route = { params: { visitaId: "v1", hospitalNome: "Hospital Central" } };
  return render(<FeedbackFormScreen navigation={navigation} route={route} />);
}

describe("FeedbackFormScreen (Épico 03)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FeedbackService.enviar.mockResolvedValue({ id: "fb1", criadoEm: "2026-01-01T00:00:00Z", recebido: true });
    concluirFeedback.mockResolvedValue();
  });

  test("começa na tela 1 (triagem) e é pulável", () => {
    renderizar();
    expect(screen.getByText("Você passou pela triagem?")).toBeTruthy();
    expect(screen.getByText("Etapa 1 de 4")).toBeTruthy();
    // "Pular" permite avançar sem responder (RN-11)
    fireEvent.press(screen.getByText("Pular"));
    expect(screen.getByText("Sobre o atendimento")).toBeTruthy();
  });

  test("branch: quando não foi atendido, pede o motivo (RN-10)", () => {
    renderizar();
    // avança da triagem
    fireEvent.press(screen.getByText("Pular"));
    // não foi atendido
    fireEvent.press(screen.getByText("Não fui atendido"));
    expect(screen.getByText("Qual foi o principal motivo?")).toBeTruthy();
    expect(screen.getByText("Falta de médico")).toBeTruthy();
    expect(screen.getByText("Hospital lotado")).toBeTruthy();
  });

  test("envia sem nota mostra erro (nota obrigatória, RN-11)", () => {
    renderizar();
    // vai até a última etapa
    ["Pular", "Pular", "Pular"].forEach((label) => fireEvent.press(screen.getByText(label)));
    expect(screen.getByText("Avaliação geral")).toBeTruthy();
    fireEvent.press(screen.getByText("Enviar avaliação"));
    expect(screen.getByText("A avaliação com estrelas é obrigatória.")).toBeTruthy();
    expect(FeedbackService.enviar).not.toHaveBeenCalled();
  });

  test("fluxo completo envia o feedback e mostra agradecimento (E3-06)", async () => {
    renderizar();

    // Tela 1 — triagem
    fireEvent.press(screen.getByText("Sim"));
    fireEvent.press(screen.getByText("Continuar"));

    // Tela 2 — atendimento (não atendido -> motivo)
    fireEvent.changeText(
      screen.getByPlaceholderText("Ex.: pronto-socorro, clínica médica"),
      "Pronto-socorro"
    );
    fireEvent.press(screen.getByText("Não fui atendido"));
    fireEvent.press(screen.getByText("Hospital lotado"));
    fireEvent.press(screen.getByText("Continuar"));

    // Tela 3 — medicamento/equipe
    fireEvent.press(screen.getByText("Recebi"));
    fireEvent.press(screen.getByTestId("tratamento-4"));
    fireEvent.press(screen.getByText("Continuar"));

    // Tela 4 — avaliação (nota obrigatória)
    fireEvent.press(screen.getByTestId("star-5"));
    fireEvent.changeText(screen.getByPlaceholderText("Conte como foi sua experiência"), "Ótimo atendimento");
    fireEvent.press(screen.getByText("Enviar avaliação"));

    // aguarda o POST e a tela de agradecimento
    expect(await screen.findByText("Obrigado pela sua avaliação!")).toBeTruthy();

    expect(FeedbackService.enviar).toHaveBeenCalledTimes(1);
    const payload = FeedbackService.enviar.mock.calls[0][0];
    expect(payload.visitaId).toBe("v1");
    expect(payload.fezTriagem).toBe("SIM");
    expect(payload.foiAtendido).toBe("NAO");
    // label amigável enviado p/ o motivo "Casos mais graves" (normalizado no backend); aqui "LOTACAO"
    expect(payload.motivoNaoAtendido).toBe("LOTACAO");
    expect(payload.medicacaoReceita).toBe("RECEBI");
    expect(payload.tratamentoEquipe).toBe(4);
    expect(payload.nota).toBe(5);
    expect(payload.comentario).toBe("Ótimo atendimento");
    expect(concluirFeedback).toHaveBeenCalledWith("v1");
  });

  test("duplicidade (RN-12): 409 mostra mensagem de já avaliado", async () => {
    FeedbackService.enviar.mockRejectedValue(
      Object.assign(new Error("Você já avaliou esta visita."), { status: 409 })
    );
    renderizar();
    ["Pular", "Pular", "Pular"].forEach((label) => fireEvent.press(screen.getByText(label)));
    fireEvent.press(screen.getByTestId("star-3"));
    fireEvent.press(screen.getByText("Enviar avaliação"));
    expect(await screen.findByText("Você já avaliou esta visita")).toBeTruthy();
  });
});
