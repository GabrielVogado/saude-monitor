package br.com.saude_monitor.api.auth.email;

/**
 * Envio de e-mails transacionais de autenticação. Interface separada da implementação
 * concreta (Resend) para permitir teste do fluxo de "esqueci a senha" sem chamada HTTP real.
 */
public interface EmailService {

    /**
     * Envia o código de 6 dígitos para redefinição de senha.
     *
     * <p>Implementações não devem lançar exceção por falha de envio (rede, provedor fora) —
     * apenas registrar o problema. O fluxo de "esqueci a senha" sempre devolve a mesma
     * resposta genérica ao cliente, exista ou não o e-mail, e uma falha de envio não pode
     * virar um sinal diferente para quem está tentando descobrir e-mails cadastrados.</p>
     */
    void enviarCodigoRedefinicaoSenha(String destinatario, String codigo);
}
