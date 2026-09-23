import {
  deveEncerrarSessao,
  geracaoDaSessao,
  reiniciarControleDeRenovacao,
  renovarSessao,
} from "../../config/sessao";
import {
  ErroDeTimeout,
  ErroSemInternet,
  ErroServidorIndisponivel,
} from "../../config/http";

/** Promessa controlada, para segurar a renovação enquanto outra chamada chega. */
const promessaSuspensa = () => {
  let resolver;
  let rejeitar;
  const promessa = new Promise((res, rej) => {
    resolver = res;
    rejeitar = rej;
  });

  return { promessa, resolver, rejeitar };
};

describe("ARQ-01 — renovação de sessão concorrente", () => {
  beforeEach(() => {
    reiniciarControleDeRenovacao();
  });

  it("duas requisições que tomam 401 juntas renovam a sessão uma única vez", async () => {
    const { promessa, resolver } = promessaSuspensa();
    const renovacao = jest.fn(() => promessa);
    const geracao = geracaoDaSessao();

    const primeira = renovarSessao(renovacao, geracao);
    const segunda = renovarSessao(renovacao, geracao);

    resolver({ accessToken: "novo" });
    await Promise.all([primeira, segunda]);

    // É o cerne do defeito: o backend rotaciona e revoga o refresh token, então
    // a segunda chamada falharia e derrubaria a sessão do usuário.
    expect(renovacao).toHaveBeenCalledTimes(1);
  });

  it("as duas requisições recebem o mesmo resultado da renovação", async () => {
    const renovacao = jest.fn(async () => ({ accessToken: "novo" }));
    const geracao = geracaoDaSessao();

    const [primeira, segunda] = await Promise.all([
      renovarSessao(renovacao, geracao),
      renovarSessao(renovacao, geracao),
    ]);

    expect(primeira).toEqual({ accessToken: "novo" });
    expect(segunda).toEqual({ accessToken: "novo" });
  });

  it("dispensa a renovação quando a sessão já foi renovada depois da requisição", async () => {
    const renovacao = jest.fn(async () => ({ accessToken: "novo" }));
    const geracaoAntiga = geracaoDaSessao();

    await renovarSessao(renovacao, geracaoAntiga);
    const resultado = await renovarSessao(renovacao, geracaoAntiga);

    expect(resultado).toBeNull();
    expect(renovacao).toHaveBeenCalledTimes(1);
  });

  it("renova de novo quando o 401 vem de um token já da geração corrente", async () => {
    const renovacao = jest.fn(async () => ({ accessToken: "novo" }));

    await renovarSessao(renovacao, geracaoDaSessao());
    await renovarSessao(renovacao, geracaoDaSessao());

    expect(renovacao).toHaveBeenCalledTimes(2);
  });

  it("avança a geração a cada renovação bem-sucedida", async () => {
    const antes = geracaoDaSessao();

    await renovarSessao(async () => ({ accessToken: "novo" }), antes);

    expect(geracaoDaSessao()).toBe(antes + 1);
  });

  it("não avança a geração quando a renovação falha", async () => {
    const antes = geracaoDaSessao();

    await expect(
      renovarSessao(async () => {
        throw new Error("refresh token revogado");
      }, antes)
    ).rejects.toThrow("refresh token revogado");

    expect(geracaoDaSessao()).toBe(antes);
  });

  it("propaga a falha da renovação para todas as requisições que aguardavam", async () => {
    const { promessa, rejeitar } = promessaSuspensa();
    const renovacao = jest.fn(() => promessa);
    const geracao = geracaoDaSessao();

    const primeira = renovarSessao(renovacao, geracao);
    const segunda = renovarSessao(renovacao, geracao);

    rejeitar(new Error("sessão expirada"));

    await expect(primeira).rejects.toThrow("sessão expirada");
    await expect(segunda).rejects.toThrow("sessão expirada");
    expect(renovacao).toHaveBeenCalledTimes(1);
  });

  it("libera o controle após uma falha, permitindo nova tentativa", async () => {
    const renovacao = jest
      .fn()
      .mockRejectedValueOnce(new Error("indisponível"))
      .mockResolvedValueOnce({ accessToken: "novo" });

    await expect(renovarSessao(renovacao, geracaoDaSessao())).rejects.toThrow(
      "indisponível"
    );
    await expect(renovarSessao(renovacao, geracaoDaSessao())).resolves.toEqual({
      accessToken: "novo",
    });
  });

  it("renova sem geração observada, para chamadas que não acompanham a sessão", async () => {
    const renovacao = jest.fn(async () => ({ accessToken: "novo" }));

    await renovarSessao(renovacao);

    expect(renovacao).toHaveBeenCalledTimes(1);
  });
});

describe("deveEncerrarSessao — achado de 10/09/2026", () => {
  // Antes desta correção, os 5 pontos que chamam renovarSessao/LoginService.refresh
  // tratavam QUALQUER falha (erro de rede, timeout, 503 de cold start) como sessão
  // morta e deslogavam o usuário — mesmo com o refresh token (30 dias) ainda válido.

  it("falha de conexão (sem internet) não encerra a sessão", () => {
    expect(deveEncerrarSessao(new ErroSemInternet("http://x"))).toBe(false);
  });

  it("timeout não encerra a sessão", () => {
    expect(deveEncerrarSessao(new ErroDeTimeout("http://x", 20000))).toBe(false);
  });

  it("servidor indisponível (cold start) não encerra a sessão", () => {
    expect(deveEncerrarSessao(new ErroServidorIndisponivel("http://x"))).toBe(false);
  });

  it("401 do endpoint de refresh — o servidor rejeitou o token — encerra a sessão", () => {
    const erro = new Error("token inválido");
    erro.status = 401;
    expect(deveEncerrarSessao(erro)).toBe(true);
  });

  it("403 do endpoint de refresh encerra a sessão", () => {
    const erro = new Error("proibido");
    erro.status = 403;
    expect(deveEncerrarSessao(erro)).toBe(true);
  });

  it("outro status HTTP (ex.: 500) não é uma rejeição explícita do token — não encerra a sessão", () => {
    const erro = new Error("erro interno");
    erro.status = 500;
    expect(deveEncerrarSessao(erro)).toBe(false);
  });

  it("erro sem status e sem ser de conexão (ex.: sem refresh token local) encerra a sessão por segurança", () => {
    expect(deveEncerrarSessao(new Error("Sessão expirada. Faça login novamente."))).toBe(true);
  });
});
