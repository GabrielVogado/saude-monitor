/**
 * Detalhe público do hospital (F-03/F-04) — regressão do crash de check-in manual.
 *
 * Bug corrigido: o `useMemo` de `temporizadorTexto` ficava depois dos `return`
 * condicionais de carregamento/erro, violando as Regras de Hooks do React (o número
 * de hooks executados variava entre a renderização "carregando" e a renderização com
 * dados prontos). Isso disparava "Rendered more hooks than during the previous
 * render" e derrubava o app inteiro ao abrir o detalhe de um hospital — tanto ao
 * tocar em "Check-in" (que navega direto para cá) quanto ao abrir o card de um
 * hospital com visita já ativa.
 *
 * Todo teste abaixo que usa `renderizar()` já exercita a transição real
 * carregando -> dados prontos (a promise de `buscarPorId` resolve depois do primeiro
 * paint), então qualquer regressão nas Regras de Hooks volta a quebrar estes testes.
 */
import React from "react";
import { render, fireEvent, screen, act } from "@testing-library/react-native";
import HospitalDetalheScreen from "../../../screens/hospitais/view/HospitalDetalheScreen";
import HospitalService from "../../../screens/hospitais/service/HospitalService";
import VisitaService from "../../../screens/visitas/service/VisitaService";
import { agendarFeedback } from "../../../screens/feedback/service/FeedbackNotificationService";

jest.mock("../../../screens/hospitais/service/HospitalService");
jest.mock("../../../screens/visitas/service/VisitaService");
jest.mock("../../../screens/feedback/service/FeedbackNotificationService");

// @maplibre/maplibre-react-native: componentes nativos não suportados pelo Jest;
// substituídos por Views textuais (mesmo padrão de src/__tests__/screens/App.test.js).
jest.mock("@maplibre/maplibre-react-native", () => {
  const { View } = require("react-native");
  const stub = (props) => <View {...props} />;
  return {
    __esModule: true,
    Map: stub,
    Camera: stub,
    Marker: stub,
    GeoJSONSource: stub,
    Layer: stub,
  };
});

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback) => {
    const React = require("react");
    React.useEffect(() => {
      callback();
    }, [callback]);
  },
}));

const HOSPITAL = {
  id: "h1",
  nome: "Hospital Central",
  tipo: "PUBLICO",
  categoria: "HOSPITAL",
  tipoUnidade: "HOSPITAL GERAL",
  horarioFuncionamento: "24 horas",
  ativo: true,
  endereco: { logradouro: "Rua das Flores, 100", cidade: "Brasília", uf: "DF", cep: "70000-000" },
  contato: { telefone: "(61) 3333-4444", email: "contato@hospitalcentral.df.gov.br" },
  geofence: {
    type: "Polygon",
    coordinates: [
      [
        [-47.9, -15.8],
        [-47.91, -15.8],
        [-47.91, -15.81],
        [-47.9, -15.81],
        [-47.9, -15.8],
      ],
    ],
  },
};

const INDICADORES = {
  hospitalId: "h1",
  indicadoresDisponiveis: true,
  notaMedia: 4.2,
  nAvaliacoes: 10,
  tempoMedianoMinutos: 45,
  nVisitas: 20,
  periodo: { inicio: "2026-08-01", fim: "2026-08-31" },
  atualizadoEm: "2026-09-01T00:00:00Z",
};

const NAVEGACAO = { goBack: jest.fn(), navigate: jest.fn() };

function renderizar(id = "h1") {
  const route = { params: { id } };
  return render(<HospitalDetalheScreen navigation={NAVEGACAO} route={route} />);
}

describe("HospitalDetalheScreen (F-03/F-04) — crash do check-in manual", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    HospitalService.buscarPorId.mockResolvedValue(HOSPITAL);
    HospitalService.buscarIndicadores.mockResolvedValue(INDICADORES);
    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });
  });

  test("sai de carregando para os dados prontos sem quebrar (Regras de Hooks)", async () => {
    renderizar();
    expect(await screen.findByText("Hospital Central")).toBeTruthy();
    expect(screen.getByText(/Rua das Flores, 100/)).toBeTruthy();
    expect(screen.getByText("24 horas")).toBeTruthy();
  });

  test("com visita manual ativa no mesmo hospital, exibe o cronômetro sem crashar", async () => {
    // Esta é exatamente a navegação que antes derrubava o app: check-in feito com
    // sucesso -> HospitaisScreen navega para cá -> tela carrega com visita já ativa.
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: {
        id: "v1",
        origem: "MANUAL",
        hospitalId: "h1",
        entrada: new Date(Date.now() - 65 * 1000).toISOString(),
      },
    });

    renderizar();

    expect(await screen.findByText("Check-in manual ativo")).toBeTruthy();
    expect(screen.getByText("Você está em Hospital Central")).toBeTruthy();
    expect(screen.getByText("Não estou aqui")).toBeTruthy();
    // Cronômetro formatado hh:mm:ss (>= 00:01:05, sem travar em 00:00:00).
    expect(screen.getByLabelText(/Tempo de permanência 00:01:/)).toBeTruthy();
  });

  test("visita ativa em OUTRO hospital não mostra o cronômetro deste hospital", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v2", origem: "MANUAL", hospitalId: "outro-hospital", entrada: new Date().toISOString() },
    });

    renderizar();
    await screen.findByText("Hospital Central");
    expect(screen.queryByText("Check-in manual ativo")).toBeNull();
  });

  test("visita GEOFENCE ativa no mesmo hospital não mostra o cronômetro manual", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v3", origem: "GEOFENCE", hospitalId: "h1", entrada: new Date().toISOString() },
    });

    renderizar();
    await screen.findByText("Hospital Central");
    expect(screen.queryByText("Check-in manual ativo")).toBeNull();
  });

  test("'Não estou aqui' finaliza o check-out e agenda o feedback", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", origem: "MANUAL", hospitalId: "h1", entrada: new Date().toISOString() },
    });
    VisitaService.checkout.mockResolvedValue({ id: "v1", status: "FINALIZADA" });

    renderizar();
    fireEvent.press(await screen.findByText("Não estou aqui"));

    await act(async () => {});

    expect(VisitaService.checkout).toHaveBeenCalledWith("v1", { encerramentoManual: true });
    expect(agendarFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ visitaId: "v1", hospitalId: "h1", hospitalNome: "Hospital Central" })
    );
    expect(screen.queryByText("Check-in manual ativo")).toBeNull();
  });

  test("erro no check-out mantém a visita ativa e mostra alerta", async () => {
    const AlertModule = require("react-native").Alert;
    jest.spyOn(AlertModule, "alert").mockImplementation(() => {});
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", origem: "MANUAL", hospitalId: "h1", entrada: new Date().toISOString() },
    });
    VisitaService.checkout.mockRejectedValue(new Error("Falha ao finalizar."));

    renderizar();
    fireEvent.press(await screen.findByText("Não estou aqui"));

    await act(async () => {});

    expect(AlertModule.alert).toHaveBeenCalledWith("Check-out", "Falha ao finalizar.");
    expect(screen.getByText("Check-in manual ativo")).toBeTruthy();
  });

  test("indicadores insuficientes mostram a mensagem de transparência (RN-15)", async () => {
    HospitalService.buscarIndicadores.mockResolvedValue({
      hospitalId: "h1",
      indicadoresDisponiveis: false,
      notaMedia: null,
      nAvaliacoes: 2,
    });

    renderizar();
    await screen.findByText("Hospital Central");
    expect(
      screen.getByText(/Ainda sem avaliações suficientes/)
    ).toBeTruthy();
  });

  test("falha ao buscar indicadores dedicados usa o fallback embutido no hospital", async () => {
    HospitalService.buscarIndicadores.mockRejectedValue(new Error("indisponível"));
    HospitalService.buscarPorId.mockResolvedValue({ ...HOSPITAL, indicadores: INDICADORES });

    renderizar();
    await screen.findByText("Hospital Central");
    expect(screen.getByText("4,2")).toBeTruthy();
  });

  test("sem geofence não renderiza o mapa", async () => {
    HospitalService.buscarPorId.mockResolvedValue({ ...HOSPITAL, geofence: null });

    renderizar();
    await screen.findByText("Hospital Central");
    expect(screen.queryByTestId("map-stub")).toBeNull();
  });

  test("erro ao carregar o hospital mostra o empty state com nova tentativa", async () => {
    HospitalService.buscarPorId.mockRejectedValueOnce(new Error("Hospital fora do ar."));

    renderizar();
    expect(await screen.findByText("Não foi possível carregar")).toBeTruthy();
    expect(screen.getByText("Hospital fora do ar.")).toBeTruthy();

    HospitalService.buscarPorId.mockResolvedValueOnce(HOSPITAL);
    fireEvent.press(screen.getByText("Tentar novamente"));
    expect(await screen.findByText("Hospital Central")).toBeTruthy();
  });

  test("botão voltar aciona a navegação", async () => {
    renderizar();
    await screen.findByText("Hospital Central");
    fireEvent.press(screen.getByLabelText(/[Vv]oltar/));
    expect(NAVEGACAO.goBack).toHaveBeenCalled();
  });
});
