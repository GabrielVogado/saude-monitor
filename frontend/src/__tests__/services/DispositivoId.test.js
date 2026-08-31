/**
 * Identificação anônima de dispositivo (modo sem login — §3.3).
 * Garante que o id é gerado uma única vez e reutilizado entre chamadas.
 */
process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";

import DispositivoId from "../../services/DispositivoId";
import AsyncStorage from "@react-native-async-storage/async-storage";

describe("DispositivoId (modo anônimo)", () => {
  beforeEach(async () => {
    AsyncStorage.__reset();
  });

  test("gera e persiste um id anônimo na primeira chamada", async () => {
    const id = await DispositivoId.obter();

    expect(id).toBeTruthy();
    expect(id.startsWith("anon-")).toBe(true);

    const persistido = await AsyncStorage.getItem("@saude_monitor:dispositivoId");
    expect(persistido).toBe(id);
  });

  test("reutiliza o mesmo id nas chamadas seguintes", async () => {
    const primeiro = await DispositivoId.obter();
    const segundo = await DispositivoId.obter();

    expect(segundo).toBe(primeiro);
  });
});