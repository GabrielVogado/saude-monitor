/**
 * Identificação anônima de dispositivo (modo sem login — §3.3).
 * Garante que o id é gerado uma única vez e reutilizado entre chamadas.
 */
import DispositivoId from "../../services/DispositivoId";
import AsyncStorage from "@react-native-async-storage/async-storage";

process.env.EXPO_PUBLIC_API_BASE_URL = "https://api.test";

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

  test("o id novo é um UUID v4 aleatório com o prefixo anon-", async () => {
    const id = await DispositivoId.obter();

    expect(id).toMatch(/^anon-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  test("não usa Math.random (gerador previsível) para gerar o id (S2245)", async () => {
    const random = jest.spyOn(Math, "random");
    try {
      await DispositivoId.obter();
      expect(random).not.toHaveBeenCalled();
    } finally {
      random.mockRestore();
    }
  });

  test("aparelhos diferentes (armazenamento vazio) recebem ids diferentes", async () => {
    const primeiro = await DispositivoId.obter();
    AsyncStorage.__reset();
    const segundo = await DispositivoId.obter();

    expect(segundo).not.toBe(primeiro);
  });
});