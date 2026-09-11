package br.com.saude_monitor.api.auth.verificacao;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

/** Acesso ao código de verificação ativo por e-mail e propósito. */
@Repository
public interface CodigoVerificacaoRepository
        extends MongoRepository<CodigoVerificacaoDocument, String> {

    Optional<CodigoVerificacaoDocument> findByEmailAndProposito(String email, Proposito proposito);

    void deleteByEmailAndProposito(String email, Proposito proposito);
}
