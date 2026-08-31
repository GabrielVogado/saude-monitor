package br.com.saude_monitor.api.auth.revogacao;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

/**
 * Acesso à blacklist de refresh tokens revogados (F0-02 / §3.1).
 *
 * <p>O {@code id} do documento é o {@code jti} do token — a consulta de revogação é um
 * {@code existsById} direto. A coleção é purgada por TTL quando o token expira.</p>
 */
@Repository
public interface RefreshTokenRevogadoRepository
        extends MongoRepository<RefreshTokenRevogadoDocument, String> {
}