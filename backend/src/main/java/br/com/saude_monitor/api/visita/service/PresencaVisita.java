package br.com.saude_monitor.api.visita.service;

import br.com.saude_monitor.api.visita.document.OrigemVisita;
import br.com.saude_monitor.api.visita.document.VisitaDocument;

import java.time.Duration;
import java.time.Instant;

/**
 * Prova de presença da visita (SEG-01): diz se a visita, e o feedback ligado a ela, podem
 * entrar no indicador público.
 *
 * <p>Qualquer pessoa continua podendo registrar visita e avaliar (RN-20). O que muda é o
 * que conta: só a visita cujo check-in trouxe uma posição dentro do geofence do hospital,
 * recebida pelo servidor perto do momento da entrada. O check-in {@code MANUAL} sem posição
 * e o check-in retroativo, que eram o caminho barato para fabricar avaliação e tempo de
 * permanência, ficam de fora.</p>
 */
public final class PresencaVisita {

    /**
     * Maior atraso aceito entre a entrada informada e o recebimento do check-in. É a mesma
     * janela em que uma visita sem sinal é encerrada como GPS interrompido (RN-06): além dela,
     * o servidor não tem nenhum sinal que sustente a parte retroativa da permanência.
     */
    public static final Duration ATRASO_MAXIMO = Duration.ofMinutes(45);

    private PresencaVisita() {
    }

    /**
     * Regra aplicada no check-in.
     *
     * @param posicaoNoHospital a posição enviada no check-in está dentro do geofence do hospital
     * @param entrada           momento da entrada (pode ser retroativo, fila offline)
     * @param recebidoEm        momento em que o servidor recebeu o check-in
     */
    public static boolean noCheckin(boolean posicaoNoHospital, Instant entrada, Instant recebidoEm) {
        return posicaoNoHospital && dentroDoAtraso(entrada, recebidoEm);
    }

    /**
     * Visita que pode entrar no indicador público. A visita anterior a esta regra não tem a
     * marcação gravada; para ela vale o que os campos guardados permitem conferir: o check-in
     * pelo geofence sempre validou a posição, e {@code criadoEm} mostra o atraso.
     */
    public static boolean comprovada(VisitaDocument visita) {
        if (visita.getPresencaComprovada() != null) {
            return visita.getPresencaComprovada();
        }
        return visita.getOrigem() == OrigemVisita.GEOFENCE
                && dentroDoAtraso(visita.getEntrada(), visita.getCriadoEm());
    }

    private static boolean dentroDoAtraso(Instant entrada, Instant recebidoEm) {
        return entrada != null && recebidoEm != null
                && Duration.between(entrada, recebidoEm).compareTo(ATRASO_MAXIMO) <= 0;
    }
}
