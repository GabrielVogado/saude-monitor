package br.com.saude_monitor.api.configuracao.repository;

import br.com.saude_monitor.api.configuracao.document.ConfiguracaoRemotaDocument;
import org.springframework.data.mongodb.repository.MongoRepository;

public interface ConfiguracaoRemotaRepository extends MongoRepository<ConfiguracaoRemotaDocument, String> {
}
