package br.com.saude_monitor.api.user.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

/**
 * Conjunto de consentimentos do titular (LGPD) embutido no documento de usuário.
 *
 * <p>Espelha o campo {@code consentimentos} da coleção {@code usuarios} na
 * Especificação da API v2.0 (§2.2). Cada finalidade guarda aceite, data e versão.</p>
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConsentimentosDocument {

    /** Tratamento de localização (necessário ao geofencing). */
    private ConsentimentoItem localizacao;

    /** Envio de notificações (ex.: lembrete de feedback). */
    private ConsentimentoItem notificacoes;

    /** Aceite dos termos de uso / política de privacidade (obrigatório — LGPD). */
    private ConsentimentoItem termosUso;
}
