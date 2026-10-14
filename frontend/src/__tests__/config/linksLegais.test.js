/**
 * Links dos textos legais publicados em saudemonitor.dev (exigência da Play Store).
 */
import { Linking } from "react-native";
import {
  abrirLinkLegal,
  URL_EXCLUSAO_CONTA,
  URL_POLITICA_PRIVACIDADE,
  URL_TERMOS_USO,
} from "../../config/linksLegais";

describe("linksLegais", () => {
  afterEach(() => jest.restoreAllMocks());

  test("os endereços apontam para as páginas publicadas em HTTPS", () => {
    expect(URL_POLITICA_PRIVACIDADE).toBe("https://saudemonitor.dev/privacidade");
    expect(URL_TERMOS_USO).toBe("https://saudemonitor.dev/termos");
    expect(URL_EXCLUSAO_CONTA).toBe("https://saudemonitor.dev/exclusao-de-conta");
  });

  test("abrirLinkLegal abre o endereço no navegador", async () => {
    jest.spyOn(Linking, "openURL").mockResolvedValue(true);

    await abrirLinkLegal(URL_TERMOS_USO);

    expect(Linking.openURL).toHaveBeenCalledWith(URL_TERMOS_USO);
  });

  test("abrirLinkLegal não rejeita quando não há app para abrir o link", async () => {
    jest.spyOn(Linking, "openURL").mockRejectedValue(new Error("sem navegador"));

    await expect(abrirLinkLegal(URL_TERMOS_USO)).resolves.toBe(false);
  });
});
