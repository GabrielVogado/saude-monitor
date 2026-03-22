package br.com.saude_monitor.api.auth.service;

import br.com.saude_monitor.api.auth.dto.LoginRequest;
import br.com.saude_monitor.api.auth.dto.LoginResponse;
import jakarta.validation.Valid;

public interface AuthService {
    LoginResponse saveLogin(@Valid LoginRequest request);
}
