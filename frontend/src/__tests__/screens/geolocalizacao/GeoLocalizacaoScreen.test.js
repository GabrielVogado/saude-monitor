/**
 * Mapa de hospitais (F-07 — Sprint S8).
 *
 * Cobre os dois entregáveis da estória: os polígonos das geofences renderizados
 * numa fonte GeoJSON única e o filtro geográfico por raio, que delega o recorte
 * ao backend (`GET /api/v1/hospitais?latitude&longitude&raioKm`) quando há GPS.
 */
import React from "react";
import {
  act,
  render,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import GeoLocalizacaoScreen from "../../../screens/geolocalizacao/view/GeoLocalizacaoScreen";
import HospitalService from "../../../screens/hospitais/service/HospitalService";
import { useGeolocalizacao } from "../../../screens/geolocalizacao/service/GeoLocalizacaoService";

jest.mock("../../../screens/hospitais/service/HospitalService");

// @rnmapbox/maps: componentes nativos não suportados pelo Jest;
// substituídos por Views que preservam os props (mesmo padrão do App.test.js).
/**
 * Espiões COMPARTILHADOS da câmera.
 *
 * A versão anterior criava `jest.fn()` novos dentro do `useImperativeHandle`, então cada
 * remontagem gerava espiões diferentes e nenhum teste conseguia afirmar nada sobre o
 * enquadramento. Era por isso que a correção da câmera passava sem cobertura: removê-la
 * mantinha a suíte verde (mutação M-C sobreviveu).
 */
const mockCamera = { setCamera: jest.fn(), fitBounds: jest.fn() };
const mockMapView = { props: null };

jest.mock("@rnmapbox/maps", () => {
  const ReactMock = require("react");
  const { View } = require("react-native");
  const stub = ({ children, ...props }) => <View {...props}>{children}</View>;

  // A Camera é acessada por ref (setCamera/fitBounds) pela tela; o stub precisa
  // expor esses métodos, senão o enquadramento derruba o render nos testes.
  const Camera = ReactMock.forwardRef(({ children, ...props }, ref) => {
    ReactMock.useImperativeHandle(ref, () => ({
      setCamera: (...args) => mockCamera.setCamera(...args),
      fitBounds: (...args) => mockCamera.fitBounds(...args),
    }));
    return <View {...props}>{children}</View>;
  });

  return {
    __esModule: true,
    default: { setAccessToken: jest.fn(), StyleURL: { Street: "mapbox://styles/mapbox/streets-v11" } },
    StyleURL: { Street: "mapbox://styles/mapbox/streets-v11" },
    MapView: ({ children, ...props }) => {
      mockMapView.props = props;
      return <View {...props}>{children}</View>;
    },
    Camera,
    MarkerView: stub,
    ShapeSource: stub,
    FillLayer: stub,
    LineLayer: stub,
  };
});

// O provider real inicia watchPositionAsync; aqui controlamos o estado do GPS.
jest.mock("../../../screens/geolocalizacao/service/GeoLocalizacaoService", () => ({
  __esModule: true,
  GeolocalizacaoProvider: ({ children }) => children,
  useGeolocalizacao: jest.fn(),
}));

const ANEL = [[-47.89, -15.79], [-47.88, -15.79], [-47.88, -15.78], [-47.89, -15.79]];

const HOSPITAL = {
  id: "h1",
  nome: "Hospital Alfa",
  geofence: { type: "Polygon", coordinates: [ANEL] },
};

/**
 * O mock precisa de `addListener` — não é enfeite.
 *
 * Com `{ navigate }` apenas, o `navigation?.addListener?.(...)` da tela curto-circuita e
 * o efeito de remontagem do mapa NUNCA executa em teste nenhum. Verificado por mutação:
 * apagando o efeito inteiro do código de produção, os 8 testes continuavam verdes —
 * enquanto no aparelho o mapa não voltaria depois do primeiro toque num hospital.
 *
 * `ouvintes` guarda os callbacks para que o teste possa disparar o `focus` à mão, que é
 * o que o React Navigation faria ao voltar para a aba.
 */
const ouvintes = {};
const NAVEGACAO = {
  navigate: jest.fn(),
  addListener: jest.fn((evento, callback) => {
    ouvintes[evento] = callback;
    return () => delete ouvintes[evento];
  }),
};

function comGps(coordenadas) {
  useGeolocalizacao.mockReturnValue({
    coordenadas,
    carregando: false,
    permissaoConcedida: true,
    erro: null,
    iniciarMonitoramento: jest.fn(),
    pararMonitoramento: jest.fn(),
  });
}

function renderizar() {
  return render(<GeoLocalizacaoScreen navigation={NAVEGACAO} />);
}

function hospitalTeste(id, nome, extra = {}) {
  return { id, nome, geofence: { type: "Polygon", coordinates: [ANEL] }, ...extra };
}

/**
 * Abrir um hospital pelo mapa são DOIS toques: selecionar (marcador ou polígono) e
 * tocar no card que aparece sobre o mapa. Só o segundo navega.
 */
async function selecionarPeloPoligono(id = "h1") {
  const fonte = await screen.findByTestId("geofences-hospitais");
  act(() => {
    fonte.props.onPress({ features: [{ properties: { id } }] });
  });
  return fonte;
}

async function tocarNoCard(nome = "Hospital Alfa") {
  const card = await screen.findByTestId("card-hospital-mapa");
  fireEvent.press(within(card).getByLabelText(new RegExp(`^${nome},`)));
}

// O marcador usa o sistema de responder do RN (não `onPress`) — mesmo mecanismo de
// antes desta mudança, mantido por não poder ser validado em aparelho aqui.
function tocarNoMarcador(elemento) {
  fireEvent(elemento, "responderRelease");
}

describe("GeoLocalizacaoScreen (F-07)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    HospitalService.listar.mockResolvedValue({ content: [HOSPITAL] });
    comGps({ latitude: -15.785, longitude: -47.885, accuracy: 10 });
  });

  test("renderiza os polígonos das geofences numa fonte GeoJSON única", async () => {
    renderizar();

    const fonte = await screen.findByTestId("geofences-hospitais");
    expect(fonte.props.shape.features).toHaveLength(1);
    expect(fonte.props.shape.features[0].properties).toEqual({ id: "h1", nome: "Hospital Alfa" });
  });

  test("sem raio selecionado, carrega o catálogo completo", async () => {
    renderizar();

    await waitFor(() => {
      expect(HospitalService.listar).toHaveBeenCalledWith({ page: 0, size: 100 });
    });
  });

  test("BUG-09: 'Todos' percorre todas as páginas até completar o catálogo, não só a primeira", async () => {
    // Regressão relatada em 09/09/2026: com 340 hospitais ativos e o backend limitando
    // `size` a 100, uma única chamada com "Todos" selecionado só trazia os 100 primeiros
    // (por ordem "natural" do Mongo) — as UBS do Recanto das Emas, entre outras, ficavam
    // de fora do mapa mesmo estando ativas, e só apareciam com um raio selecionado
    // porque o recorte geográfico reduzia o total a poucos itens.
    const p0 = Array.from({ length: 100 }, (_, i) => ({ id: `a${i}`, nome: `Hospital ${i}` }));
    const p1 = Array.from({ length: 100 }, (_, i) => ({ id: `b${i}`, nome: `Hospital ${100 + i}` }));
    const p2 = [{ id: "ubs-05", nome: "Ubs 05 Recanto das Emas" }];

    HospitalService.listar.mockImplementation(({ page }) => {
      const paginas = [p0, p1, p2];
      return Promise.resolve({ content: paginas[page], totalElements: 201 });
    });

    renderizar();

    await waitFor(() => {
      expect(HospitalService.listar).toHaveBeenLastCalledWith({ page: 2, size: 100 });
    });
    expect(HospitalService.listar).toHaveBeenNthCalledWith(1, { page: 0, size: 100 });
    expect(HospitalService.listar).toHaveBeenNthCalledWith(2, { page: 1, size: 100 });
  });

  test("selecionar um raio envia latitude, longitude e raioKm ao backend", async () => {
    renderizar();
    await screen.findByText("5 km");

    fireEvent.press(screen.getByText("5 km"));

    await waitFor(() => {
      expect(HospitalService.listar).toHaveBeenLastCalledWith({
        latitude: -15.785,
        longitude: -47.885,
        raioKm: 5,
        size: 100,
      });
    });
  });

  test("raio selecionado sem GPS avisa o usuário e mantém o catálogo completo", async () => {
    comGps(null);
    renderizar();
    await screen.findByText("10 km");

    fireEvent.press(screen.getByText("10 km"));

    expect(
      await screen.findByText("Aguardando o GPS para filtrar hospitais num raio de 10 km.")
    ).toBeTruthy();
    expect(HospitalService.listar).toHaveBeenLastCalledWith({ page: 0, size: 100 });
  });

  test("tocar no card do hospital selecionado abre o detalhe na própria pilha do Mapa", async () => {
    // Achado de 10/09/2026: navegar para a pilha da aba Hospitais em vez da
    // própria pilha da aba Mapa ("MapaStack" em App.js) trocava de aba por baixo
    // dos panos — voltar do detalhe pousava na lista de Hospitais, não no mapa.
    renderizar();

    await selecionarPeloPoligono("h1");
    // O toque no polígono só seleciona: o card aparece, nada navega ainda.
    expect(await screen.findByTestId("card-hospital-mapa")).toBeTruthy();
    expect(NAVEGACAO.navigate).not.toHaveBeenCalled();

    await tocarNoCard();
    await waitFor(() =>
      expect(NAVEGACAO.navigate).toHaveBeenCalledWith("HospitalDetalhe", { id: "h1" })
    );
  });

  test("BUG-10: o ponto do hospital ancora na coordenada, não no centro da linha ponto+rótulo", async () => {
    // Regressão relatada em 12/09/2026 com evidência em aparelho: o ponto aparecia
    // FORA do círculo do geofence com pouco zoom e "centralizava" ao aproximar.
    // Causa na renderização, não no dado: o filho do `MarkerView` é uma linha
    // `[ponto + rótulo]` e a âncora padrão (`{x: 0.5, y: 0.5}`) centraliza a linha
    // inteira — o ponto deslocava ~metade da largura da linha em px fixos, e o
    // círculo pequeno (pouco zoom) não o continha. Marcador e polígono nascem do
    // mesmo `centroDoHospital`, então a coordenada aqui tem que ser exatamente a do
    // centroide do hospital de teste.
    renderizar();

    const marcador = await screen.findByTestId("marcador-hospital-h1");
    // Centroide do ANEL de teste: lng (-47.89-47.88-47.88-47.89)/4, lat idem —
    // o mesmo ponto que o polígono usa (ambos saem de `centroDoHospital`).
    // `toBeCloseTo` porque a média em ponto flutuante dá -47.885000000000005.
    expect(marcador.props.coordinate[0]).toBeCloseTo(-47.885, 9);
    expect(marcador.props.coordinate[1]).toBeCloseTo(-15.7875, 9);
    // O marcador agora é um ícone SIMÉTRICO: a âncora padrão (centro) já põe o centro
    // do ícone na coordenada. Uma âncora explícita só faz sentido para um filho
    // assimétrico (o antigo "ponto + rótulo" pedia `{x: 0, y: 0.5}`) — reaparecer
    // aqui significa que o deslocamento do BUG-10 voltou.
    expect(marcador.props.anchor).toBeUndefined();
  });

  test("BUG-11: toque sobre geofences empilhados oferece a lista em vez de abrir só o primeiro", async () => {
    // Regressão relatada em 12/09/2026 com evidência em aparelho (São Sebastião):
    // UPA + UBSs + Casa de Parto com círculos sobrepostos — o toque abria sempre
    // `features[0]` e as demais unidades eram inalcançáveis. Empilhamento tem duas
    // origens (duplicatas de seed E vizinhas reais), então a correção é na
    // desambiguação, não no dado: ver `07-dados/relatorio-auditoria-duplicatas-20260912.md`.
    // Usa `CSOptionSheet` em vez de `Alert.alert`: no Android, `Alert.alert` só
    // exibe os 3 primeiros botões — insuficiente para o cenário de 5+ unidades
    // que motivou o bug.
    HospitalService.listar.mockResolvedValue({
      content: [
        hospitalTeste("h1", "Hospital Alfa"),
        hospitalTeste("h2", "Hospital Beta"),
        hospitalTeste("h3", "Hospital Gama"),
      ],
    });
    renderizar();
    const fonte = await screen.findByTestId("geofences-hospitais");

    act(() => {
      fonte.props.onPress({
        features: [
          { properties: { id: "h1", nome: "Hospital Alfa" } },
          { properties: { id: "h2", nome: "Hospital Beta" } },
          { properties: { id: "h3", nome: "Hospital Gama" } },
        ],
      });
    });

    const sheet = within(await screen.findByTestId("option-sheet"));
    expect(await sheet.findByText("Hospital Alfa")).toBeTruthy();
    expect(await sheet.findByText("Hospital Beta")).toBeTruthy();
    expect(await sheet.findByText("Hospital Gama")).toBeTruthy();
    expect(NAVEGACAO.navigate).not.toHaveBeenCalled();

    // Escolher a TERCEIRA unidade a seleciona (card do Gama sobre o mapa) e só o
    // toque no card navega — o `Alert.alert` do Android cortaria exatamente esta
    // opção antes da correção.
    fireEvent.press(sheet.getByText("Hospital Gama"));
    const card = await screen.findByTestId("card-hospital-mapa");
    expect(within(card).getByText("Hospital Gama")).toBeTruthy();
    expect(screen.queryByTestId("option-sheet")).toBeNull();
    expect(NAVEGACAO.navigate).not.toHaveBeenCalled();

    await tocarNoCard("Hospital Gama");
    await waitFor(() => expect(NAVEGACAO.navigate).toHaveBeenCalledWith("HospitalDetalhe", { id: "h3" }));
  });

  test("BUG-11: nomes repetidos ganham sufixo de distância para distinguir", async () => {
    // "Ubs São Sebastião" ×5 no complexo da Papuda: 5 opções idênticas não
    // servem para escolher. Com GPS, o repetido leva "· N m" (haversine do ponto
    // do hospital); sem hospital correspondente na lista, volta ao nome puro.
    renderizar();
    const fonte = await screen.findByTestId("geofences-hospitais");

    act(() => {
      fonte.props.onPress({
        features: [
          { properties: { id: "h1", nome: "Hospital Alfa" } },
          { properties: { id: "h2", nome: "Hospital Alfa" } },
        ],
      });
    });

    // h1 está na lista (centroide ~278 m do GPS mockado): ganha sufixo de
    // distância. h2 não está na lista: volta ao nome puro.
    const sheet = within(await screen.findByTestId("option-sheet"));
    expect(await sheet.findByText(/^Hospital Alfa · \d+ m$/)).toBeTruthy();
    expect(await sheet.findByText("Hospital Alfa")).toBeTruthy();
  });

  test("BUG-11: toque com um único polígono não mostra diálogo — seleciona direto", async () => {
    renderizar();
    const fonte = await screen.findByTestId("geofences-hospitais");

    act(() => {
      fonte.props.onPress({ features: [{ properties: { id: "h1", nome: "Hospital Alfa" } }] });
    });

    expect(screen.queryByTestId("option-sheet")).toBeNull();
    expect(await screen.findByTestId("card-hospital-mapa")).toBeTruthy();
    expect(NAVEGACAO.navigate).not.toHaveBeenCalled();
  });

  test("BUG-04: o mapa sai da árvore ANTES de a navegação acontecer", async () => {
    // Esta é a regressão do ANR, não um detalhe de implementação. Navegar com o mapa
    // ainda montado deixava o React Navigation apenas ESCONDER a view: a thread de
    // renderização GL morria, mas o `MapView` continuava se julgando vivo. O toque
    // confirmado que o Android entrega ~164 ms depois caía em `queryRenderedFeatures`,
    // uma JNI síncrona, e travava a thread principal por 30-40 s. Foram 8 ANRs assim.
    //
    // Desmontado, o `NativeMapView.destroyed` fica marcado e a mesma chamada retorna
    // lista vazia sem tocar no nativo. Por isso a ORDEM é o que precisa ser garantido —
    // afirmar só que a navegação ocorreu deixaria o defeito passar de novo.
    //
    // Com o card, o gatilho da navegação é o toque NO CARD (o marcador só seleciona) —
    // é ele que chama `abrirHospital`, então é ele que precisa respeitar a ordem.
    renderizar();
    await selecionarPeloPoligono();

    let mapaAindaMontado = null;
    NAVEGACAO.navigate.mockImplementation(() => {
      mapaAindaMontado = screen.queryByTestId("geofences-hospitais") !== null;
    });

    await tocarNoCard();

    await waitFor(() => expect(NAVEGACAO.navigate).toHaveBeenCalled());
    expect(mapaAindaMontado).toBe(false);
  });

  test("BUG-04: o mapa VOLTA ao focar a aba de novo", async () => {
    // A metade que faltava. Desmontar o mapa resolve o ANR, mas sem remontar a correção
    // troca um app travado por uma aba de mapa permanentemente vazia — pior do que o
    // defeito original, porque não dá nem para fechar e reabrir a tela.
    renderizar();
    await selecionarPeloPoligono();
    await tocarNoCard();
    await waitFor(() => expect(NAVEGACAO.navigate).toHaveBeenCalled());
    expect(screen.queryByTestId("geofences-hospitais")).toBeNull();

    // O React Navigation dispara `focus` ao voltar para a aba.
    act(() => ouvintes.focus?.());

    expect(await screen.findByTestId("geofences-hospitais")).toBeTruthy();
    // O card também volta a estar lá: a seleção sobrevive à ida e volta do detalhe.
    expect(screen.getByTestId("card-hospital-mapa")).toBeTruthy();
  });

  test("BUG-04: ao voltar, o mapa é reenquadrado nos hospitais — não no Brasil inteiro", async () => {
    // O remonte cria uma `<Camera>` NOVA, cuja posição inicial é BRASIL_REGION (zoom
    // 3, o país inteiro). Se o enquadramento não rodar de novo, quem aproximou o próprio
    // bairro, tocou num hospital e voltou encontra o mapa zerado.
    // A identidade de `hospitais` não muda no desmonte/remonte, então o efeito só
    // dispara porque `mapaMontado` está nas dependências dele. É isso que este teste
    // protege: sem o `mapaMontado` lá, a mutação sobrevivia.
    renderizar();
    await screen.findByTestId("geofences-hospitais");
    await waitFor(() => expect(mockCamera.fitBounds).toHaveBeenCalled());

    await selecionarPeloPoligono();
    await tocarNoCard();
    await waitFor(() => expect(NAVEGACAO.navigate).toHaveBeenCalled());

    mockCamera.fitBounds.mockClear();
    act(() => ouvintes.focus?.());

    await screen.findByTestId("geofences-hospitais");
    await waitFor(() => expect(mockCamera.fitBounds).toHaveBeenCalled());
  });

  test("o mapa reenquadra os hospitais quando termina de carregar (a Camera só existe depois do load na Web)", async () => {
    // No Web os filhos do mapa montam depois do `load`: o efeito de enquadramento roda
    // antes, com `cameraRef` nulo, e não repete. `onDidFinishLoadingMap` é o gancho que
    // roda com a câmera pronta.
    renderizar();
    await screen.findByTestId("geofences-hospitais");
    await waitFor(() => expect(mockCamera.fitBounds).toHaveBeenCalled());
    mockCamera.fitBounds.mockClear();

    act(() => mockMapView.props.onDidFinishLoadingMap());

    expect(mockCamera.fitBounds).toHaveBeenCalledTimes(1);
  });

  test("BUG-04: sem `navigate`, o mapa NÃO é desmontado", async () => {
    // Desmontar antes de saber se há para onde ir deixaria a tela sem mapa e sem
    // conserto: quem remonta é o `focus`, e ele só vem se a tela tiver perdido o foco.
    render(<GeoLocalizacaoScreen navigation={{ addListener: jest.fn() }} />);
    await selecionarPeloPoligono();
    await tocarNoCard();

    expect(screen.queryByTestId("geofences-hospitais")).not.toBeNull();
  });

  test("BUG-04: sem hospital no toque, o mapa continua montado e não navega", async () => {
    // O guard `if (!hospitalId) return` não pode desmontar o mapa à toa: um toque no
    // mapa fora de qualquer polígono chega aqui sem `id`, e derrubar o mapa nesse caso
    // apagaria a tela inteira do usuário sem nenhuma navegação em troca.
    renderizar();
    const fonte = await screen.findByTestId("geofences-hospitais");

    act(() => {
      fonte.props.onPress({ features: [{ properties: {} }] });
    });

    expect(NAVEGACAO.navigate).not.toHaveBeenCalled();
    expect(screen.queryByTestId("geofences-hospitais")).not.toBeNull();
    // Sem `id` também não há o que selecionar: nenhum card vazio sobre o mapa.
    expect(screen.queryByTestId("card-hospital-mapa")).toBeNull();
  });

  test("BUG-05: o mapa fica dentro de um container que recorta o que vaza", async () => {
    // O rótulo de cada hospital é uma View Android comum, filha da MapView, posicionada
    // por coordenada absoluta (`MarkerViewManager.updateMarkerPosition`). Quando o ponto
    // sai da viewport a coordenada fica negativa — e a própria biblioteca desliga o
    // recorte que conteria o desenho (`mapView.clipChildren = false`, no `addMarker`).
    // Arrastando o mapa, os nomes apareciam por cima do cabeçalho e da caixa de
    // informações, cobrindo os chips de raio.
    //
    // As DUAS asserções são necessárias. Só o `overflow` deixaria passar um container
    // vazio ao lado do mapa; só o aninhamento deixaria passar um container que não
    // recorta. Verificado por mutação: apagar qualquer uma das duas mantinha o teste
    // verde com o defeito de volta na tela.
    renderizar();

    const container = await screen.findByTestId("mapa-container");
    expect(container).toHaveStyle({ overflow: "hidden" });
    expect(within(container).getByTestId("geofences-hospitais")).toBeTruthy();
  });

  test("BUG-05: o container do mapa continua reservando o espaço com o mapa desmontado", async () => {
    // O container também é o placeholder que o BUG-04 exigia: sem ele montado durante a
    // navegação, a caixa de informações salta para junto do cabeçalho no quadro da
    // transição — piscada visível em aparelho lento.
    renderizar();
    await selecionarPeloPoligono();
    await tocarNoCard();

    await waitFor(() => expect(screen.queryByTestId("geofences-hospitais")).toBeNull());
    expect(screen.getByTestId("mapa-container")).toHaveStyle({ flex: 1 });
    // O card mora no mesmo container: continua na tela durante a transição, em vez de
    // piscar junto com o mapa que sai.
    expect(within(screen.getByTestId("mapa-container")).getByTestId("card-hospital-mapa")).toBeTruthy();
  });

  describe("card do hospital sobre o mapa", () => {
    const INDICADORES = { notaMedia: 4.2, nAvaliacoes: 12, tempoMedianoMinutos: 95 };

    test("tocar no marcador seleciona o hospital e mostra o card com as informações básicas", async () => {
      HospitalService.listar.mockResolvedValue({
        content: [
          hospitalTeste("h1", "Hospital Alfa", {
            categoria: "UPA",
            tipo: "PUBLICO",
            indicadores: INDICADORES,
          }),
        ],
      });
      renderizar();

      const marcador = await screen.findByLabelText("Ver informações de Hospital Alfa");
      // Antes do toque: nenhum card, e o marcador é só ícone — o nome não vira rótulo
      // solto no mapa (com ~340 hospitais os rótulos se sobrepunham).
      expect(screen.queryByTestId("card-hospital-mapa")).toBeNull();
      expect(screen.queryByText("Hospital Alfa")).toBeNull();

      tocarNoMarcador(marcador);

      const card = await screen.findByTestId("card-hospital-mapa");
      expect(within(card).getByText("Hospital Alfa")).toBeTruthy();
      expect(within(card).getByText("UPA")).toBeTruthy();
      expect(within(card).getByText("Público")).toBeTruthy();
      expect(within(card).getByText("12 avaliações")).toBeTruthy();
      expect(within(card).getByText("Tempo médio: 1h35")).toBeTruthy();
      // Selecionar não navega: o detalhe só abre pelo toque no card.
      expect(NAVEGACAO.navigate).not.toHaveBeenCalled();
    });

    test("o card mostra a distância do GPS até o hospital (F-07, critério 3)", async () => {
      renderizar();

      tocarNoMarcador(await screen.findByLabelText("Ver informações de Hospital Alfa"));

      const card = await screen.findByTestId("card-hospital-mapa");
      // Centroide do ANEL de teste a ~278 m do GPS mockado (ver o teste do BUG-11).
      expect(within(card).getByText(/^\d+ m de você$/)).toBeTruthy();
    });

    test("sem GPS, o card não mostra distância", async () => {
      comGps(null);
      renderizar();

      tocarNoMarcador(await screen.findByLabelText("Ver informações de Hospital Alfa"));

      const card = await screen.findByTestId("card-hospital-mapa");
      expect(within(card).getByText("Hospital Alfa")).toBeTruthy();
      expect(within(card).queryByText(/de você/)).toBeNull();
    });

    test("o marcador selecionado é destacado e desenhado por último, acima dos demais", async () => {
      HospitalService.listar.mockResolvedValue({
        content: [hospitalTeste("h1", "Hospital Alfa"), hospitalTeste("h2", "Hospital Beta")],
      });
      renderizar();

      tocarNoMarcador(await screen.findByLabelText("Ver informações de Hospital Alfa"));
      await screen.findByTestId("card-hospital-mapa");

      // Marcador filho posterior fica por cima do anterior: com centenas de ícones
      // sobrepostos, o destacado tem de ser o último — mesmo sendo o primeiro da lista.
      const ordem = screen.getAllByTestId(/^marcador-hospital-/).map((m) => m.props.testID);
      expect(ordem).toEqual(["marcador-hospital-h2", "marcador-hospital-h1"]);
      expect(screen.getByLabelText("Ver informações de Hospital Alfa")).toBeSelected();
      expect(screen.getByLabelText("Ver informações de Hospital Beta")).not.toBeSelected();
    });

    test("selecionar centraliza a câmera no hospital, sem alterar o zoom", async () => {
      HospitalService.listar.mockResolvedValue({ content: [hospitalTeste("h1", "Hospital Alfa")] });
      renderizar();

      const marcador = await screen.findByLabelText("Ver informações de Hospital Alfa");
      mockCamera.setCamera.mockClear();
      tocarNoMarcador(marcador);

      await waitFor(() => expect(mockCamera.setCamera).toHaveBeenCalledTimes(1));
      const config = mockCamera.setCamera.mock.calls[0][0];
      // Mesmo centroide do polígono e do marcador (ver BUG-10).
      expect(config.centerCoordinate[0]).toBeCloseTo(-47.885, 9);
      expect(config.centerCoordinate[1]).toBeCloseTo(-15.7875, 9);
      // O card cobre a parte de baixo do mapa; o zoom continua sendo do usuário.
      expect(config.zoomLevel).toBeUndefined();
    });

    test("fechar o card desfaz a seleção sem navegar", async () => {
      renderizar();
      tocarNoMarcador(await screen.findByLabelText("Ver informações de Hospital Alfa"));
      await screen.findByTestId("card-hospital-mapa");

      fireEvent.press(screen.getByLabelText("Fechar informações do hospital"));

      expect(screen.queryByTestId("card-hospital-mapa")).toBeNull();
      expect(screen.getByLabelText("Ver informações de Hospital Alfa")).not.toBeSelected();
      expect(NAVEGACAO.navigate).not.toHaveBeenCalled();
    });

    test("tocar em outro marcador troca o hospital do card", async () => {
      HospitalService.listar.mockResolvedValue({
        content: [hospitalTeste("h1", "Hospital Alfa"), hospitalTeste("h2", "Hospital Beta")],
      });
      renderizar();

      tocarNoMarcador(await screen.findByLabelText("Ver informações de Hospital Alfa"));
      const card = await screen.findByTestId("card-hospital-mapa");
      expect(within(card).getByText("Hospital Alfa")).toBeTruthy();

      tocarNoMarcador(screen.getByLabelText("Ver informações de Hospital Beta"));

      await waitFor(() =>
        expect(within(screen.getByTestId("card-hospital-mapa")).getByText("Hospital Beta")).toBeTruthy()
      );
      expect(within(screen.getByTestId("card-hospital-mapa")).queryByText("Hospital Alfa")).toBeNull();
    });

    test("trocar o raio fecha o card na hora, sem esperar a resposta do backend", async () => {
      renderizar();
      tocarNoMarcador(await screen.findByLabelText("Ver informações de Hospital Alfa"));
      await screen.findByTestId("card-hospital-mapa");

      // Resposta que nunca chega: se o card só sumisse quando o resultado novo excluísse o
      // hospital (em vez de fechar no toque), ele ficaria na tela enquanto o mapa carrega.
      HospitalService.listar.mockReturnValue(new Promise(() => {}));
      fireEvent.press(screen.getByText("5 km"));

      expect(screen.queryByTestId("card-hospital-mapa")).toBeNull();
    });

    test("o card fechado pela troca de raio não volta sozinho quando o raio é restaurado", async () => {
      renderizar();
      tocarNoMarcador(await screen.findByLabelText("Ver informações de Hospital Alfa"));
      await screen.findByTestId("card-hospital-mapa");

      // Mesmo resultado nos dois raios: o hospital selecionado continua na lista, então só
      // um `id` guardado poderia trazer o card de volta.
      fireEvent.press(screen.getByText("5 km"));
      expect(screen.queryByTestId("card-hospital-mapa")).toBeNull();
      fireEvent.press(screen.getByText("Todos"));

      await screen.findByLabelText("Ver informações de Hospital Alfa");
      expect(screen.queryByTestId("card-hospital-mapa")).toBeNull();
    });
  });

  test("falha ao carregar hospitais exibe mensagem sem derrubar o mapa", async () => {
    HospitalService.listar.mockRejectedValueOnce(new Error("Backend indisponível."));

    renderizar();

    expect(await screen.findByText("Backend indisponível.")).toBeTruthy();
  });
});
