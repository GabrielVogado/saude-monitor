/**
 * Perfil → Dados e Privacidade (Épico 05).
 *
 * Verifica o gerenciamento da sessão (usuário logado / deslogar) e o controle da
 * permissão de localização (consultar/solicitar). Alinhado aos critérios de aceite
 * de E5-01 (permissão consultável/revogável) e E5-04 (conta opcional).
 */
import * as Location from "expo-location";
import AsyncStorage from "@react-native-async-storage/async-storage";
import PerfilService from "../../../screens/perfil/service/PerfilService";

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
