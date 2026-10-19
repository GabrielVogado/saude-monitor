/**
 * Id da instalação do app, chave do rate limit sem login (ARQ-02).
 */
import ClienteId from "../../services/ClienteId";
import AsyncStorage from "@react-native-async-storage/async-storage";

describe("ClienteId", () => {
  beforeEach(() => {
    AsyncStorage.__reset();
  });

  test("gera e persiste um UUID na primeira chamada e o reutiliza depois", async () => {
    const primeiro = await ClienteId.obterSeDisponivel();

    expect(primeiro).toMatch(/^[0-9a-f-]{36}$/);
    expect(await AsyncStorage.getItem("@saude_monitor:clienteId")).toBe(primeiro);
    await expect(ClienteId.obterSeDisponivel()).resolves.toBe(primeiro);
  });

  test("chamadas simultâneas na primeira execução recebem o mesmo id", async () => {
    const [a, b] = await Promise.all([ClienteId.obterSeDisponivel(), ClienteId.obterSeDisponivel()]);

    expect(b).toBe(a);
  });

  test("é diferente do dispositivoId da visita anônima", async () => {
    await AsyncStorage.setItem("@saude_monitor:dispositivoId", "anon-123");

    await expect(ClienteId.obterSeDisponivel()).resolves.not.toBe("anon-123");
  });

  test("devolve undefined quando o armazenamento falha", async () => {
    AsyncStorage.getItem.mockRejectedValueOnce(new Error("disco cheio"));

    await expect(ClienteId.obterSeDisponivel()).resolves.toBeUndefined();
  });
});
