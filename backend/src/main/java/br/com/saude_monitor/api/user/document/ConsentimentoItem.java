package br.com.saude_monitor.api.user.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

/**
 * Registro de um consentimento individual (LGPD), com aceite, data e versão dos termos.
 *
 * <p>Usado dentro de {@link ConsentimentosDocument} para rastrear a base legal de
 * tratamento de dados pessoais (localização, notificações, termos de uso).</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsentimentoItem {

    /** Indica se o titular aceitou o tratamento para esta finalidade. */
    private boolean aceito;

    /** Momento (UTC) em que o consentimento foi concedido ou revogado. */
    private Instant data;

    /** Versão do termo/aviso de privacidade aceito (ex.: "1.0"). */
    private String versao;
}
