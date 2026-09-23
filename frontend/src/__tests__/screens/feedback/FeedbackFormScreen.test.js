/**
 * Formulário de feedback pós-saída (Épico 03 — F-05/E3-02).
 * Verifica o fluxo de telas ramificado/pulável (RN-10/RN-11), a obrigatoriedade da
 * nota (RN-11), o branch de motivo quando não atendido (motivo obrigatório via
 * "Continuar"), o chip "Não interagi" (zera tratamentoEquipe), o payload enviado e a
 * tela de agradecimento (E3-06) — além do dedupe (RN-12, 409 -> "já avaliado").
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

  test("começa na tela 1 (triagem) e é pulável (RN-11)", () => {
    renderizar();
    expect(screen.getByText("Você passou pela triagem?")).toBeTruthy();
    // Sem triagem o fluxo tem 3 telas (Tela 2 fica fora — RN-11)
    expect(screen.getByText("Etapa 1 de 3")).toBeTruthy();
    // "Pular" permite avançar sem responder -> vai direto para "Medicamentos e equipe"
    fireEvent.press(screen.getByText("Pular"));
    expect(screen.getByText("Medicamentos e equipe")).toBeTruthy();
    expect(screen.queryByText("Sobre o atendimento")).toBeNull();
  });

  test("triagem 'Não' pula a Tela 2 (RN-11)", () => {
    renderizar();
    fireEvent.press(screen.getByText("Não"));
    fireEvent.press(screen.getByText("Continuar"));
    expect(screen.getByText("Medicamentos e equipe")).toBeTruthy();
    expect(screen.queryByText("Sobre o atendimento")).toBeNull();
  });

  test("branch: triagem Sim habilita Tela 2; 'Não fui atendido' pede o motivo, obrigatório (RN-10)", () => {
    renderizar();
    fireEvent.press(screen.getByText("Sim"));
    fireEvent.press(screen.getByText("Continuar"));
    expect(screen.getByText("Sobre o atendimento")).toBeTruthy();
    // Tela 2 aberta: "Etapa 2 de 4"
    expect(screen.getByText("Etapa 2 de 4")).toBeTruthy();
    fireEvent.press(screen.getByText("Não fui atendido"));
    expect(screen.getByText("Qual foi o principal motivo?")).toBeTruthy();
    expect(screen.getByText("Falta de médico")).toBeTruthy();
    expect(screen.getByText("Hospital lotado")).toBeTruthy();
    // motivo é obrigatório quando não foi atendido (via "Continuar")
    fireEvent.press(screen.getByText("Continuar"));
    expect(screen.getByText("Informe o principal motivo (obrigatório quando não foi atendido).")).toBeTruthy();
    fireEvent.press(screen.getByText("Falta de médico"));
    fireEvent.press(screen.getByText("Continuar"));
    expect(screen.getByText("Medicamentos e equipe")).toBeTruthy();
  });

  test("envia sem nota mostra erro (nota obrigatória, RN-11)", () => {
    renderizar();
    // sem triagem são 2 pulos até "Avaliação geral"
    ["Pular", "Pular"].forEach((label) => fireEvent.press(screen.getByText(label)));
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
      screen.getByPlaceholderText("Pesquise a especialidade (ex.: pronto-socorro)"),
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
    expect(payload.especialidadeProcurada).toBe("Pronto-socorro");
    expect(payload.foiAtendido).toBe("NAO");
    // label amigável enviado p/ o motivo "Casos mais graves" (normalizado no backend); aqui "LOTACAO"
    expect(payload.motivoNaoAtendido).toBe("LOTACAO");
    expect(payload.medicacaoReceita).toBe("RECEBI");
    expect(payload.tratamentoEquipe).toBe(4);
    expect(payload.nota).toBe(5);
    expect(payload.comentario).toBe("Ótimo atendimento");
    expect(concluirFeedback).toHaveBeenCalledWith("v1");
  });

  test("'Não interagi' zera a nota de tratamento da equipe (RN-10)", async () => {
    renderizar();
    fireEvent.press(screen.getByText("Sim"));
    fireEvent.press(screen.getByText("Continuar"));
    fireEvent.press(screen.getByText("Continuar")); // Tela 2 pulada

    // Tela 3 — marcou estrelas e depois "Não interagi"
    fireEvent.press(screen.getByTestId("tratamento-4"));
    expect(screen.getByText("Muito bom")).toBeTruthy();
    fireEvent.press(screen.getByText("Não interagi"));
    fireEvent.press(screen.getByText("Continuar"));

    fireEvent.press(screen.getByTestId("star-5"));
    fireEvent.press(screen.getByText("Enviar avaliação"));
    expect(await screen.findByText("Obrigado pela sua avaliação!")).toBeTruthy();

    const payload = FeedbackService.enviar.mock.calls[0][0];
    expect(payload.tratamentoEquipe).toBeUndefined();
    expect(payload.nota).toBe(5);
  });

  test("duplicidade (RN-12): 409 mostra mensagem de já avaliado", async () => {
    FeedbackService.enviar.mockRejectedValue(
      Object.assign(new Error("Você já avaliou esta visita."), { status: 409 })
    );
    renderizar();
    ["Pular", "Pular"].forEach((label) => fireEvent.press(screen.getByText(label)));
    fireEvent.press(screen.getByTestId("star-3"));
    fireEvent.press(screen.getByText("Enviar avaliação"));
    expect(await screen.findByText("Você já avaliou esta visita")).toBeTruthy();
  });
});