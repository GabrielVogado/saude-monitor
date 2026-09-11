package br.com.saude_monitor.api.auth.verificacao;

/**
 * Para que serve um código de verificação de 6 dígitos — distingue os dois fluxos que
 * compartilham a mesma infraestrutura (upsert atômico, TTL, limite de tentativas).
 */
public enum Proposito {
    REDEFINIR_SENHA,
    CONFIRMAR_EMAIL
}
