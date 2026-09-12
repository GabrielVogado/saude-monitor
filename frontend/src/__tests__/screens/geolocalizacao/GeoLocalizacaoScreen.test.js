/**
 * Mapa de hospitais (F-07 — Sprint S8).
 *
 * Cobre os dois entregáveis da estória: os polígonos das geofences renderizados
 * numa fonte GeoJSON única e o filtro geográfico por raio, que delega o recorte
 * ao backend (`GET /api/v1/hospitais?latitude&longitude&raioKm`) quando há GPS.
 */
import React from "react";
import { act, render, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
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
    MapView: stub,
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

  test("tocar num polígono abre o detalhe do hospital correspondente na própria pilha do Mapa", async () => {
    // Achado de 10/09/2026: navegar para a pilha da aba Hospitais em vez da
    // própria pilha da aba Mapa ("MapaStack" em App.js) trocava de aba por baixo
    // dos panos — voltar do detalhe pousava na lista de Hospitais, não no mapa.
    renderizar();

    const fonte = await screen.findByTestId("geofences-hospitais");
    act(() => {
      fonte.props.onPress({ features: [{ properties: { id: "h1" } }] });
    });

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
    expect(marcador.props.anchor).toEqual({ x: 0, y: 0.5 });
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
    renderizar();
    const fonte = await screen.findByTestId("geofences-hospitais");

    let mapaAindaMontado = null;
    NAVEGACAO.navigate.mockImplementation(() => {
      mapaAindaMontado = screen.queryByTestId("geofences-hospitais") !== null;
    });

    act(() => {
      fonte.props.onPress({ features: [{ properties: { id: "h1" } }] });
    });

    await waitFor(() => expect(NAVEGACAO.navigate).toHaveBeenCalled());
    expect(mapaAindaMontado).toBe(false);
  });

  test("BUG-04: o mapa VOLTA ao focar a aba de novo", async () => {
    // A metade que faltava. Desmontar o mapa resolve o ANR, mas sem remontar a correção
    // troca um app travado por uma aba de mapa permanentemente vazia — pior do que o
    // defeito original, porque não dá nem para fechar e reabrir a tela.
    renderizar();
    const fonte = await screen.findByTestId("geofences-hospitais");

    act(() => {
      fonte.props.onPress({ features: [{ properties: { id: "h1" } }] });
    });
    await waitFor(() => expect(NAVEGACAO.navigate).toHaveBeenCalled());
    expect(screen.queryByTestId("geofences-hospitais")).toBeNull();

    // O React Navigation dispara `focus` ao voltar para a aba.
    act(() => ouvintes.focus?.());

    expect(await screen.findByTestId("geofences-hospitais")).toBeTruthy();
  });

  test("BUG-04: ao voltar, o mapa é reenquadrado nos hospitais — não no Brasil inteiro", async () => {
    // O remonte cria uma `<Camera>` NOVA, cuja posição inicial é BRASIL_REGION (zoom
    // 3, o país inteiro). Se o enquadramento não rodar de novo, quem aproximou o próprio
    // bairro, tocou num hospital e voltou encontra o mapa zerado.
    // A identidade de `hospitais` não muda no desmonte/remonte, então o efeito só
    // dispara porque `mapaMontado` está nas dependências dele. É isso que este teste
    // protege: sem o `mapaMontado` lá, a mutação sobrevivia.
    renderizar();
    const fonte = await screen.findByTestId("geofences-hospitais");
    await waitFor(() => expect(mockCamera.fitBounds).toHaveBeenCalled());

    act(() => {
      fonte.props.onPress({ features: [{ properties: { id: "h1" } }] });
    });
    await waitFor(() => expect(NAVEGACAO.navigate).toHaveBeenCalled());

    mockCamera.fitBounds.mockClear();
    act(() => ouvintes.focus?.());

    await screen.findByTestId("geofences-hospitais");
    await waitFor(() => expect(mockCamera.fitBounds).toHaveBeenCalled());
  });

  test("BUG-04: sem `navigate`, o mapa NÃO é desmontado", async () => {
    // Desmontar antes de saber se há para onde ir deixaria a tela sem mapa e sem
    // conserto: quem remonta é o `focus`, e ele só vem se a tela tiver perdido o foco.
    render(<GeoLocalizacaoScreen navigation={{ addListener: jest.fn() }} />);
    const fonte = await screen.findByTestId("geofences-hospitais");

    act(() => {
      fonte.props.onPress({ features: [{ properties: { id: "h1" } }] });
    });

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
    const fonte = await screen.findByTestId("geofences-hospitais");

    act(() => {
      fonte.props.onPress({ features: [{ properties: { id: "h1" } }] });
    });

    await waitFor(() => expect(screen.queryByTestId("geofences-hospitais")).toBeNull());
    expect(screen.getByTestId("mapa-container")).toHaveStyle({ flex: 1 });
  });

  test("falha ao carregar hospitais exibe mensagem sem derrubar o mapa", async () => {
    HospitalService.listar.mockRejectedValueOnce(new Error("Backend indisponível."));

    renderizar();

    expect(await screen.findByText("Backend indisponível.")).toBeTruthy();
  });
});
