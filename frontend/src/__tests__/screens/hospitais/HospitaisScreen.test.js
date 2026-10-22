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
import { fireEvent, screen, waitFor, act } from "@testing-library/react-native";
import { renderComProviders } from "../../helpers/renderComProviders";
import { definirUsuarioDaSessao } from "../../../core/stores/sessaoStore";
import { Alert } from "react-native";
import HospitaisScreen from "../../../screens/hospitais/view/HospitaisScreen";
import HospitalService from "../../../screens/hospitais/service/HospitalService";
import VisitaService from "../../../screens/visitas/service/VisitaService";
import { ErroSemInternet } from "../../../config/http";
import CatalogoLocal from "../../../services/CatalogoLocal";

jest.mock("../../../screens/hospitais/service/HospitalService");
jest.mock("../../../screens/visitas/service/VisitaService");
jest.mock("../../../services/CatalogoLocal", () => ({
  __esModule: true,
  default: { lerCopiaGuardada: jest.fn(), obterEstabelecimentos: jest.fn(), sincronizarVersao: jest.fn(), conferirSeVencida: jest.fn() },
}));

// Guarda o callback de foco mais recente para o teste poder simular um segundo
// foco da aba (ex.: voltar de outra tela) sem desmontar o componente — é
// exatamente essa segunda chamada que expôs a corrida do achado do code-review.
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

const HOSPITAL_A = { id: "hA", nome: "Hospital A", tipo: "PUBLICO", categoria: "HOSPITAL" };
const HOSPITAL_B = { id: "hB", nome: "Hospital B", tipo: "PRIVADO", categoria: "UPA" };

const NAVEGACAO = { navigate: jest.fn(), goBack: jest.fn() };

function renderizar() {
  return renderComProviders(<HospitaisScreen navigation={NAVEGACAO} />);
}

/** Simula a aba ganhando foco de novo (ex.: voltar de outra tela), sem remontar. */
async function refocarTela() {
  await act(async () => {
    callbackDeFoco();
  });
}

describe("HospitaisScreen (E1-03) — check-in manual não derruba mais o app", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Sessão lida do aparelho (anônima): a visita ativa só é consultada depois disso.
    definirUsuarioDaSessao(null);
    HospitalService.listarIndicadoresDoCatalogo.mockResolvedValue({ porHospital: {} });
    HospitalService.buscarPorId.mockResolvedValue(null);
    CatalogoLocal.lerCopiaGuardada.mockResolvedValue([HOSPITAL_A, HOSPITAL_B]);
    CatalogoLocal.obterEstabelecimentos.mockResolvedValue([HOSPITAL_A, HOSPITAL_B]);
    CatalogoLocal.conferirSeVencida.mockResolvedValue(false);
    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });
    jest.spyOn(Alert, "alert").mockImplementation(() => {});
  });

  test("carrega a lista imediatamente, sem esperar o debounce", async () => {
    renderizar();
    expect(await screen.findByText("Hospital A")).toBeTruthy();
    expect(screen.getByText("Hospital B")).toBeTruthy();
  });

  test("a lista sai do aparelho: não pede hospitais ao servidor página a página", async () => {
    renderizar();
    await screen.findByText("Hospital A");

    expect(HospitalService.listar).not.toHaveBeenCalled();
  });

  test("sem cópia e sem rede mostra o erro, e 'Tentar novamente' baixa o catálogo de novo", async () => {
    CatalogoLocal.lerCopiaGuardada.mockResolvedValue(null);
    CatalogoLocal.obterEstabelecimentos.mockRejectedValueOnce(new Error("Backend indisponível."));

    renderizar();
    expect(await screen.findByText("Backend indisponível.")).toBeTruthy();

    fireEvent.press(screen.getByText("Tentar novamente"));

    expect(await screen.findByText("Hospital A")).toBeTruthy();
  });

  test("a busca filtra no aparelho, sem acento e caixa, só depois da pausa na digitação", async () => {
    renderizar();
    await screen.findByText("Hospital A");

    fireEvent.changeText(screen.getByPlaceholderText("Buscar hospital por nome"), "Hospítal A");
    expect(screen.getByText("Hospital B")).toBeTruthy();

    await waitFor(() => expect(screen.queryByText("Hospital B")).toBeNull());
    expect(screen.getByText("Hospital A")).toBeTruthy();
    expect(HospitalService.listar).not.toHaveBeenCalled();
  });

  test("check-in bem-sucedido navega para o detalhe do hospital selecionado", async () => {
    const visita = { id: "v1", hospitalId: "hA", status: "EM_ATENDIMENTO" };
    VisitaService.checkin.mockImplementation(async () => {
      // Depois do check-in, o servidor passa a responder com a visita nova.
      VisitaService.buscarAtiva.mockResolvedValue({ visita: { ...visita, origem: "MANUAL" } });
      return visita;
    });

    renderizar();
    await screen.findByText("Hospital A");
    fireEvent.press(screen.getByLabelText("Fazer check-in em Hospital A"));

    await waitFor(() => {
      expect(VisitaService.checkin).toHaveBeenCalledWith({ hospitalId: "hA", origem: "MANUAL" });
    });
    expect(NAVEGACAO.navigate).toHaveBeenCalledWith("HospitalDetalhe", { id: "hA" });
  });

  test("após o check-in, o card do hospital ativo passa a oferecer 'ver' e os demais ficam desabilitados", async () => {
    const visita = { id: "v1", hospitalId: "hA", status: "EM_ATENDIMENTO" };
    VisitaService.checkin.mockImplementation(async () => {
      // Depois do check-in, o servidor passa a responder com a visita nova.
      VisitaService.buscarAtiva.mockResolvedValue({ visita: { ...visita, origem: "MANUAL" } });
      return visita;
    });

    renderizar();
    await screen.findByText("Hospital A");
    fireEvent.press(screen.getByLabelText("Fazer check-in em Hospital A"));
    await waitFor(() => expect(NAVEGACAO.navigate).toHaveBeenCalled());

    expect(await screen.findByLabelText("Hospital A — ver check-in ativo")).toBeTruthy();
    expect(screen.getByLabelText("Fazer check-in em Hospital B")).toBeDisabled();
  });

  test("um refoco com erro real (não de conectividade) ainda limpa a visita ativa", async () => {
    // Outra metade do achado do code-review: preservar o estado só faz sentido para
    // falha de conectividade. Um erro de verdade (sessão expirada, 500) precisa
    // continuar zerando — senão um placeholder otimista obsoleto travaria o guard
    // para sempre, impedindo check-in em qualquer hospital.
    VisitaService.buscarAtiva.mockResolvedValue({
      visita: { id: "v1", hospitalId: "hA", origem: "MANUAL" },
    });
    renderizar();
    expect(await screen.findByLabelText("Hospital A — ver check-in ativo")).toBeTruthy();

    VisitaService.buscarAtiva.mockRejectedValue(new Error("Sessão expirada. Faça login novamente."));
    await refocarTela();

    expect(await screen.findByLabelText("Fazer check-in em Hospital A")).not.toBeDisabled();
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

  test("check-in sem internet é enfileirado (OPS-05): alerta não soa como falha, e a tela não navega para um detalhe que dependeria da mesma rede indisponível", async () => {
    VisitaService.checkin.mockRejectedValue(
      Object.assign(new Error("Sem conexão com a internet. O registro foi guardado e será enviado assim que a conexão voltar."), {
        enfileirado: true,
      })
    );

    renderizar();
    await screen.findByText("Hospital A");
    fireEvent.press(screen.getByLabelText("Fazer check-in em Hospital A"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        "Sem conexão",
        "Sem conexão com a internet. O registro foi guardado e será enviado assim que a conexão voltar."
      );
    });
    expect(NAVEGACAO.navigate).not.toHaveBeenCalled();

    // O ponto real deste teste: mesmo sem confirmação do servidor, o check-in
    // enfileirado precisa armar o guard de "uma visita por vez" imediatamente. Sem
    // isso, o card do Hospital B ficaria destravado e um segundo toque, ainda
    // offline, enfileiraria um segundo check-in — dois eventos que o backend
    // resolveria por "visita ativa do dispositivo", descartando um deles em silêncio
    // quando a fila enviasse os dois.
    expect(screen.getByLabelText("Fazer check-in em Hospital B")).toBeDisabled();
    expect(VisitaService.checkin).toHaveBeenCalledTimes(1);
  });

  test("o guard do check-in enfileirado sobrevive a um refoco da aba enquanto ainda offline", async () => {
    // Achado do code-review sobre o teste anterior: o guard local armado pelo
    // check-in enfileirado era apagado no PRÓXIMO foco da aba (ex.: voltar do
    // Ranking) se o aparelho ainda estivesse offline — `buscarAtiva()` é uma
    // requisição viva, não passa pela fila, e falha do mesmo jeito; o `.catch` de
    // `atualizarVisitaAtiva` zerava `visitaAtiva` em QUALQUER erro, achando que
    // "falhou" significava "não há visita ativa".
    VisitaService.checkin.mockRejectedValue(
      Object.assign(new Error("Sem conexão com a internet. O registro foi guardado e será enviado assim que a conexão voltar."), {
        enfileirado: true,
      })
    );

    renderizar();
    await screen.findByText("Hospital A");
    fireEvent.press(screen.getByLabelText("Fazer check-in em Hospital A"));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalled());

    // Ainda offline: o refetch da visita ativa ao reganhar foco também falha. Precisa
    // ser a classe real de conectividade (é o que VisitaService de fato lança) — um
    // Error genérico não deve ser tratado como "sem dado novo", só como falha real.
    VisitaService.buscarAtiva.mockRejectedValue(new ErroSemInternet("http://exemplo"));
    await refocarTela();

    expect(screen.getByLabelText("Fazer check-in em Hospital B")).toBeDisabled();
    expect(VisitaService.checkin).toHaveBeenCalledTimes(1);
  });

  describe("hospital do check-in ativo no topo da lista (pedido do PO, 10/09/2026)", () => {
    test("hospital ativo já presente na lista aparece primeiro, sem duplicar", async () => {
      VisitaService.buscarAtiva.mockResolvedValue({ visita: { hospitalId: "hB" } });
      HospitalService.buscarPorId.mockResolvedValue(HOSPITAL_B);

      renderizar();
      await screen.findByText("Hospital A");

      // `buscarPorId` resolve assincronamente, depois da lista já ter carregado —
      // esperar só "Hospital A" existir não garante que o destaque já aplicou
      // (achado sob carga: passava isolado, falhava junto com a suíte completa).
      await waitFor(() => {
        const nomes = screen.getAllByText(/^Hospital [AB]$/).map((el) => el.props.children);
        expect(nomes).toEqual(["Hospital B", "Hospital A"]);
      });
    });

    test("hospital ativo fora da cópia do catálogo é buscado à parte e aparece no topo", async () => {
      const HOSPITAL_FORA_DA_PAGINA = { id: "hZ", nome: "Hospital Z", tipo: "PUBLICO", categoria: "HOSPITAL" };
      VisitaService.buscarAtiva.mockResolvedValue({ visita: { hospitalId: "hZ" } });
      HospitalService.buscarPorId.mockResolvedValue(HOSPITAL_FORA_DA_PAGINA);

      renderizar();
      await screen.findByText("Hospital A");

      await waitFor(() => expect(HospitalService.buscarPorId).toHaveBeenCalledWith("hZ", { signal: expect.anything() }));
      await waitFor(() => {
        const nomes = screen.getAllByText(/^Hospital [ABZ]$/).map((el) => el.props.children);
        expect(nomes).toEqual(["Hospital Z", "Hospital A", "Hospital B"]);
      });
    });

    test("sem check-in ativo, a ordem da lista não muda", async () => {
      renderizar();
      await screen.findByText("Hospital A");

      expect(HospitalService.buscarPorId).not.toHaveBeenCalled();
      const nomes = screen.getAllByText(/^Hospital [AB]$/).map((el) => el.props.children);
      expect(nomes).toEqual(["Hospital A", "Hospital B"]);
    });

    test("falha ao buscar o hospital ativo não quebra a lista (fallback silencioso)", async () => {
      VisitaService.buscarAtiva.mockResolvedValue({ visita: { hospitalId: "hB" } });
      HospitalService.buscarPorId.mockRejectedValue(new Error("sem conexão"));

      renderizar();

      expect(await screen.findByText("Hospital A")).toBeTruthy();
      expect(screen.getByText("Hospital B")).toBeTruthy();
    });
  });
});

describe("HospitaisScreen — lista do catálogo no aparelho e indicadores do servidor (22/10/2026)", () => {
  const UPA = { id: "hU", nome: "Upa Riacho Fundo", tipo: "PUBLICO", categoria: "UPA" };
  const CLINICA = { id: "hC", nome: "Clínica Água", tipo: "PRIVADO", categoria: "OUTRO" };
  const NOTA_DA_UPA = { indicadoresDisponiveis: true, notaMedia: 4.2, nAvaliacoes: 12, tempoMedianoMinutos: 35 };

  beforeEach(() => {
    jest.clearAllMocks();
    definirUsuarioDaSessao(null);
    HospitalService.buscarPorId.mockResolvedValue(null);
    HospitalService.listarIndicadoresDoCatalogo.mockResolvedValue({ porHospital: {} });
    VisitaService.buscarAtiva.mockResolvedValue({ visita: null });
    CatalogoLocal.obterEstabelecimentos.mockResolvedValue([UPA, CLINICA]);
    CatalogoLocal.lerCopiaGuardada.mockResolvedValue([UPA, CLINICA]);
    CatalogoLocal.conferirSeVencida.mockResolvedValue(false);
  });

  test("mostra a cópia guardada, em ordem de nome, sem esperar os indicadores", async () => {
    HospitalService.listarIndicadoresDoCatalogo.mockReturnValue(new Promise(() => {}));

    renderizar();

    expect(await screen.findByText("Upa Riacho Fundo")).toBeTruthy();
    const nomes = screen.getAllByText(/^(Upa Riacho Fundo|Clínica Água)$/).map((n) => n.props.children);
    expect(nomes).toEqual(["Clínica Água", "Upa Riacho Fundo"]);
  });

  test("a nota e o tempo do servidor aparecem no card do hospital", async () => {
    HospitalService.listarIndicadoresDoCatalogo.mockResolvedValue({ porHospital: { hU: NOTA_DA_UPA } });

    renderizar();

    expect(await screen.findByText("12 avaliações")).toBeTruthy();
    expect(screen.getByText(/Tempo médio/)).toBeTruthy();
  });

  test("hospital sem indicadores na resposta fica sem nota", async () => {
    HospitalService.listarIndicadoresDoCatalogo.mockResolvedValue({ porHospital: { hU: NOTA_DA_UPA } });

    renderizar();
    await screen.findByText("12 avaliações");

    expect(screen.getAllByText("Ainda sem avaliações suficientes")).toHaveLength(1);
  });

  test("sem servidor para os indicadores, a lista fica na tela com o aviso", async () => {
    HospitalService.listarIndicadoresDoCatalogo.mockRejectedValue(new Error("Servidor indisponível"));

    renderizar();

    expect(await screen.findByText(/Mostrando a lista guardada no aparelho/)).toBeTruthy();
    expect(screen.getByText("Upa Riacho Fundo")).toBeTruthy();
    expect(screen.queryByText("Algo deu errado")).toBeNull();
  });

  test("enquanto os indicadores só demoram, não mostra o aviso", async () => {
    HospitalService.listarIndicadoresDoCatalogo.mockReturnValue(new Promise(() => {}));

    renderizar();
    await screen.findByText("Upa Riacho Fundo");

    expect(screen.queryByText(/Mostrando a lista guardada no aparelho/)).toBeNull();
  });

  test("ordena como o backend (binário)", async () => {
    const UBS = { id: "hX", nome: "Ubs 1", tipo: "PUBLICO", categoria: "UBS" };
    const UPA_MAIUSCULA = { id: "hY", nome: "UPA 2", tipo: "PUBLICO", categoria: "UPA" };
    CatalogoLocal.lerCopiaGuardada.mockResolvedValue([UBS, UPA_MAIUSCULA]);

    renderizar();
    await screen.findByText("UPA 2");

    const nomes = screen.getAllByText(/^(Ubs 1|UPA 2)$/).map((n) => n.props.children);
    expect(nomes).toEqual(["UPA 2", "Ubs 1"]);
  });

  test("estabelecimento desativado na cópia não aparece", async () => {
    CatalogoLocal.lerCopiaGuardada.mockResolvedValue([UPA, { ...CLINICA, ativo: false }]);

    renderizar();
    await screen.findByText("Upa Riacho Fundo");

    expect(screen.queryByText("Clínica Água")).toBeNull();
  });

  test("o filtro de tipo vale para a cópia guardada", async () => {
    renderizar();
    await screen.findByText("Upa Riacho Fundo");

    // O chip de filtro vem antes da lista; o selo "Privado" do card repete o texto.
    fireEvent.press(screen.getAllByRole("button", { name: "Privado" })[0]);

    expect(await screen.findByText("Clínica Água")).toBeTruthy();
    expect(screen.queryByText("Upa Riacho Fundo")).toBeNull();
  });

  test("a busca ignora acento e caixa na cópia guardada", async () => {
    renderizar();
    await screen.findByText("Upa Riacho Fundo");

    fireEvent.changeText(screen.getByPlaceholderText("Buscar hospital por nome"), "AGUA");

    await waitFor(() => expect(screen.queryByText("Upa Riacho Fundo")).toBeNull());
    expect(screen.getByText("Clínica Água")).toBeTruthy();
  });

  test("sem cópia guardada, usa o catálogo baixado assim que ele chega", async () => {
    CatalogoLocal.lerCopiaGuardada.mockResolvedValue(null);
    CatalogoLocal.obterEstabelecimentos.mockResolvedValue([UPA]);

    renderizar();

    expect(await screen.findByText("Upa Riacho Fundo")).toBeTruthy();
  });

  test("com cópia guardada, confere a idade dela em segundo plano sem esperar a rede", async () => {
    CatalogoLocal.conferirSeVencida.mockReturnValue(new Promise(() => {}));

    renderizar();

    expect(await screen.findByText("Upa Riacho Fundo")).toBeTruthy();
    expect(CatalogoLocal.conferirSeVencida).toHaveBeenCalledTimes(1);
    expect(CatalogoLocal.obterEstabelecimentos).not.toHaveBeenCalled();
  });

  test("cópia vencida trocada em segundo plano entra na lista sem recarregar a tela", async () => {
    const NOVO = { id: "hN", nome: "Hospital Novo", tipo: "PUBLICO", categoria: "HOSPITAL" };
    CatalogoLocal.lerCopiaGuardada.mockResolvedValueOnce([UPA]).mockResolvedValue([UPA, NOVO]);
    CatalogoLocal.conferirSeVencida.mockResolvedValueOnce(true).mockResolvedValue(false);

    renderizar();

    expect(await screen.findByText("Hospital Novo")).toBeTruthy();
  });

  test("nota embutida numa cópia antiga do catálogo não aparece no lugar da do servidor", async () => {
    CatalogoLocal.lerCopiaGuardada.mockResolvedValue([{ ...UPA, indicadores: NOTA_DA_UPA }]);
    HospitalService.listarIndicadoresDoCatalogo.mockReturnValue(new Promise(() => {}));

    renderizar();
    await screen.findByText("Upa Riacho Fundo");

    expect(screen.queryByText("12 avaliações")).toBeNull();
  });

  test("busca sem resultado na cópia sugere ajustar o filtro", async () => {
    renderizar();
    await screen.findByText("Upa Riacho Fundo");

    fireEvent.changeText(screen.getByPlaceholderText("Buscar hospital por nome"), "inexistente");

    expect(await screen.findByText("Nenhum hospital encontrado")).toBeTruthy();
  });

  test("catálogo vazio oferece sugerir um hospital", async () => {
    CatalogoLocal.lerCopiaGuardada.mockResolvedValue([]);

    renderizar();
    fireEvent.press(await screen.findByText("Sugerir hospital"));

    expect(NAVEGACAO.navigate).toHaveBeenCalledWith("SugerirHospital");
  });

  test("puxar para atualizar confere o catálogo com o servidor e busca os indicadores de novo", async () => {
    renderizar();
    await screen.findByText("Upa Riacho Fundo");
    await waitFor(() => expect(HospitalService.listarIndicadoresDoCatalogo).toHaveBeenCalledTimes(1));

    await act(async () => {
      screen.getByTestId("lista-hospitais").props.refreshControl.props.onRefresh();
    });

    await waitFor(() => expect(HospitalService.listarIndicadoresDoCatalogo).toHaveBeenCalledTimes(2));
    expect(CatalogoLocal.obterEstabelecimentos).toHaveBeenCalledWith({ idadeMaximaMs: 0 });
  });
});
