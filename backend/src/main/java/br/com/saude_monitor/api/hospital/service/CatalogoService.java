package br.com.saude_monitor.api.hospital.service;

import br.com.saude_monitor.api.hospital.dto.CatalogoResponse;
import br.com.saude_monitor.api.hospital.dto.HospitalResumoResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Monta e guarda o catálogo público (ARQ-01).
 *
 * <p>O catálogo é lido do banco no máximo uma vez a cada {@link #VALIDADE} por instância,
 * em vez de a cada requisição. O atraso aceito nos dados públicos é de até 5 minutos (P8
 * da análise de escala): nota, tempo e cadastro novos aparecem no catálogo dentro dessa
 * janela. Uma alteração administrativa feita nesta instância descarta o catálogo na hora
 * ({@link #invalidar()}).</p>
 *
 * <p>A versão é o SHA-256 do conteúdo, então duas instâncias com os mesmos dados dão a
 * mesma versão, e o {@code If-None-Match} do app vale em qualquer uma delas.</p>
 */
@Service
public class CatalogoService {

    /** Por quanto tempo o catálogo montado é reaproveitado (P8: até 5 min de atraso). */
    public static final Duration VALIDADE = Duration.ofMinutes(5);

    private final HospitalService hospitalService;
    private final Clock clock;

    private final AtomicReference<Guardado> guardado = new AtomicReference<>();

    @Autowired
    public CatalogoService(HospitalService hospitalService) {
        this(hospitalService, Clock.systemUTC());
    }

    CatalogoService(HospitalService hospitalService, Clock clock) {
        this.hospitalService = hospitalService;
        this.clock = clock;
    }

    /** Catálogo atual, montado de novo só quando o guardado venceu ou foi descartado. */
    public CatalogoResponse obter() {
        Guardado atual = guardado.get();
        if (atual != null && clock.instant().isBefore(atual.expiraEm())) {
            return atual.catalogo();
        }
        return remontar();
    }

    /** Descarta o catálogo guardado; a próxima leitura vai ao banco. */
    public void invalidar() {
        guardado.set(null);
    }

    private synchronized CatalogoResponse remontar() {
        Instant agora = clock.instant();
        Guardado atual = guardado.get();
        if (atual != null && agora.isBefore(atual.expiraEm())) {
            return atual.catalogo(); // outra thread remontou enquanto esta esperava
        }
        List<HospitalResumoResponse> itens = hospitalService.listarCatalogo();
        CatalogoResponse catalogo = new CatalogoResponse(versaoDe(itens), itens.size(), itens);
        guardado.set(new Guardado(catalogo, agora.plus(VALIDADE)));
        return catalogo;
    }

    /**
     * Resumo do conteúdo. Os itens são records (e enums, números, textos e instantes), cujo
     * {@code toString} é determinístico, então serve de forma canônica sem depender da
     * serialização JSON.
     */
    static String versaoDe(List<HospitalResumoResponse> itens) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(itens.toString().getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash, 0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível na JVM.", e);
        }
    }

    private record Guardado(CatalogoResponse catalogo, Instant expiraEm) {
    }
}
