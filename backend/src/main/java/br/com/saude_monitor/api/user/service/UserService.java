package br.com.saude_monitor.api.user.service;

import br.com.saude_monitor.api.user.dto.UserRequest;
import br.com.saude_monitor.api.user.dto.UserResponse;

public interface UserService {

    UserResponse saveUser(UserRequest request);
}
