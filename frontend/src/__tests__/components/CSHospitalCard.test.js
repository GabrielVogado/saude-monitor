/**
 * Contrato do CSHospitalCard — o componente que carrega o check-in manual hoje.
 *
 * Existe por duas razões concretas:
 *
 * 1. O ARQ-05 mudou o contrato dos callbacks: `onPress` e `onCheckin` passaram a
 *    receber o próprio `hospital` de volta, para que a tela possa passar uma função
 *    memoizada em vez de criar uma arrow por item. Nada cobria essa mudança — se
 *    alguém reverter para `onPress()` sem argumento, a HospitaisScreen navega para
 *    `undefined.id` e o app quebra no toque.
 *
 * 2. Este card é o ÚNICO caminho de check-in manual do app. A tela dedicada
 *    (`CheckinManualScreen`) ficou órfã na revisão de navegação e foi removida; a
 *    funcionalidade permanece, aqui. Sem teste de componente, a remoção da tela
 *    órfã não teria rede embaixo.
 */
import React from "react";
import { render, fireEvent, screen } from "@testing-library/react-native";
import CSHospitalCard from "../../components/CSHospitalCard";

const hospital = {
  id: "h1",
  nome: "Hospital de Base",
  tipo: "PUBLICO",
  categoria: "HOSPITAL",
  indicadores: { notaMedia: 4.2, nAvaliacoes: 12, tempoMedianoMinutos: 45 },
};

describe("CSHospitalCard", () => {
  test("devolve o hospital ao chamador no toque do corpo do card (contrato do ARQ-05)", () => {
    const onPress = jest.fn();
    render(<CSHospitalCard hospital={hospital} onPress={onPress} />);

    fireEvent.press(screen.getByLabelText("Hospital de Base, Hospital"));

    expect(onPress).toHaveBeenCalledWith(hospital);
  });

  test("devolve o hospital ao chamador no toque do botão de check-in", () => {
    const onCheckin = jest.fn();
    render(<CSHospitalCard hospital={hospital} onCheckin={onCheckin} />);

    fireEvent.press(screen.getByLabelText("Fazer check-in em Hospital de Base"));

    expect(onCheckin).toHaveBeenCalledWith(hospital);
  });

  test("sem onCheckin, o botão de check-in não é renderizado", () => {
    render(<CSHospitalCard hospital={hospital} onPress={jest.fn()} />);

    expect(screen.queryByLabelText("Fazer check-in em Hospital de Base")).toBeNull();
  });

  test("com visita ativa neste hospital, o botão vira 'ver' e muda o rótulo acessível", () => {
    const onCheckin = jest.fn();
    render(<CSHospitalCard hospital={hospital} onCheckin={onCheckin} checkinAtivo />);

    expect(screen.getByText("Em visita — ver")).toBeTruthy();
    expect(screen.getByLabelText("Hospital de Base — ver check-in ativo")).toBeTruthy();
  });

  test("durante o envio, o botão mostra 'Enviando...' e não dispara de novo", () => {
    const onCheckin = jest.fn();
    render(<CSHospitalCard hospital={hospital} onCheckin={onCheckin} checkinLoading />);

    expect(screen.getByText("Enviando...")).toBeTruthy();
    fireEvent.press(screen.getByLabelText("Fazer check-in em Hospital de Base"));
    expect(onCheckin).not.toHaveBeenCalled();
  });

  test("com check-in ativo em OUTRO hospital, o botão fica desabilitado", () => {
    const onCheckin = jest.fn();
    render(<CSHospitalCard hospital={hospital} onCheckin={onCheckin} checkinDesabilitado />);

    fireEvent.press(screen.getByLabelText("Fazer check-in em Hospital de Base"));
    expect(onCheckin).not.toHaveBeenCalled();
  });
});
