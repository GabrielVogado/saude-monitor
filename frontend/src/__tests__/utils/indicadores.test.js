import { avaliacaoSuficiente } from "../../utils/indicadores";

describe("avaliacaoSuficiente (RN-15)", () => {
  test("verdadeiro com nota, 5+ avaliações e indicadoresDisponiveis !== false", () => {
    expect(avaliacaoSuficiente({ notaMedia: 4.2, nAvaliacoes: 5 })).toBe(true);
    expect(
      avaliacaoSuficiente({ notaMedia: 4.2, nAvaliacoes: 10, indicadoresDisponiveis: true })
    ).toBe(true);
  });

  test("falso com menos de 5 avaliações, mesmo com nota presente", () => {
    // Caso limítrofe do PR #94/#95: nota real mas amostra pequena não deve aparecer.
    expect(avaliacaoSuficiente({ notaMedia: 4.2, nAvaliacoes: 3 })).toBe(false);
  });

  test("falso quando indicadoresDisponiveis === false, mesmo com nota/contagem presentes", () => {
    expect(
      avaliacaoSuficiente({ notaMedia: 4.2, nAvaliacoes: 10, indicadoresDisponiveis: false })
    ).toBe(false);
  });

  test("falso sem notaMedia", () => {
    expect(avaliacaoSuficiente({ notaMedia: null, nAvaliacoes: 10 })).toBe(false);
    expect(avaliacaoSuficiente({ nAvaliacoes: 10 })).toBe(false);
  });

  test("falso com indicadores ausente/undefined", () => {
    expect(avaliacaoSuficiente(undefined)).toBe(false);
    expect(avaliacaoSuficiente(null)).toBe(false);
  });
});
