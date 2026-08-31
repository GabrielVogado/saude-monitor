package br.com.saude_monitor.api.user.service;

import br.com.saude_monitor.api.user.dto.UserRequest;
import br.com.saude_monitor.api.user.dto.UserResponse;

import java.util.Map;

public interface UserService {

    UserResponse saveUser(UserRequest request);

    /**
     * Exportação de dados pessoais LGPD (E5-03/art. 18): devolve o perfil, consentimentos,
     * visitas e feedbacks do titular em JSON, para exercício do direito de portabilidade.
     */
    Map<String, Object> exportarDados(String usuarioId);

    /**
     * Exclusão de conta LGPD (F0-05): apaga os dados pessoais identificáveis do usuário
     * (documento de usuário e registros de autenticação) e anonimiza os dados usados
     * nas estatísticas (visitas e feedbacks), preservando os agregados públicos.
     */
    void excluirConta(String usuarioId);
}
