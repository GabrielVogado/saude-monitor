import {
  geracaoDaSessao,
  reiniciarControleDeRenovacao,
  renovarSessao,
} from "../../config/sessao";

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
