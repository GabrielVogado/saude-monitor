package br.com.saude_monitor.api.user.service;

import br.com.saude_monitor.api.user.dto.UserRequest;
import br.com.saude_monitor.api.user.dto.UserResponse;

public interface UserService {

    UserResponse saveUser(UserRequest request);

    /**
     * Exclusão de conta LGPD (F0-05): apaga os dados pessoais identificáveis do usuário
     * (documento de usuário e registros de autenticação) e anonimiza os dados usados
     * nas estatísticas (visitas e feedbacks), preservando os agregados públicos.
     */
    void excluirConta(String usuarioId);
}
