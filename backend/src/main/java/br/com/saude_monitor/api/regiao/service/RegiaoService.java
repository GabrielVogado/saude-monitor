package br.com.saude_monitor.api.regiao.service;

import br.com.saude_monitor.api.regiao.TipoCamada;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.EnumMap;
import java.util.Map;

/**
 * Serve as 4 camadas geográficas (F-11, §5).
 *
 * <p>Desvio documentado do plano (§5.2 item 4): em vez de coleção MongoDB
 * {@code regioes_geograficas} + seed + índice {@code 2dsphere}, os GeoJSON
 * (<strong>919 KB somados</strong>, simplificados a 10%) ficam no classpath e são
 * carregados uma vez na subida. Motivos: a divisão administrativa/de saúde quase não
 * muda (seed seria carga única de qualquer jeito); nenhuma consulta geoespacial é
 * feita no servidor — o cliente só renderiza (o filtro E7-03 usa os atributos que já
 * vêm nas {@code properties}); e evita custo de migração/startup sem benefício de
 * consulta. O contrato ({@code GET /api/v1/camadas/{tipo}} → {@code FeatureCollection})
 * é idêntico ao planejado — se um dia houver query espacial, a troca é interna a
 * este serviço.</p>
 *
 * <p>Fonte: {@code multiplas_camadas_saude_14/*.shp} (CRS {@code GCS_WGS_1984}, já
 * lon/lat — sem reprojeção) → {@code mapshaper -simplify 10% keep-shapes} →
 * renomeação de atributos para o contrato. Regeneração em
 * {@code backend/data/camadas/README.md}.</p>
 */
@Service
public class RegiaoService {

    private final Map<TipoCamada, String> camadas = new EnumMap<>(TipoCamada.class);

    @PostConstruct
    public void carregar() {
        for (TipoCamada tipo : TipoCamada.values()) {
            camadas.put(tipo, lerRecurso(tipo.recursoClasspath()));
        }
    }

    /**
     * GeoJSON da camada como texto (já é o corpo da resposta — sem reparse).
     *
     * @throws br.com.saude_monitor.api.config.exception.RecursoNaoEncontradoException nunca aqui;
     *         o slug inválido é rejeitado antes, em {@link TipoCamada#fromSlug(String)}
     */
    public String buscar(TipoCamada tipo) {
        return camadas.get(tipo);
    }

    private static String lerRecurso(String caminho) {
        try (InputStream entrada = new ClassPathResource(caminho).getInputStream()) {
            return new String(entrada.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new IllegalStateException("GeoJSON da camada ausente no classpath: " + caminho, e);
        }
    }

    Map<TipoCamada, String> camadasParaTeste() {
        return Collections.unmodifiableMap(camadas);
    }
}
