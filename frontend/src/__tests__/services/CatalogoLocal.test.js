/**
 * Catálogo de estabelecimentos guardado no aparelho (APP-01).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import CatalogoLocal, {
  IDADE_MAXIMA_PRIMEIRO_PLANO_MS,
  IDADE_MAXIMA_SEGUNDO_PLANO_MS,
  INTERVALO_MINIMO_GRAVACAO_MS,
} from "../../services/CatalogoLocal";
import { apiRequest } from "../../core/api/apiClient";
import { ApiError } from "../../core/api/apiError";

jest.mock("../../core/api/apiClient", () => ({
  __esModule: true,
  apiRequest: jest.fn(),
}));

const CHAVE = "@saude_monitor:catalogo";
const AGORA = 1_760_000_000_000;
const HOSPITAL = { id: "h1", localizacao: { latitude: -15.8, longitude: -47.9 }, raioMetros: 150 };

async function salvarCatalogoGuardado(conferidoEm, versao = "v1", estabelecimentos = [HOSPITAL]) {
  await AsyncStorage.setItem(CHAVE, JSON.stringify({ versao, estabelecimentos, conferidoEm }));
}

describe("CatalogoLocal", () => {
  beforeEach(() => {
    AsyncStorage.__reset();
    apiRequest.mockReset();
  });

  test("sem cópia, baixa o catálogo e guarda com a versão", async () => {
    apiRequest.mockResolvedValue({ versao: "abc", total: 1, estabelecimentos: [HOSPITAL] });

    await expect(CatalogoLocal.obterEstabelecimentos({ agora: AGORA })).resolves.toEqual([HOSPITAL]);

    expect(apiRequest).toHaveBeenCalledWith("/api/v1/catalogo", { headers: {} });
    expect(JSON.parse(await AsyncStorage.getItem(CHAVE))).toEqual({
      versao: "abc",
      estabelecimentos: [HOSPITAL],
      conferidoEm: AGORA,
    });
  });

  test("cópia dentro da idade pedida vale sem rede", async () => {
    await salvarCatalogoGuardado(AGORA - IDADE_MAXIMA_SEGUNDO_PLANO_MS + 1000);

    await expect(
      CatalogoLocal.obterEstabelecimentos({ idadeMaximaMs: IDADE_MAXIMA_SEGUNDO_PLANO_MS, agora: AGORA })
    ).resolves.toEqual([HOSPITAL]);

    expect(apiRequest).not.toHaveBeenCalled();
  });

  test("cópia vencida é conferida com If-None-Match e o 304 renova a data", async () => {
    await salvarCatalogoGuardado(AGORA - IDADE_MAXIMA_PRIMEIRO_PLANO_MS);
    apiRequest.mockRejectedValue(new ApiError("Não modificado", 304));

    await expect(CatalogoLocal.obterEstabelecimentos({ agora: AGORA })).resolves.toEqual([HOSPITAL]);

    expect(apiRequest).toHaveBeenCalledWith("/api/v1/catalogo", { headers: { "If-None-Match": 'W/"v1"' } });
    expect(JSON.parse(await AsyncStorage.getItem(CHAVE)).conferidoEm).toBe(AGORA);
  });

  test("304 entregue como corpo vazio também mantém a cópia", async () => {
    await salvarCatalogoGuardado(0);
    apiRequest.mockResolvedValue(null);

    await expect(CatalogoLocal.obterEstabelecimentos({ agora: AGORA })).resolves.toEqual([HOSPITAL]);
    expect(JSON.parse(await AsyncStorage.getItem(CHAVE)).conferidoEm).toBe(AGORA);
  });

  test("versão nova substitui a cópia", async () => {
    await salvarCatalogoGuardado(0);
    const novo = { ...HOSPITAL, id: "h2" };
    apiRequest.mockResolvedValue({ versao: "v2", total: 1, estabelecimentos: [novo] });

    await expect(CatalogoLocal.obterEstabelecimentos({ agora: AGORA })).resolves.toEqual([novo]);
    expect(JSON.parse(await AsyncStorage.getItem(CHAVE)).versao).toBe("v2");
  });

  test("sem rede, vale a cópia guardada por mais velha que esteja", async () => {
    await salvarCatalogoGuardado(0);
    apiRequest.mockRejectedValue(new Error("sem internet"));

    await expect(CatalogoLocal.obterEstabelecimentos({ agora: AGORA })).resolves.toEqual([HOSPITAL]);
  });

  test("sem cópia e sem rede, falha para quem chamou decidir", async () => {
    apiRequest.mockRejectedValue(new Error("sem internet"));

    await expect(CatalogoLocal.obterEstabelecimentos({ agora: AGORA })).rejects.toThrow("sem internet");
  });

  test("sem cópia, resposta sem lista é erro", async () => {
    apiRequest.mockResolvedValue({});

    await expect(CatalogoLocal.obterEstabelecimentos({ agora: AGORA })).rejects.toThrow("Catálogo sem estabelecimentos.");
  });

  test("lerCopiaGuardada devolve a cópia sem ir ao servidor, por mais velha que esteja", async () => {
    await salvarCatalogoGuardado(0);

    expect(await CatalogoLocal.lerCopiaGuardada()).toEqual([HOSPITAL]);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  test("lerCopiaGuardada sem cópia devolve null", async () => {
    expect(await CatalogoLocal.lerCopiaGuardada()).toBeNull();
  });

  test("chamadas simultâneas fazem uma requisição só", async () => {
    apiRequest.mockResolvedValue({ versao: "abc", total: 1, estabelecimentos: [HOSPITAL] });

    await Promise.all([
      CatalogoLocal.obterEstabelecimentos({ agora: AGORA }),
      CatalogoLocal.obterEstabelecimentos({ agora: AGORA }),
    ]);

    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  test("cópia corrompida é ignorada e o catálogo é baixado de novo", async () => {
    await AsyncStorage.setItem(CHAVE, "{não é json");
    apiRequest.mockResolvedValue({ versao: "abc", total: 1, estabelecimentos: [HOSPITAL] });

    await expect(CatalogoLocal.obterEstabelecimentos({ agora: AGORA })).resolves.toEqual([HOSPITAL]);
  });

  test("falha ao gravar não impede de usar o catálogo baixado", async () => {
    AsyncStorage.setItem.mockRejectedValueOnce(new Error("disco cheio"));
    apiRequest.mockResolvedValue({ versao: "abc", total: 1, estabelecimentos: [HOSPITAL] });

    await expect(CatalogoLocal.obterEstabelecimentos({ agora: AGORA })).resolves.toEqual([HOSPITAL]);
  });

  test("sem opções, usa a idade do primeiro plano a partir de agora", async () => {
    await salvarCatalogoGuardado(Date.now() - 1000);

    await expect(CatalogoLocal.obterEstabelecimentos()).resolves.toEqual([HOSPITAL]);
    expect(apiRequest).not.toHaveBeenCalled();
  });

  test("um dia é a idade aceita com o app aberto: quem avisa a mudança é a versão", () => {
    expect(IDADE_MAXIMA_PRIMEIRO_PLANO_MS).toBe(24 * 60 * 60 * 1000);
  });

  describe("sincronizarVersao (versão da configuração remota)", () => {
    test("mesma versão não vai à rede e conta a cópia como conferida agora", async () => {
      await salvarCatalogoGuardado(AGORA - INTERVALO_MINIMO_GRAVACAO_MS, "v1");

      await expect(CatalogoLocal.sincronizarVersao("v1", { agora: AGORA })).resolves.toBe(false);

      expect(apiRequest).not.toHaveBeenCalled();
      expect(JSON.parse(await AsyncStorage.getItem(CHAVE)).conferidoEm).toBe(AGORA);
    });

    test("mesma versão conferida há pouco não regrava a cópia", async () => {
      await salvarCatalogoGuardado(AGORA - 1000, "v1");

      await expect(CatalogoLocal.sincronizarVersao("v1", { agora: AGORA })).resolves.toBe(false);

      expect(JSON.parse(await AsyncStorage.getItem(CHAVE)).conferidoEm).toBe(AGORA - 1000);
    });

    test("versão diferente baixa o catálogo e troca a cópia", async () => {
      const NOVO = { ...HOSPITAL, id: "h2" };
      await salvarCatalogoGuardado(AGORA - 1000, "v1");
      apiRequest.mockResolvedValue({ versao: "v2", total: 1, estabelecimentos: [NOVO] });

      await expect(CatalogoLocal.sincronizarVersao("v2", { agora: AGORA })).resolves.toBe(true);

      expect(apiRequest).toHaveBeenCalledWith("/api/v1/catalogo", { headers: { "If-None-Match": 'W/"v1"' } });
      expect(await CatalogoLocal.lerCopiaGuardada()).toEqual([NOVO]);
    });

    test("sem cópia guardada, baixa o catálogo", async () => {
      apiRequest.mockResolvedValue({ versao: "v1", total: 1, estabelecimentos: [HOSPITAL] });

      await expect(CatalogoLocal.sincronizarVersao("v1", { agora: AGORA })).resolves.toBe(true);
    });

    test("servidor ainda com a versão antiga (304) não troca nada", async () => {
      await salvarCatalogoGuardado(AGORA - 1000, "v1");
      apiRequest.mockRejectedValue(new ApiError("Não modificado", 304));

      await expect(CatalogoLocal.sincronizarVersao("v2", { agora: AGORA })).resolves.toBe(false);
      expect(await CatalogoLocal.lerCopiaGuardada()).toEqual([HOSPITAL]);
    });

    test("sem rede, mantém a cópia e não lança", async () => {
      await salvarCatalogoGuardado(AGORA - 1000, "v1");
      apiRequest.mockRejectedValue(new Error("sem rede"));

      await expect(CatalogoLocal.sincronizarVersao("v2", { agora: AGORA })).resolves.toBe(false);
      expect(await CatalogoLocal.lerCopiaGuardada()).toEqual([HOSPITAL]);
    });

    test("sem versão informada (servidor antigo ou banco fora), não faz nada", async () => {
      await expect(CatalogoLocal.sincronizarVersao(null)).resolves.toBe(false);
      await expect(CatalogoLocal.sincronizarVersao(undefined)).resolves.toBe(false);

      expect(apiRequest).not.toHaveBeenCalled();
    });

    test("sem opções, usa o instante atual", async () => {
      await salvarCatalogoGuardado(1, "v1");

      await expect(CatalogoLocal.sincronizarVersao("v1")).resolves.toBe(false);
      expect(JSON.parse(await AsyncStorage.getItem(CHAVE)).conferidoEm).toBeGreaterThan(1);
    });
  });

  describe("conferirSeVencida (lista aberta sem a versão da configuração)", () => {
    test("cópia dentro da idade não vai à rede", async () => {
      await salvarCatalogoGuardado(AGORA - 1000, "v1");

      await expect(CatalogoLocal.conferirSeVencida({ agora: AGORA })).resolves.toBe(false);

      expect(apiRequest).not.toHaveBeenCalled();
    });

    test("sem cópia não vai à rede: quem baixa é a própria lista", async () => {
      await expect(CatalogoLocal.conferirSeVencida({ agora: AGORA })).resolves.toBe(false);

      expect(apiRequest).not.toHaveBeenCalled();
    });

    test("cópia vencida e catálogo novo no servidor troca a cópia", async () => {
      const NOVO = { ...HOSPITAL, id: "h2" };
      await salvarCatalogoGuardado(AGORA - IDADE_MAXIMA_PRIMEIRO_PLANO_MS, "v1");
      apiRequest.mockResolvedValue({ versao: "v2", total: 1, estabelecimentos: [NOVO] });

      await expect(CatalogoLocal.conferirSeVencida({ agora: AGORA })).resolves.toBe(true);

      expect(await CatalogoLocal.lerCopiaGuardada()).toEqual([NOVO]);
    });

    test("cópia vencida e servidor com a mesma versão (304) não troca nada", async () => {
      await salvarCatalogoGuardado(AGORA - IDADE_MAXIMA_PRIMEIRO_PLANO_MS, "v1");
      apiRequest.mockRejectedValue(new ApiError("Não modificado", 304));

      await expect(CatalogoLocal.conferirSeVencida({ agora: AGORA })).resolves.toBe(false);

      expect(JSON.parse(await AsyncStorage.getItem(CHAVE)).conferidoEm).toBe(AGORA);
    });

    test("cópia vencida e sem rede não lança", async () => {
      await salvarCatalogoGuardado(1, "v1");
      apiRequest.mockRejectedValue(new Error("sem rede"));

      await expect(CatalogoLocal.conferirSeVencida()).resolves.toBe(false);
    });
  });

  test("limpar apaga a cópia", async () => {
    await salvarCatalogoGuardado(AGORA);

    await CatalogoLocal.limpar();

    expect(await AsyncStorage.getItem(CHAVE)).toBeNull();
  });
});
