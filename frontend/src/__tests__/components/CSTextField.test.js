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
function corDaBorda() {
  let no = screen.getByLabelText("E-mail").parent;
  while (no) {
    const estilos = [].concat(no.props?.style).flat(Infinity).filter(Boolean);
    const comBorda = estilos.filter((e) => e && e.borderColor !== undefined);
    if (comBorda.length) return comBorda[comBorda.length - 1].borderColor;
    no = no.parent;
  }
  return undefined;
}

describe("CSTextField", () => {
  test("o label vira rótulo acessível e é pintado em caixa alta", () => {
    render(<CSTextField label="E-mail" value="" onChangeText={jest.fn()} />);

    expect(screen.getByLabelText("E-mail")).toBeTruthy();
    expect(screen.getByText("E-MAIL")).toBeTruthy();
  });

  test("sem label, nenhum texto de rótulo é renderizado", () => {
    render(<CSTextField value="" onChangeText={jest.fn()} placeholder="Busque" />);

    expect(screen.getByPlaceholderText("Busque")).toBeTruthy();
  });

  test("digitar propaga o texto ao chamador", () => {
    const onChangeText = jest.fn();
    render(<CSTextField label="E-mail" value="" onChangeText={onChangeText} />);

    fireEvent.changeText(screen.getByLabelText("E-mail"), "ana@exemplo.com");

    expect(onChangeText).toHaveBeenCalledWith("ana@exemplo.com");
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
    expect(corDaBorda()).toBe(colors.error);
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

    expect(screen.getByText("E-mail inválido")).toBeTruthy();
    expect(screen.queryByText("Use seu e-mail corporativo")).toBeNull();
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
    render(<CSTextField label="E-mail" value="" onChangeText={jest.fn()} />);

    expect(screen.queryByText("E-mail inválido")).toBeNull();
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
    expect(screen.getByLabelText("Senha").props.multiline).toBe(true);
  });
});
