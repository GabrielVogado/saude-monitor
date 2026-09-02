/**
 * Perfil → Dados e Privacidade (Épico 05).
 *
 * Verifica o gerenciamento da sessão (usuário logado / deslogar), o controle da
 * permissão de localização (consultar/solicitar), a exportação dos dados pessoais
 * em PDF e a auditoria dos consentimentos. Alinhado aos critérios de aceite de
 * E5-01 (permissão consultável/revogável), E5-03 (exportação, art. 18 da LGPD),
 * E5-04 (conta opcional) e E5-05 (revogação registrada, art. 8º §5º da LGPD).
 */
import * as Location from "expo-location";
import { File } from "expo-file-system";
import * as Sharing from "expo-sharing";
import AsyncStorage from "@react-native-async-storage/async-storage";
import TokenStorage from "../../../services/TokenStorage";
import PerfilService from "../../../screens/perfil/service/PerfilService";
import LoginService from "../../../screens/auth/service/LoginService";

jest.mock("../../../screens/auth/service/LoginService");

/** Resposta HTTP mínima no formato consumido pelo `request()` do serviço. */
function respostaJson(status, corpo) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(corpo),
  };
}

/**
 * A sessão é montada pelo `TokenStorage`, e não escrevendo direto no
 * AsyncStorage: desde o ARQ-02 os tokens vivem no `expo-secure-store` no nativo.
 */
async function darSessao(accessToken, refreshToken) {
  await TokenStorage.salvarTokens({ accessToken, refreshToken });
}

const USUARIO_KEY = "@saude_monitor:usuario";
const ACCESS_TOKEN_KEY = "@saude_monitor:accessToken";
const REFRESH_TOKEN_KEY = "@saude_monitor:refreshToken";

describe("PerfilService (Épico 05)", () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.__reset();
  });

  test("usuarioLogado retorna null sem sessão", async () => {
    const u = await PerfilService.usuarioLogado();
    expect(u).toBeNull();
  });

  test("usuarioLogado retorna o usuário persistido", async () => {
    await AsyncStorage.setItem(USUARIO_KEY, JSON.stringify({ nome: "Ana", email: "ana@x.com" }));
    const u = await PerfilService.usuarioLogado();
    expect(u.nome).toBe("Ana");
  });

  test("permissaoLocalizacao consulta expo-location e retorna status", async () => {
    Location.getForegroundPermissionsAsync.mockResolvedValue({ status: "granted" });
    const status = await PerfilService.permissaoLocalizacao();
    expect(Location.getForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(status).toBe("granted");
  });

  test("solicitarPermissaoLocalizacao retorna o status da permissão", async () => {
    Location.requestForegroundPermissionsAsync.mockResolvedValue({ status: "denied" });
    const status = await PerfilService.solicitarPermissaoLocalizacao();
    expect(Location.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
    expect(status).toBe("denied");
  });

  describe("exportarDadosPdf (E5-03 / art. 18 LGPD)", () => {
    test("exige sessão ativa", async () => {
      await expect(PerfilService.exportarDadosPdf()).rejects.toThrow(
        "Faça login para exportar seus dados."
      );
      expect(File.downloadFileAsync).not.toHaveBeenCalled();
    });

    test("baixa o PDF com o token e abre o compartilhamento", async () => {
      await darSessao("token-123", "refresh-1");

      const resultado = await PerfilService.exportarDadosPdf();

      const [url, , opcoes] = File.downloadFileAsync.mock.calls[0];
      expect(url).toContain("/api/v1/contas/export/pdf");
      expect(opcoes.headers.Authorization).toBe("Bearer token-123");
      expect(resultado.nomeArquivo).toMatch(/^meus-dados-\d{4}-\d{2}-\d{2}\.pdf$/);
      expect(resultado.compartilhado).toBe(true);
      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        resultado.uri,
        expect.objectContaining({ mimeType: "application/pdf" })
      );
    });

    test("mantém o arquivo salvo quando o dispositivo não compartilha", async () => {
      await darSessao("token-123", "refresh-1");
      Sharing.isAvailableAsync.mockResolvedValueOnce(false);

      const resultado = await PerfilService.exportarDadosPdf();

      expect(resultado.compartilhado).toBe(false);
      expect(resultado.uri).toContain(resultado.nomeArquivo);
      expect(Sharing.shareAsync).not.toHaveBeenCalled();
    });

    test("renova o token e repete o download quando o backend responde 401", async () => {
      await darSessao("token-velho", "refresh-1");
      File.downloadFileAsync.mockRejectedValueOnce(new Error("response has status: 401"));
      LoginService.refresh.mockImplementation(async () => {
        await darSessao("token-novo", "refresh-2");
      });

      await PerfilService.exportarDadosPdf();

      expect(File.downloadFileAsync).toHaveBeenCalledTimes(2);
      expect(File.downloadFileAsync.mock.calls[1][2].headers.Authorization).toBe(
        "Bearer token-novo"
      );
    });

    test("encerra a sessão quando a renovação do token falha", async () => {
      await darSessao("token-velho", "refresh-1");
      File.downloadFileAsync.mockRejectedValueOnce(new Error("response has status: 401"));
      LoginService.refresh.mockRejectedValue(new Error("refresh inválido"));

      await expect(PerfilService.exportarDadosPdf()).rejects.toThrow(
        "Sessão expirada. Faça login novamente."
      );
      expect(LoginService.logout).toHaveBeenCalledTimes(1);
    });

    test("propaga falhas de geração do relatório", async () => {
      await darSessao("token-123", "refresh-1");
      File.downloadFileAsync.mockRejectedValueOnce(new Error("response has status: 500"));

      await expect(PerfilService.exportarDadosPdf()).rejects.toThrow(
        "response has status: 500"
      );
      expect(Sharing.shareAsync).not.toHaveBeenCalled();
    });
  });

  describe("atualizarConsentimento (E5-05 / art. 8º §5º LGPD)", () => {
    test("não chama a API quando não há sessão (conta é opcional)", async () => {
      global.fetch = jest.fn();

      const resultado = await PerfilService.atualizarConsentimento({ localizacao: false });

      expect(resultado).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("registra a revogação da localização com a versão dos termos", async () => {
      await darSessao("token-123", "refresh-1");
      global.fetch = jest.fn(async () =>
        respostaJson(200, { localizacao: { aceito: false, versao: "1.0" } })
      );

      const resposta = await PerfilService.atualizarConsentimento({ localizacao: false });

      const [url, config] = global.fetch.mock.calls[0];
      expect(url).toContain("/api/v1/contas/consentimentos");
      expect(config.method).toBe("PUT");
      expect(config.headers.Authorization).toBe("Bearer token-123");
      expect(JSON.parse(config.body)).toEqual({ versaoTermos: "1.0", localizacao: false });
      expect(resposta.localizacao.aceito).toBe(false);
    });

    test("envia apenas as finalidades informadas", async () => {
      await darSessao("token-123", "refresh-1");
      global.fetch = jest.fn(async () => respostaJson(200, {}));

      await PerfilService.atualizarConsentimento({ notificacoes: true });

      expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
        versaoTermos: "1.0",
        notificacoes: true,
      });
    });

    test("ignora chamadas sem nenhuma finalidade booleana", async () => {
      await darSessao("token-123", "refresh-1");
      global.fetch = jest.fn();

      expect(await PerfilService.atualizarConsentimento({})).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    test("renova o token e repete a chamada após 401", async () => {
      await darSessao("token-velho", "refresh-1");
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce(respostaJson(401, { message: "expirado" }))
        .mockResolvedValueOnce(respostaJson(200, { localizacao: { aceito: true } }));
      LoginService.refresh.mockImplementation(async () => {
        await darSessao("token-novo", "refresh-2");
      });

      await PerfilService.atualizarConsentimento({ localizacao: true });

      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(global.fetch.mock.calls[1][1].headers.Authorization).toBe("Bearer token-novo");
    });

    test("propaga a mensagem de erro do backend", async () => {
      await darSessao("token-123", "refresh-1");
      global.fetch = jest.fn(async () =>
        respostaJson(400, { message: "Informe ao menos uma finalidade." })
      );

      await expect(
        PerfilService.atualizarConsentimento({ localizacao: false })
      ).rejects.toThrow("Informe ao menos uma finalidade.");
    });
  });

  test("deslogar limpa tokens e usuário persistidos", async () => {
    await AsyncStorage.multiSet([
      [ACCESS_TOKEN_KEY, "abc"],
      [REFRESH_TOKEN_KEY, "def"],
      [USUARIO_KEY, JSON.stringify({ nome: "Ana" })],
    ]);
    await PerfilService.deslogar();
    expect(await AsyncStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull();
    expect(await AsyncStorage.getItem(USUARIO_KEY)).toBeNull();
  });
});
