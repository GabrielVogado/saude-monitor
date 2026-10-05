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
import { fireEvent, screen, act, waitFor } from "@testing-library/react-native";
import { renderComProviders } from "../../helpers/renderComProviders";
import { definirUsuarioDaSessao } from "../../../core/stores/sessaoStore";
import HospitalDetalheScreen from "../../../screens/hospitais/view/HospitalDetalheScreen";
import HospitalService from "../../../screens/hospitais/service/HospitalService";
import VisitaService from "../../../screens/visitas/service/VisitaService";
import { agendarFeedback } from "../../../screens/feedback/service/FeedbackNotificationService";
import { ErroSemInternet } from "../../../config/http";

jest.mock("../../../screens/hospitais/service/HospitalService");
jest.mock("../../../screens/visitas/service/VisitaService");
jest.mock("../../../screens/feedback/service/FeedbackNotificationService");

// @rnmapbox/maps: componentes nativos não suportados pelo Jest;
// substituídos por Views textuais (mesmo padrão de src/__tests__/screens/App.test.js).
jest.mock("@rnmapbox/maps", () => {
  const { View } = require("react-native");
  const stub = (props) => <View {...props} />;
  return {
    __esModule: true,
    default: { setAccessToken: jest.fn(() => Promise.resolve(null)), StyleURL: { Street: "mapbox://styles/mapbox/streets-v11" } },
    StyleURL: { Street: "mapbox://styles/mapbox/streets-v11" },
    MapView: stub,
    Camera: stub,
    MarkerView: stub,
    ShapeSource: stub,
    FillLayer: stub,
    LineLayer: stub,
  };
});

// Guarda o callback de foco mais recente para o teste poder simular um segundo
// foco da tela (ex.: voltar de outro app) sem desmontar o componente.
let callbackDeFoco = null;

jest.mock("@react-navigation/native", () => ({
  useFocusEffect: (callback) => {
    const React = require("react");
    callbackDeFoco = callback;
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
  return renderComProviders(<HospitalDetalheScreen navigation={NAVEGACAO} route={route} />);
}

/** Checkout aceito: depois dele, o servidor passa a responder que não há visita ativa. */
function checkoutComSucesso(resposta) {
  VisitaService.checkout.mockImplementation(async () => {
    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });
    return resposta;
  });
}

/** Simula a tela ganhando foco de novo (ex.: voltar de outro app), sem remontar. */
async function refocarTela() {
  await act(async () => {
    callbackDeFoco();
  });
}

describe("HospitalDetalheScreen (F-03/F-04) — crash do check-in manual", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Sessão lida do aparelho (anônima): a visita ativa só é consultada depois disso.
    definirUsuarioDaSessao(null);
    HospitalService.buscarPorId.mockResolvedValue(HOSPITAL);
    HospitalService.buscarIndicadores.mockResolvedValue(INDICADORES);
    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });
    // Assíncrona como a real: a tela encadeia `.catch` no retorno.
    agendarFeedback.mockResolvedValue(null);
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

  test("'Não estou aqui' finaliza o check-out e repassa a duração ao feedback (RN-01/RN-07)", async () => {
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", origem: "MANUAL", hospitalId: "h1", entrada: new Date().toISOString() },
    });
    // A duração vem da resposta do checkout; quem decide convidar ou não é agendarFeedback.
    checkoutComSucesso({ id: "v1", status: "FINALIZADA", duracaoMinutos: 8 });

    renderizar();
    fireEvent.press(await screen.findByText("Não estou aqui"));

    await act(async () => {});

    expect(VisitaService.checkout).toHaveBeenCalledWith("v1", { encerramentoManual: true });
    expect(agendarFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        visitaId: "v1",
        hospitalId: "h1",
        hospitalNome: "Hospital Central",
        duracaoMinutos: 8,
      })
    );
    expect(screen.queryByText("Check-in manual ativo")).toBeNull();
  });

  test("check-out de visita curta (<2 min) repassa a duração — não convida para feedback (RN-01/RN-07)", async () => {
    // Bug relatado: check-in seguido de checkout imediato ainda disparava a pesquisa. A
    // duração curta é repassada e o gate de 2 min em agendarFeedback (testado em unidade)
    // suprime a notificação.
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", origem: "MANUAL", hospitalId: "h1", entrada: new Date().toISOString() },
    });
    checkoutComSucesso({ id: "v1", status: "FINALIZADA", duracaoMinutos: 1 });

    renderizar();
    fireEvent.press(await screen.findByText("Não estou aqui"));

    await act(async () => {});

    expect(agendarFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ visitaId: "v1", duracaoMinutos: 1 })
    );
  });

  test("falha ao agendar o feedback é registrada e o cronômetro some mesmo assim", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", origem: "MANUAL", hospitalId: "h1", entrada: new Date().toISOString() },
    });
    checkoutComSucesso({ id: "v1", status: "FINALIZADA", duracaoMinutos: 8 });
    agendarFeedback.mockRejectedValue(new Error("disco cheio"));

    renderizar();
    fireEvent.press(await screen.findByText("Não estou aqui"));

    await act(async () => {});

    expect(warn).toHaveBeenCalledWith("HospitalDetalheScreen: falha ao agendar o feedback", "disco cheio");
    expect(screen.queryByText("Check-in manual ativo")).toBeNull();
    warn.mockRestore();
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

  test("check-out sem internet é enfileirado (OPS-05): encerra localmente em vez de deixar o cronômetro rodando", async () => {
    // Regressão evitada: sem este tratamento, um checkout enfileirado (sucesso do
    // ponto de vista do usuário — será sincronizado depois) caía no mesmo catch
    // genérico de erro e deixava o cronômetro contando indefinidamente para uma
    // visita que o usuário já encerrou.
    const AlertModule = require("react-native").Alert;
    jest.spyOn(AlertModule, "alert").mockImplementation(() => {});
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", origem: "MANUAL", hospitalId: "h1", entrada: new Date().toISOString() },
    });
    VisitaService.checkout.mockRejectedValue(
      Object.assign(new Error("Sem conexão com a internet. O registro foi guardado e será enviado assim que a conexão voltar."), {
        enfileirado: true,
      })
    );

    renderizar();
    fireEvent.press(await screen.findByText("Não estou aqui"));

    await act(async () => {});

    expect(agendarFeedback).toHaveBeenCalledWith(
      expect.objectContaining({ visitaId: "v1", hospitalId: "h1", hospitalNome: "Hospital Central" })
    );
    expect(screen.queryByText("Check-in manual ativo")).toBeNull();
    expect(AlertModule.alert).toHaveBeenCalledWith(
      "Sem conexão",
      "Sem conexão com a internet. O registro foi guardado e será enviado assim que a conexão voltar."
    );

    // Voltar à tela ainda sem conexão não traz de volta o cronômetro da visita encerrada.
    VisitaService.buscarAtiva.mockRejectedValue(new ErroSemInternet("http://exemplo"));
    await refocarTela();
    expect(screen.queryByText("Check-in manual ativo")).toBeNull();
  });

  test("um refoco sem internet não apaga o cronômetro de uma visita manual já carregada", async () => {
    // Achado do code-review: o mesmo bug corrigido em HospitaisScreen (catch
    // zerando o estado em QUALQUER falha) existia aqui. Sem conexão não significa
    // "sem visita ativa" — significa "não sabemos"; o card não pode desaparecer só
    // porque o aparelho perdeu sinal com a tela já aberta.
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", origem: "MANUAL", hospitalId: "h1", entrada: new Date().toISOString() },
    });

    renderizar();
    expect(await screen.findByText("Check-in manual ativo")).toBeTruthy();

    VisitaService.buscarAtiva.mockRejectedValue(new ErroSemInternet("http://exemplo"));
    await refocarTela();

    expect(screen.getByText("Check-in manual ativo")).toBeTruthy();
  });

  test("um refoco com erro real (não de conectividade) ainda limpa o cronômetro", async () => {
    // Outra metade do achado: preservar o estado só faz sentido para falha de
    // conectividade. Um erro de verdade precisa continuar zerando — senão o card
    // ficaria preso mostrando um cronômetro de uma visita que talvez nem exista mais.
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", origem: "MANUAL", hospitalId: "h1", entrada: new Date().toISOString() },
    });
    renderizar();
    expect(await screen.findByText("Check-in manual ativo")).toBeTruthy();

    VisitaService.buscarAtiva.mockRejectedValue(new Error("Sessão expirada. Faça login novamente."));
    await refocarTela();

    await waitFor(() => expect(screen.queryByText("Check-in manual ativo")).toBeNull());
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

  test("nota com menos de 5 avaliações também é insuficiente (mesmo critério do card)", async () => {
    // Caso limítrofe apontado no code-review: nota real mas nAvaliacoes < 5. Antes, o
    // detalhe mostrava a nota enquanto o card da lista mostrava o aviso — o mesmo
    // hospital em dois estados contraditórios. Alinhado ao critério nAvaliacoes >= 5.
    HospitalService.buscarIndicadores.mockResolvedValue({
      hospitalId: "h1",
      indicadoresDisponiveis: true,
      notaMedia: 4.2,
      nAvaliacoes: 3,
    });

    renderizar();
    await screen.findByText("Hospital Central");

    expect(
      screen.getByText(/Ainda sem avaliações suficientes/)
    ).toBeTruthy();
    expect(screen.queryByText("4,2")).toBeNull();
    expect(screen.queryByText("3 avaliações")).toBeNull();
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

  test("erro sem mensagem mostra o texto padrão", async () => {
    HospitalService.buscarPorId.mockRejectedValueOnce(new Error(""));

    renderizar();

    expect(await screen.findByText("Não foi possível carregar o hospital.")).toBeTruthy();
  });

  test("uma atualização que falha com o hospital já na tela não troca a tela pelo erro", async () => {
    const { queryClient } = renderizar();
    await screen.findByText("Hospital Central");

    HospitalService.buscarPorId.mockRejectedValueOnce(new Error("Sem conexão."));
    await act(async () => {
      await queryClient.refetchQueries();
    });

    expect(screen.getByText("Hospital Central")).toBeTruthy();
    expect(screen.queryByText("Não foi possível carregar")).toBeNull();
  });

  test("botão voltar aciona a navegação", async () => {
    renderizar();
    await screen.findByText("Hospital Central");
    fireEvent.press(screen.getByLabelText(/[Vv]oltar/));
    expect(NAVEGACAO.goBack).toHaveBeenCalled();
  });

  test("sem id na rota não consulta o hospital", async () => {
    // A visita ativa é a consulta compartilhada do app (o observador global já a
    // mantém), então só o hospital depende do id.
    renderizar(null);
    await act(async () => {});

    expect(HospitalService.buscarPorId).not.toHaveBeenCalled();
    expect(HospitalService.buscarIndicadores).not.toHaveBeenCalled();
  });
});
