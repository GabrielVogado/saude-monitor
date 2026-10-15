/**
 * Tela Início (E6-01): apresentação do app.
 *
 * O ciclo de vida da visita ativa (geofencing e heartbeat) saiu daqui e foi para o
 * `VisitaAtivaSync`, na raiz do app (testes em `VisitaAtivaSync.test.js`). Este teste
 * garante que a Home não volta a ser âncora dele.
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";
import HomeScreen from "../../../screens/home/view/HomeScreen";
import VisitaService from "../../../screens/visitas/service/VisitaService";
import { iniciarHeartbeat } from "../../../screens/visitas/service/HeartbeatService";

jest.mock("../../../screens/visitas/service/VisitaService");
jest.mock("../../../screens/visitas/service/HeartbeatService");
// O card de avaliações pendentes tem teste próprio (FeedbacksPendentesCard.test.js).
jest.mock("../../../screens/feedback/view/FeedbacksPendentesCard", () => () => null);

describe("HomeScreen (E6-01)", () => {
  test("apresenta o app sem consultar a visita ativa nem mexer no heartbeat", () => {
    render(<HomeScreen />);

    expect(screen.getByText(/ANTES, DURANTE E DEPOIS/)).toBeTruthy();
    expect(screen.getByText("Detecção automática")).toBeTruthy();
    expect(VisitaService.buscarAtiva).not.toHaveBeenCalled();
    expect(iniciarHeartbeat).not.toHaveBeenCalled();
  });
});
