package br.com.saude_monitor.api.hospital.service.impl;

import br.com.saude_monitor.api.agregado.service.AgregadoService;
import br.com.saude_monitor.api.config.exception.ConflitoException;
import br.com.saude_monitor.api.config.exception.RecursoNaoEncontradoException;
import br.com.saude_monitor.api.config.security.AutenticacaoHelper;
import br.com.saude_monitor.api.hospital.document.ContatoDocument;
import br.com.saude_monitor.api.hospital.document.EnderecoDocument;
import br.com.saude_monitor.api.hospital.document.HospitalDocument;
import br.com.saude_monitor.api.hospital.document.StatusSugestao;
import br.com.saude_monitor.api.hospital.document.SugestaoHospitalDocument;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import br.com.saude_monitor.api.hospital.dto.ContatoDto;
import br.com.saude_monitor.api.hospital.dto.EnderecoDto;
import br.com.saude_monitor.api.hospital.dto.AprovarSugestaoRequest;
import br.com.saude_monitor.api.hospital.dto.GeoJsonPolygonDto;
import br.com.saude_monitor.api.hospital.dto.HospitalRequest;
import br.com.saude_monitor.api.hospital.dto.HospitalResumoResponse;
import br.com.saude_monitor.api.hospital.dto.HospitalResponse;
import br.com.saude_monitor.api.hospital.dto.IndicadoresResponse;
import br.com.saude_monitor.api.hospital.dto.LocalizacaoDto;
import br.com.saude_monitor.api.hospital.dto.OrdemRanking;
import br.com.saude_monitor.api.hospital.dto.PageResponse;
import br.com.saude_monitor.api.hospital.dto.RejeitarSugestaoRequest;
import br.com.saude_monitor.api.hospital.dto.SugestaoHospitalDetalheResponse;
import br.com.saude_monitor.api.hospital.dto.SugestaoHospitalRequest;
import br.com.saude_monitor.api.hospital.dto.SugestaoHospitalResponse;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.hospital.repository.SugestaoHospitalRepository;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import br.com.saude_monitor.api.hospital.service.GeofenceValidator;
import br.com.saude_monitor.api.hospital.service.HospitalService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.geo.Distance;
import org.springframework.data.geo.GeoResult;
import org.springframework.data.geo.Metrics;
import org.springframework.data.geo.Point;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.geo.GeoJsonPolygon;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.NearQuery;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.stereotype.Service;

import java.text.Normalizer;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Implementação do serviço de hospitais.
 *
 * <p>Responsabilidades: validação de unicidade (nome/CNPJ), validação geométrica do
 * geofence, cálculo do centroide ({@code localizacao}), CRUD e listagem pública com
 * filtro geoespacial por raio.</p>
 */
@Service
@RequiredArgsConstructor
public class HospitalServiceImpl implements HospitalService {

    private static final double RAIO_KM_PADRAO = 10.0;
    private static final int CAP_PROXIMOS = 1000;

    private final HospitalRepository hospitalRepository;
    private final SugestaoHospitalRepository sugestaoHospitalRepository;
    private final MongoTemplate mongoTemplate;
    private final GeofenceValidator geofenceValidator;
    private final GeofenceFactory geofenceFactory;
    private final AutenticacaoHelper autenticacaoHelper;
    private final AgregadoService agregadoService;

    @Override
    public HospitalResponse criar(HospitalRequest request) {
        geofenceValidator.validar(request.geofence());
        validarUnicidade(request.nome(), request.cnpj(), null);

        Instant agora = Instant.now();
        GeoJsonPolygon geofence = geofenceFactory.toPolygon(request.geofence());

        HospitalDocument document = HospitalDocument.builder()
                .nome(normalizarNome(request.nome()))
                .cnpj(normalizarCnpj(request.cnpj()))
                .tipo(request.tipo())
                .categoria(request.categoria())
                .endereco(toEndereco(request.endereco()))
                .contato(toContato(request.contato()))
                .geofence(geofence)
                .localizacao(geofenceFactory.calcularCentroide(geofence))
                .ativo(true)
                .fonte("CADASTRO")
                .criadoEm(agora)
                .atualizadoEm(agora)
                .build();

        return toResponse(hospitalRepository.save(document), indicadoresDe(document));
    }

    @Override
    public HospitalResponse atualizar(String id, HospitalRequest request) {
        HospitalDocument existente = obterOu404(id);
        geofenceValidator.validar(request.geofence());
        validarUnicidade(request.nome(), request.cnpj(), id);

        GeoJsonPolygon geofence = geofenceFactory.toPolygon(request.geofence());
        existente.setNome(normalizarNome(request.nome()));
        existente.setCnpj(normalizarCnpj(request.cnpj()));
        existente.setTipo(request.tipo());
        existente.setCategoria(request.categoria());
        existente.setEndereco(toEndereco(request.endereco()));
        existente.setContato(toContato(request.contato()));
        existente.setGeofence(geofence);
        existente.setLocalizacao(geofenceFactory.calcularCentroide(geofence));
        existente.setAtualizadoEm(Instant.now());

        return toResponse(hospitalRepository.save(existente), indicadoresDe(existente));
    }

    @Override
    public HospitalResponse buscarPorId(String id) {
        HospitalDocument documento = obterOu404(id);
        return toResponse(documento, indicadoresDe(documento));
    }

    @Override
    public GeoJsonPolygonDto buscarGeofence(String id) {
        HospitalDocument document = obterOu404(id);
        return geofenceFactory.toDto(document.getGeofence());
    }

    @Override
    public PageResponse<HospitalResumoResponse> listar(Double latitude, Double longitude, Double raioKm,
                                                       TipoEstabelecimento tipo, String busca, int page, int size) {
        List<HospitalDocument> documentos;
        long total;

        if (latitude != null && longitude != null) {
            double raio = raioKm == null ? RAIO_KM_PADRAO : raioKm;
            documentos = buscarProximos(latitude, longitude, raio, tipo);
            documentos = filtrarPorBusca(documentos, busca);
            total = documentos.size();
            documentos = paginarEmMemoria(documentos, page, size);
        } else {
            Page<HospitalDocument> resultado = buscarPaginado(tipo, busca, page, size);
            documentos = resultado.getContent();
            total = resultado.getTotalElements();
        }

        Map<String, IndicadoresResponse> porId = mapaIndicadores(documentos);
        List<HospitalResumoResponse> content = documentos.stream()
                .map(d -> toResumo(d, porId.get(d.getId())))
                .toList();
        return PageResponse.of(content, page, size, total);
    }

    @Override
    public PageResponse<HospitalResumoResponse> ranking(OrdemRanking ordem, TipoEstabelecimento tipo, int page, int size) {
        // Busca TODOS os hospitais ativos (filtro opcional por tipo), sem paginar ainda,
        // para ordenar globalmente pelo indicador antes de fatiar a página (E4-05).
        Query query = new Query(Criteria.where("ativo").is(true));
        if (tipo != null) {
            query.addCriteria(Criteria.where("tipo").is(tipo));
        }
        List<HospitalDocument> todos = mongoTemplate.find(query, HospitalDocument.class);

        Map<String, IndicadoresResponse> porId = mapaIndicadores(todos);

        // Ordena: hospitais com indicadores disponíveis primeiro (por nota desc ou
        // tempo asc); sem indicadores ficam ao final, ordenados por nome.
        List<HospitalDocument> ordenados = new ArrayList<>(todos);
        OrdemRanking efetiva = ordem == null ? OrdemRanking.NOTA : ordem;
        ordenados.sort((a, b) -> {
            IndicadoresResponse ia = porId.get(a.getId());
            IndicadoresResponse ib = porId.get(b.getId());
            boolean da = ia != null && ia.indicadoresDisponiveis();
            boolean db = ib != null && ib.indicadoresDisponiveis();
            if (da != db) {
                return da ? -1 : 1;
            }
            if (!da) {
                return String.CASE_INSENSITIVE_ORDER.compare(
                        nz(a.getNome()), nz(b.getNome()));
            }
            if (efetiva == OrdemRanking.NOTA) {
                int cmp = Double.compare(nzNota(ib), nzNota(ia)); // maior nota primeiro
                if (cmp != 0) return cmp;
            } else {
                int cmp = Integer.compare(nzTempo(ia), nzTempo(ib)); // menor tempo primeiro
                if (cmp != 0) return cmp;
            }
            return String.CASE_INSENSITIVE_ORDER.compare(nz(a.getNome()), nz(b.getNome()));
        });

        int total = ordenados.size();
        List<HospitalDocument> conteudo = paginarEmMemoria(ordenados, page, size);
        List<HospitalResumoResponse> content = conteudo.stream()
                .map(d -> toResumo(d, porId.get(d.getId())))
                .toList();
        return PageResponse.of(content, page, size, total);
    }

    private static double nzNota(IndicadoresResponse i) {
        return i != null && i.notaMedia() != null ? i.notaMedia() : 0.0;
    }

    private static int nzTempo(IndicadoresResponse i) {
        return i != null && i.tempoMedianoMinutos() != null ? i.tempoMedianoMinutos() : Integer.MAX_VALUE;
    }

    private static String nz(String s) {
        return s == null ? "" : s;
    }

    @Override
    public HospitalResponse alterarStatus(String id, boolean ativo) {
        HospitalDocument document = obterOu404(id);
        document.setAtivo(ativo);
        document.setAtualizadoEm(Instant.now());
        return toResponse(hospitalRepository.save(document), indicadoresDe(document));
    }

    @Override
    public SugestaoHospitalResponse sugerir(SugestaoHospitalRequest request) {
        Instant agora = Instant.now();
        SugestaoHospitalDocument sugestao = SugestaoHospitalDocument.builder()
                .nome(normalizarNome(request.nome()))
                .endereco(toEndereco(request.endereco()))
                .observacao(blankToNull(request.observacao()))
                .status(StatusSugestao.PENDENTE)
                .criadoEm(agora)
                .atualizadoEm(agora)
                .build();

        return toSugestaoResponse(sugestaoHospitalRepository.save(sugestao));
    }

    @Override
    public PageResponse<SugestaoHospitalDetalheResponse> listarSugestoes(StatusSugestao status, int page, int size) {
        Pageable pageable = PageRequest.of(page, size);
        Page<SugestaoHospitalDocument> resultado = status == null
                ? sugestaoHospitalRepository.findAll(pageable)
                : sugestaoHospitalRepository.findByStatusOrderByCriadoEmDesc(status, pageable);
        List<SugestaoHospitalDetalheResponse> content = resultado.getContent().stream()
                .map(this::toSugestaoDetalheResponse)
                .toList();
        return PageResponse.of(content, page, size, resultado.getTotalElements());
    }

    @Override
    public SugestaoHospitalDetalheResponse buscarSugestaoPorId(String id) {
        SugestaoHospitalDocument sugestao = sugestaoHospitalRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException(
                        "Sugestão de hospital não encontrada para o id informado."));
        return toSugestaoDetalheResponse(sugestao);
    }

    @Override
    public SugestaoHospitalDetalheResponse aprovarSugestao(String id, AprovarSugestaoRequest request, String adminId) {
        SugestaoHospitalDocument sugestao = obterSugestaoPendente(id);
        HospitalDocument hospital = hospitalRepository.findById(request.hospitalId())
                .orElseThrow(() -> new RecursoNaoEncontradoException(
                        "Hospital não encontrado para o id informado."));

        Instant agora = Instant.now();
        sugestao.setStatus(StatusSugestao.APROVADA);
        sugestao.setHospitalId(hospital.getId());
        sugestao.setRevisadoPor(adminId);
        sugestao.setRevisadoEm(agora);
        sugestao.setAtualizadoEm(agora);

        return toSugestaoDetalheResponse(sugestaoHospitalRepository.save(sugestao));
    }

    @Override
    public SugestaoHospitalDetalheResponse rejeitarSugestao(String id, RejeitarSugestaoRequest request, String adminId) {
        SugestaoHospitalDocument sugestao = obterSugestaoPendente(id);

        Instant agora = Instant.now();
        sugestao.setStatus(StatusSugestao.RECUSADA);
        sugestao.setMotivoRecusa(request.motivo().trim());
        sugestao.setRevisadoPor(adminId);
        sugestao.setRevisadoEm(agora);
        sugestao.setAtualizadoEm(agora);

        return toSugestaoDetalheResponse(sugestaoHospitalRepository.save(sugestao));
    }

    private SugestaoHospitalDocument obterSugestaoPendente(String id) {
        return sugestaoHospitalRepository.findById(id)
                .filter(s -> s.getStatus() == StatusSugestao.PENDENTE)
                .orElseThrow(() -> new ConflitoException(
                        "Sugestão não está pendente de aprovação."));
    }

    // ------------------------------------------------------------------
    // Consultas
    // ------------------------------------------------------------------

    /**
     * Lista hospitais ativos ordenados por distância ao ponto informado, usando
     * {@code $near} sobre o campo {@code localizacao} (centroide) com índice 2dsphere.
     */
    private List<HospitalDocument> buscarProximos(double latitude, double longitude, double raioKm,
                                                  TipoEstabelecimento tipo) {
        Query filtro = new Query(Criteria.where("ativo").is(true));
        if (tipo != null) {
            filtro.addCriteria(Criteria.where("tipo").is(tipo));
        }

        NearQuery near = NearQuery.near(new Point(longitude, latitude))
                .maxDistance(new Distance(raioKm, Metrics.KILOMETERS))
                .query(filtro)
                .limit(CAP_PROXIMOS);

        return mongoTemplate.geoNear(near, HospitalDocument.class)
                .getContent().stream()
                .map(GeoResult::getContent)
                .toList();
    }

    /** Busca paginada sem filtro geoespacial, com critérios opcionais de tipo e nome. */
    private Page<HospitalDocument> buscarPaginado(TipoEstabelecimento tipo, String busca, int page, int size) {
        Query query = new Query(Criteria.where("ativo").is(true));
        if (tipo != null) {
            query.addCriteria(Criteria.where("tipo").is(tipo));
        }
        // A filtragem por nome é feita em memória (e não via regex no MongoDB) para
        // suportar busca insensível a acentos/caixa de forma consistente nas duas rotas
        // de listagem. O volume de registros (~340) torna essa abordagem segura.
        List<HospitalDocument> todos = mongoTemplate.find(query, HospitalDocument.class);
        List<HospitalDocument> filtrados = filtrarPorBusca(todos, busca);
        List<HospitalDocument> content = paginarEmMemoria(filtrados, page, size);
        return new org.springframework.data.domain.PageImpl<>(content, PageRequest.of(page, size), filtrados.size());
    }

    private List<HospitalDocument> filtrarPorBusca(List<HospitalDocument> docs, String busca) {
        if (busca == null || busca.isBlank()) {
            return docs;
        }
        String termo = normalizarBusca(busca);
        return docs.stream()
                .filter(d -> d.getNome() != null && normalizarBusca(d.getNome()).contains(termo))
                .toList();
    }

    private List<HospitalDocument> paginarEmMemoria(List<HospitalDocument> docs, int page, int size) {
        int from = Math.min(page * size, docs.size());
        int to = Math.min(from + size, docs.size());
        if (from >= to) {
            return List.of();
        }
        return new ArrayList<>(docs.subList(from, to));
    }

    // ------------------------------------------------------------------
    // Validações e normalização
    // ------------------------------------------------------------------

    private void validarUnicidade(String nome, String cnpj, String idAtual) {
        String nomeNormalizado = normalizarNome(nome);
        if (nomeNormalizado != null) {
            boolean nomeEmUso = hospitalRepository.findAllByNomeIgnoreCase(nomeNormalizado).stream()
                    .anyMatch(d -> !d.getId().equals(idAtual));
            if (nomeEmUso) {
                throw new ConflitoException("Já existe um hospital com o nome informado.");
            }
        }

        String cnpjNormalizado = normalizarCnpj(cnpj);
        if (cnpjNormalizado != null) {
            hospitalRepository.findByCnpj(cnpjNormalizado).ifPresent(d -> {
                if (!d.getId().equals(idAtual)) {
                    throw new ConflitoException("Já existe um hospital com o CNPJ informado.");
                }
            });
        }
    }

    private HospitalDocument obterOu404(String id) {
        return hospitalRepository.findById(id)
                .orElseThrow(() -> new RecursoNaoEncontradoException(
                        "Hospital não encontrado para o id informado."));
    }

    private String normalizarNome(String nome) {
        return nome == null ? null : nome.trim();
    }

    /**
     * Normaliza texto para busca: remove acentos (diacríticos) via decomposição NFD
     * e converte para minúsculas. Torna a busca por nome insensível a acentos e caixa
     * (ex.: "policlinica" encontra "Policlínica").
     */
    private String normalizarBusca(String valor) {
        if (valor == null) {
            return "";
        }
        String semAcentos = Normalizer.normalize(valor, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        return semAcentos.toLowerCase(Locale.ROOT).trim();
    }

    private String normalizarCnpj(String cnpj) {
        return cnpj == null || cnpj.isBlank() ? null : cnpj.trim();
    }

    // ------------------------------------------------------------------
    // Mapeamentos documento ⇄ DTO
    // ------------------------------------------------------------------

    /** Indicadores embutidos de um único hospital (detalhe/escrita), com cache por chamada. */
    private IndicadoresResponse indicadoresDe(HospitalDocument d) {
        return agregadoService.mapaIndicadores(List.of(d.getId())).getFirst();
    }

    /** Mapa id do hospital → indicadores, calculado em lote para listagens (evita N+1). */
    private Map<String, IndicadoresResponse> mapaIndicadores(List<HospitalDocument> documentos) {
        List<String> ids = documentos.stream().map(HospitalDocument::getId).toList();
        List<IndicadoresResponse> indicadores = agregadoService.mapaIndicadores(ids);
        java.util.LinkedHashMap<String, IndicadoresResponse> mapa = new java.util.LinkedHashMap<>();
        for (int i = 0; i < documentos.size(); i++) {
            mapa.put(documentos.get(i).getId(), indicadores.get(i));
        }
        return mapa;
    }

    private HospitalResponse toResponse(HospitalDocument d, IndicadoresResponse indicadores) {
        return new HospitalResponse(
                d.getId(),
                d.getNome(),
                d.getCnpj(),
                d.getTipo(),
                d.getCategoria(),
                d.getHorarioFuncionamento(),
                d.getSalaVacina(),
                d.getFarmacia(),
                d.getColetaMaterial(),
                d.getTipoUnidade(),
                d.getEndereco() == null ? null : toEnderecoDto(d.getEndereco()),
                d.getContato() == null ? null : toContatoDto(d.getContato()),
                d.getGeofence() == null ? null : geofenceFactory.toDto(d.getGeofence()),
                d.isAtivo(),
                indicadores,
                d.getCriadoEm(),
                d.getAtualizadoEm()
        );
    }

    private HospitalResumoResponse toResumo(HospitalDocument d, IndicadoresResponse indicadores) {
        return new HospitalResumoResponse(
                d.getId(),
                d.getNome(),
                d.getTipo(),
                d.getCategoria(),
                d.getTipoUnidade(),
                d.getEndereco() == null ? null : toEnderecoDto(d.getEndereco()),
                toLocalizacaoDto(d),
                geofenceFactory.raioAproximadoMetros(d.getGeofence(), centroideDe(d)),
                d.isAtivo(),
                indicadores
        );
    }

    /**
     * Centroide do hospital: prefere o campo persistido {@code localizacao} (indexado
     * 2dsphere) e só recalcula a partir do polígono quando ele não existe — caso de
     * registros anteriores à migração que passou a gravar o centroide.
     */
    private GeoJsonPoint centroideDe(HospitalDocument d) {
        if (d.getLocalizacao() != null) {
            return d.getLocalizacao();
        }
        return d.getGeofence() == null ? null : geofenceFactory.calcularCentroide(d.getGeofence());
    }

    private LocalizacaoDto toLocalizacaoDto(HospitalDocument d) {
        GeoJsonPoint centroide = centroideDe(d);
        // GeoJSON guarda [longitude, latitude]: X = longitude, Y = latitude.
        return centroide == null ? null : new LocalizacaoDto(centroide.getY(), centroide.getX());
    }

    private EnderecoDocument toEndereco(EnderecoDto dto) {
        if (dto == null) {
            return null;
        }
        return EnderecoDocument.builder()
                .logradouro(dto.logradouro())
                .numero(dto.numero())
                .complemento(dto.complemento())
                .bairro(dto.bairro())
                .cidade(dto.cidade())
                .uf(dto.uf())
                .cep(dto.cep())
                .build();
    }

    private ContatoDocument toContato(ContatoDto dto) {
        if (dto == null) {
            return null;
        }
        return ContatoDocument.builder()
                .telefone(dto.telefone())
                .email(dto.email())
                .build();
    }

    private EnderecoDto toEnderecoDto(EnderecoDocument e) {
        return new EnderecoDto(
                e.getLogradouro(), e.getNumero(), e.getComplemento(),
                e.getBairro(), e.getCidade(), e.getUf(), e.getCep());
    }

    private ContatoDto toContatoDto(ContatoDocument c) {
        return new ContatoDto(c.getTelefone(), c.getEmail());
    }

    private SugestaoHospitalResponse toSugestaoResponse(SugestaoHospitalDocument s) {
        return new SugestaoHospitalResponse(
                s.getId(),
                s.getNome(),
                s.getEndereco() == null ? null : toEnderecoDto(s.getEndereco()),
                s.getObservacao(),
                s.getStatus(),
                s.getCriadoEm()
        );
    }

    private SugestaoHospitalDetalheResponse toSugestaoDetalheResponse(SugestaoHospitalDocument s) {
        return new SugestaoHospitalDetalheResponse(
                s.getId(),
                s.getNome(),
                s.getEndereco() == null ? null : toEnderecoDto(s.getEndereco()),
                s.getObservacao(),
                s.getStatus(),
                s.getHospitalId(),
                s.getRevisadoPor(),
                s.getRevisadoEm(),
                s.getMotivoRecusa(),
                s.getCriadoEm(),
                s.getAtualizadoEm()
        );
    }

    /** Converte string vazia/espaços em {@code null}. */
    private String blankToNull(String valor) {
        return valor == null || valor.isBlank() ? null : valor.trim();
    }
}
