package br.com.saude_monitor.api.hospital.migration;

import br.com.saude_monitor.api.hospital.document.ContatoDocument;
import br.com.saude_monitor.api.hospital.document.EnderecoDocument;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.mongodb.core.geo.GeoJsonPolygon;
import org.springframework.stereotype.Component;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

/**
 * Importador de estabelecimentos de saúde (Hospitais, UPAs e UBS de Brasília-DF).
 *
 * <p>Executa na inicialização apenas quando {@code app.importacao.estabelecimentos.enabled=true}.
 * É idempotente: faz <em>upsert</em> pela chave estável {@code codigoCnes}. Para cada registro
 * georreferenciado (latitude/longitude), deriva um geofence circular a partir do ponto
 * (raio configurável) e armazena o centroide em {@code localizacao} — ambos indexados 2dsphere.</p>
 *
 * <p>Registros sem {@code codigoCnes} ou sem coordenadas são ignorados com log de advertência,
 * preservando a integridade da importação.</p>
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "app.importacao.estabelecimentos", name = "enabled", havingValue = "true")
@RequiredArgsConstructor
public class ImportadorEstabelecimentos implements ApplicationRunner {

    private final EstabelecimentoLeitor leitor;
    private final CategoriaMapper categoriaMapper;
    private final GeofenceFactory geofenceFactory;
    private final HospitalRepository hospitalRepository;
    private final ImportacaoProperties properties;

    @Override
    public void run(ApplicationArguments args) {
        Path arquivo = Path.of(properties.caminhoArquivo());
        if (!Files.exists(arquivo)) {
            log.warn("[Importacao] Arquivo não encontrado: {}. Importação ignorada.", arquivo.toAbsolutePath());
            return;
        }

        List<EstabelecimentoSaudeRaw> registros = leitor.ler(arquivo, properties.formato());
        log.info("[Importacao] {} registros lidos de {}", registros.size(), arquivo.getFileName());

        int novos = 0;
        int atualizados = 0;
        int ignorados = 0;

        for (EstabelecimentoSaudeRaw registro : registros) {
            if (registro.codigoCnes() == null || registro.codigoCnes().isBlank()) {
                log.warn("[Importacao] Registro sem código CNES ignorado: {}", registro.razaoSocial());
                ignorados++;
                continue;
            }
            if (registro.latitude() == null || registro.longitude() == null) {
                log.warn("[Importacao] Registro sem coordenadas ignorado: {}", registro.codigoCnes());
                ignorados++;
                continue;
            }

            try {
                boolean existia = hospitalRepository.findByCodigoCnes(registro.codigoCnes()).isPresent();
                hospitalRepository.save(toDocument(registro));
                if (existia) {
                    atualizados++;
                } else {
                    novos++;
                }
            } catch (org.springframework.dao.DuplicateKeyException ex) {
                // Chave duplicada (CNPJ/código CNES concorrente): ignora sem interromper o lote.
                log.warn("[Importacao] Registro ignorado por chave duplicada: {}", registro.codigoCnes());
                ignorados++;
            }
        }

        log.info("[Importacao] Concluída — novos: {}, atualizados: {}, ignorados: {}", novos, atualizados, ignorados);
    }

    private HospitalDocument toDocument(EstabelecimentoSaudeRaw r) {
        Instant agora = Instant.now();
        GeoJsonPoint localizacao = new GeoJsonPoint(r.longitude(), r.latitude());
        GeoJsonPolygon geofence = geofenceFactory.criarCirculo(
                r.latitude(), r.longitude(), properties.raioGeofenceMetros(), GeofenceFactory.LADOS_CIRCULO);

        // Upsert: preserva id e criadoEm de registros já existentes.
        HospitalDocument existente = hospitalRepository.findByCodigoCnes(r.codigoCnes()).orElse(null);
        HospitalDocument.HospitalDocumentBuilder builder = HospitalDocument.builder()
                .nome(escolherNome(r))
                .cnpj(blankToNull(r.cnpj()))
                .tipo(categoriaMapper.tipificar(r))
                .categoria(categoriaMapper.categorizar(r.tipoUnidade(), r.descricaoTipoUnidade()))
                .codigoCnes(r.codigoCnes().trim())
                .endereco(toEndereco(r))
                .contato(toContato(r))
                .geofence(geofence)
                .localizacao(localizacao)
                .ativo(true)
                .fonte("IMPORTACAO")
                .criadoEm(existente != null && existente.getCriadoEm() != null ? existente.getCriadoEm() : agora)
                .atualizadoEm(agora);

        if (existente != null) {
            builder.id(existente.getId());
        }
        return builder.build();
    }

    private String escolherNome(EstabelecimentoSaudeRaw r) {
        String fantasia = blankToNull(r.nomeFantasia());
        String razao = blankToNull(r.razaoSocial());
        return fantasia != null ? fantasia : (razao != null ? razao : r.codigoCnes());
    }

    private EnderecoDocument toEndereco(EstabelecimentoSaudeRaw r) {
        return EnderecoDocument.builder()
                .logradouro(blankToNull(r.logradouro()))
                .numero(blankToNull(r.numero()))
                .complemento(blankToNull(r.complemento()))
                .bairro(blankToNull(r.bairro()))
                .cidade(blankToNull(r.municipio()))
                .uf(blankToNull(r.uf()) != null ? blankToNull(r.uf()) : properties.ufPadrao())
                .cep(blankToNull(r.cep()))
                .build();
    }

    private ContatoDocument toContato(EstabelecimentoSaudeRaw r) {
        return ContatoDocument.builder()
                .telefone(blankToNull(r.telefone()))
                .email(blankToNull(r.email()))
                .build();
    }

    private String blankToNull(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }
}
