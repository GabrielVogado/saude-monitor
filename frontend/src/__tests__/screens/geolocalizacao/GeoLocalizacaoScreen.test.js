/**
 * Mapa de hospitais (F-07 — Sprint S8).
 *
 * Cobre os dois entregáveis da estória: os polígonos das geofences renderizados
 * numa fonte GeoJSON única e o filtro geográfico por raio, que delega o recorte
 * ao backend (`GET /api/v1/hospitais?latitude&longitude&raioKm`) quando há GPS.
 */
import React from "react";
import { act, render, fireEvent, screen, waitFor } from "@testing-library/react-native";
import GeoLocalizacaoScreen from "../../../screens/geolocalizacao/view/GeoLocalizacaoScreen";
import HospitalService from "../../../screens/hospitais/service/HospitalService";
import { useGeolocalizacao } from "../../../screens/geolocalizacao/service/GeoLocalizacaoService";

jest.mock("../../../screens/hospitais/service/HospitalService");

// @maplibre/maplibre-react-native: componentes nativos não suportados pelo Jest;
// substituídos por Views que preservam os props (mesmo padrão do App.test.js).
/**
 * Espiões COMPARTILHADOS da câmera.
 *
 * A versão anterior criava `jest.fn()` novos dentro do `useImperativeHandle`, então cada
 * remontagem gerava espiões diferentes e nenhum teste conseguia afirmar nada sobre o
 * enquadramento. Era por isso que a correção da câmera passava sem cobertura: removê-la
 * mantinha a suíte verde (mutação M-C sobreviveu).
 */
const mockCamera = { easeTo: jest.fn(), fitBounds: jest.fn() };

jest.mock("@maplibre/maplibre-react-native", () => {
  const ReactMock = require("react");
  const { View } = require("react-native");
  const stub = ({ children, ...props }) => <View {...props}>{children}</View>;

  // A Camera é acessada por ref (easeTo/fitBounds) pela tela; o stub precisa
  // expor esses métodos, senão o enquadramento derruba o render nos testes.
  const Camera = ReactMock.forwardRef(({ children, ...props }, ref) => {
    ReactMock.useImperativeHandle(ref, () => ({
      easeTo: (...args) => mockCamera.easeTo(...args),
      fitBounds: (...args) => mockCamera.fitBounds(...args),
    }));
    return <View {...props}>{children}</View>;
  });

  return {
    __esModule: true,
    Map: stub,
    Camera,
    Marker: stub,
    GeoJSONSource: stub,
    Layer: stub,
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
    expect(fonte.props.data.features).toHaveLength(1);
    expect(fonte.props.data.features[0].properties).toEqual({ id: "h1", nome: "Hospital Alfa" });
  });

  test("sem raio selecionado, carrega o catálogo completo", async () => {
    renderizar();

    await waitFor(() => {
      expect(HospitalService.listar).toHaveBeenCalledWith({ size: 100 });
    });
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
    expect(HospitalService.listar).toHaveBeenLastCalledWith({ size: 100 });
  });

  test("tocar num polígono abre o detalhe do hospital correspondente", async () => {
    renderizar();

    const fonte = await screen.findByTestId("geofences-hospitais");
    act(() => {
      fonte.props.onPress({ features: [{ properties: { id: "h1" } }] });
    });

    await waitFor(() =>
      expect(NAVEGACAO.navigate).toHaveBeenCalledWith("Hospitais", {
        screen: "HospitalDetalhe",
        params: { id: "h1" },
      })
    );
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
    // O remonte cria uma `<Camera>` NOVA, cujo `initialViewState` é BRASIL_REGION (zoom
    // 3, o país inteiro). Se o enquadramento não rodar de novo, quem aproximou o próprio
    // bairro, tocou num hospital e voltou encontra o mapa zerado — e rebaixando tiles.
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

  test("falha ao carregar hospitais exibe mensagem sem derrubar o mapa", async () => {
    HospitalService.listar.mockRejectedValueOnce(new Error("Backend indisponível."));

    renderizar();

    expect(await screen.findByText("Backend indisponível.")).toBeTruthy();
  });
});
