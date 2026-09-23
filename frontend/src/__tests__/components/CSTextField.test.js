/**
 * CSTextField — o campo de formulário do design system.
 *
 * Era o único componente abaixo de 90% (66,66% de statements). Ele concentra três
 * decisões visuais que nada verificava: a cor da borda por estado (erro > foco >
 * neutro), a precedência entre `error` e `helper` — só um dos dois é pintado — e o
 * rótulo acessível vindo do `label`.
 *
 * O que quebra sem isto: um campo em estado de erro que não pinta a borda vermelha,
 * ou que mostra a dica em vez da mensagem de erro, deixa o usuário sem saber o que
 * corrigir num formulário reprovado.
 */
import React from "react";
import { Text } from "react-native";
import { render, fireEvent, screen } from "@testing-library/react-native";
import CSTextField from "../../components/CSTextField";
import { colors } from "../../theme/tokens";

/**
 * Lê a cor de borda efetiva do container.
 *
 * A busca sobe pelos ancestrais em vez de assumir `campo.parent`: o TextInput do
 * react-native-web/RNTL fica envolto em nós intermediários, e fixar um nível
 * tornaria o teste refém da árvore interna da biblioteca em vez do componente.
 */
function bordaDoCampo(rotulo = "E-mail") {
  let no = screen.getByLabelText(rotulo).parent;
  while (no) {
    const estilos = [].concat(no.props?.style).flat(Infinity).filter(Boolean);
    const comBorda = estilos.filter((e) => e && e.borderColor !== undefined);
    if (comBorda.length) {
      const efetivo = comBorda[comBorda.length - 1];
      return { cor: efetivo.borderColor, espessura: efetivo.borderWidth };
    }
    no = no.parent;
  }
  return {};
}

/** Açúcar para os testes que só falam de cor. */
const corDaBorda = (rotulo) => bordaDoCampo(rotulo).cor;

/** Lê os estilos efetivos de um nó, achatados. */
function estilosDe(no) {
  return [].concat(no.props?.style).flat(Infinity).filter(Boolean);
}

describe("CSTextField", () => {
  test("o label vira rótulo acessível e é pintado em caixa alta", () => {
    render(<CSTextField label="E-mail" value="" onChangeText={jest.fn()} />);

    expect(screen.getByLabelText("E-mail")).toBeTruthy();
    expect(screen.getByText("E-MAIL")).toBeTruthy();
  });

  test("sem label, nenhum texto de rótulo é renderizado", () => {
    // A asserção precisa ser sobre a AUSÊNCIA do rótulo. Conferir só que o campo
    // existe não distingue `{label ? <Text/> : null}` de um `<Text>` incondicional:
    // com o rótulo vazando como "UNDEFINED" na tela, a versão anterior deste teste
    // continuava verde.
    render(<CSTextField value="" onChangeText={jest.fn()} placeholder="Busque" />);

    expect(screen.getByPlaceholderText("Busque")).toBeTruthy();
    // A asserção é sobre texto visível, não sobre o tipo do nó: interrogar
    // `UNSAFE_queryAllByType(Text)` prenderia o teste à árvore interna do RNTL. O
    // placeholder não é um nó de texto, então a tela deve estar literalmente sem
    // nenhum texto renderizado.
    expect(screen.queryAllByText(/./)).toHaveLength(0);
  });

  test("digitar propaga o texto ao chamador", () => {
    const onChangeText = jest.fn();
    render(<CSTextField label="E-mail" value="" onChangeText={onChangeText} />);

    const campo = screen.getByLabelText("E-mail");
    fireEvent.changeText(campo, "ana@exemplo.com");

    expect(onChangeText).toHaveBeenCalledWith("ana@exemplo.com");

    // A asserção acima é necessária mas NÃO é suficiente — mesmo motivo já
    // documentado no teste do botão da `LoginScreen`, só que no outro sentido: o
    // `fireEvent` do RNTL sobe a árvore e encontra o handler no próprio elemento
    // `<CSTextField onChangeText={...}>`, então o mock é chamado mesmo que o
    // componente nunca repasse a prop ao `TextInput`. Verificado por mutação:
    // removendo `onChangeText={onChangeText}` do `TextInput`, a asserção acima
    // continuava verde enquanto no aparelho o campo ficava mudo — digitar não
    // mudaria nada, e o formulário inteiro ficaria sem entrada. Por isso, e só por
    // isso, este teste desce até a prop do nó host: é o único ponto onde o defeito
    // é observável.
    expect(campo.props.onChangeText).toBe(onChangeText);
  });

  test("a borda fica neutra em repouso, primária no foco e volta ao perder o foco", () => {
    render(<CSTextField label="E-mail" value="" onChangeText={jest.fn()} />);
    expect(corDaBorda()).toBe("transparent");

    fireEvent(screen.getByLabelText("E-mail"), "focus");
    expect(corDaBorda()).toBe(colors.primary);

    fireEvent(screen.getByLabelText("E-mail"), "blur");
    expect(corDaBorda()).toBe("transparent");
  });

  test("erro tem precedência sobre o foco na cor da borda", () => {
    render(<CSTextField label="E-mail" value="" onChangeText={jest.fn()} error="Inválido" />);

    fireEvent(screen.getByLabelText("E-mail"), "focus");

    // Mesmo focado, a borda continua vermelha: o estado de erro vence.
    // A espessura entra na asserção porque cor sem espessura é borda invisível —
    // com `borderWidth: 0` o campo em erro não pinta nada, que é exatamente a falha
    // que este arquivo existe para impedir.
    expect(bordaDoCampo()).toEqual({ cor: colors.error, espessura: 2 });
  });

  test("com erro, a mensagem aparece e a dica NÃO — só um dos dois é pintado", () => {
    render(
      <CSTextField
        label="E-mail"
        value=""
        onChangeText={jest.fn()}
        helper="Use seu e-mail corporativo"
        error="E-mail inválido"
      />
    );

    const mensagem = screen.getByText("E-mail inválido");
    expect(mensagem).toBeTruthy();
    expect(screen.queryByText("Use seu e-mail corporativo")).toBeNull();

    // Presença não basta: pintada com o token de dica, a mensagem sai no cinza
    // `onSurfaceVariant` e o erro de validação passa a se ler como sugestão.
    expect(estilosDe(mensagem).map((e) => e.color)).toContain(colors.onErrorContainer);

    // Sem `accessibilityLiveRegion`, quem usa leitor de tela deixa de ouvir o erro.
    expect(mensagem.props.accessibilityLiveRegion).toBe("polite");
  });

  test("sem erro, a dica é exibida", () => {
    render(
      <CSTextField
        label="E-mail"
        value=""
        onChangeText={jest.fn()}
        helper="Use seu e-mail corporativo"
      />
    );

    expect(screen.getByText("Use seu e-mail corporativo")).toBeTruthy();
  });

  test("sem erro e sem dica, nenhuma linha de apoio é renderizada", () => {
    // Procurar por "E-mail inválido" não provava nada: sem a prop `error`, essa
    // string jamais apareceria, com ou sem o ramo `: null`. A asserção real é sobre
    // a contagem — o único texto da árvore deve ser o rótulo. Qualquer linha de
    // apoio vazando pelo terceiro ramo do ternário vira um segundo `<Text>`.
    render(<CSTextField label="E-mail" value="" onChangeText={jest.fn()} />);

    // O único texto visível deve ser o rótulo. Qualquer linha de apoio vazando pelo
    // terceiro ramo do ternário aparece aqui como um segundo texto.
    expect(screen.queryAllByText(/./).map((no) => no.props.children)).toEqual(["E-MAIL"]);
  });

  test("ícone e elemento à direita são renderizados quando fornecidos", () => {
    const Icone = () => <Text>icone</Text>;
    render(
      <CSTextField
        label="E-mail"
        value=""
        onChangeText={jest.fn()}
        icon={Icone}
        trailing={<Text>limpar</Text>}
      />
    );

    expect(screen.getByText("icone")).toBeTruthy();
    expect(screen.getByText("limpar")).toBeTruthy();
  });

  test("modo senha e multilinha chegam ao TextInput", () => {
    const { rerender } = render(
      <CSTextField label="Senha" value="" onChangeText={jest.fn()} secureTextEntry />
    );
    expect(screen.getByLabelText("Senha").props.secureTextEntry).toBe(true);

    rerender(<CSTextField label="Senha" value="" onChangeText={jest.fn()} multiline />);
    const campo = screen.getByLabelText("Senha");
    expect(campo.props.multiline).toBe(true);

    // `multiline` na prop sem os estilos correspondentes é multilinha só no nome: o
    // container continua centralizando e o input fica sem `minHeight`, então um
    // endereço de duas linhas desaba numa linha só, centralizada.
    expect(estilosDe(campo).map((e) => e.minHeight)).toContain(96);
    const container = campo.parent;
    expect(
      estilosDe(container).concat(estilosDe(container.parent)).map((e) => e.alignItems)
    ).toContain("flex-start");
  });

  test("o padrão de autoCapitalize é `none` — e-mail não pode virar caixa alta", () => {
    // O default fica na assinatura do componente (`autoCapitalize = "none"`) e nada
    // o exercitava. Trocado para "sentences", o campo de e-mail passa a enviar
    // "Ana@exemplo.com" e o login falha contra backend sensível a caixa.
    render(<CSTextField label="E-mail" value="" onChangeText={jest.fn()} />);

    expect(screen.getByLabelText("E-mail").props.autoCapitalize).toBe("none");
  });
});
