package br.com.saude_monitor.api.hospital.service;

import br.com.saude_monitor.api.hospital.dto.CatalogoResponse;
import br.com.saude_monitor.api.hospital.dto.HospitalResumoResponse;
import br.com.saude_monitor.api.hospital.dto.IndicadoresCatalogoResponse;
import br.com.saude_monitor.api.hospital.dto.IndicadoresResponse;
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
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;

/**
 * Monta e guarda o catálogo público (ARQ-01) e os indicadores dele.
 *
 * <p>O catálogo só tem o que o painel muda (nome, endereço, posição, raio, tipo). Por isso a
 * versão dele só muda quando um estabelecimento muda, e o app, que recebe essa versão pela
 * configuração remota, baixa o catálogo só nesse caso. Nota e tempo mudam a cada avaliação e
 * ficam nos indicadores, servidos à parte.</p>
 *
 * <p>Cada um é lido do banco no máximo uma vez a cada {@link #VALIDADE} por instância, em vez
 * de a cada requisição. O atraso aceito nos dados públicos é de até 5 minutos (P8 da análise
 * de escala). Uma alteração administrativa feita nesta instância descarta os dois na hora
 * ({@link #invalidarCache()}).</p>
 *
 * <p>A versão é o SHA-256 do conteúdo, então duas instâncias com os mesmos dados dão a
 * mesma versão, e o {@code If-None-Match} do app vale em qualquer uma delas.</p>
 */
@Service
public class CatalogoService {

    /** Por quanto tempo o catálogo e os indicadores montados são reaproveitados (P8). */
    public static final Duration VALIDADE = Duration.ofMinutes(5);

    private final HospitalService hospitalService;
    private final Clock clock;

    private final Guardado<CatalogoResponse> catalogo = new Guardado<>();
    private final Guardado<IndicadoresCatalogoResponse> indicadores = new Guardado<>();

    @Autowired
    public CatalogoService(HospitalService hospitalService) {
        this(hospitalService, Clock.systemUTC());
    }

    CatalogoService(HospitalService hospitalService, Clock clock) {
        this.hospitalService = hospitalService;
        this.clock = clock;
    }

    /** Catálogo atual, montado de novo só quando o guardado venceu ou foi descartado. */
    public CatalogoResponse obterCatalogo() {
        return catalogo.obterOuMontar(clock, () -> {
            List<HospitalResumoResponse> itens = hospitalService.listarCatalogo();
            return new CatalogoResponse(calcularVersao(itens), itens.size(), itens);
        });
    }

    /** Indicadores atuais de todo o catálogo, montados de novo só quando o guardado venceu. */
    public IndicadoresCatalogoResponse obterIndicadores() {
        return indicadores.obterOuMontar(clock, () -> {
            Map<String, IndicadoresResponse> porHospital = hospitalService.listarIndicadoresDoCatalogo();
            return new IndicadoresCatalogoResponse(calcularVersao(porHospital), porHospital);
        });
    }

    /**
     * Descarta o catálogo e os indicadores guardados; a próxima leitura vai ao banco. Os
     * indicadores também, para um estabelecimento desativado sair deles na hora.
     */
    public void invalidarCache() {
        catalogo.descartar();
        indicadores.descartar();
    }

    /**
     * Resumo do conteúdo. Os itens são records (e enums, números, textos e instantes) em
     * listas e mapas de ordem fixa, cujo {@code toString} é determinístico, então serve de
     * forma canônica sem depender da serialização JSON.
     */
    static String calcularVersao(Object conteudo) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256")
                    .digest(String.valueOf(conteudo).getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash, 0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 indisponível na JVM.", e);
        }
    }

    /** Um valor montado com o instante em que vence. */
    private static final class Guardado<T> {

        private final AtomicReference<Validade<T>> atual = new AtomicReference<>();

        T obterOuMontar(Clock clock, Supplier<T> montar) {
            Validade<T> lido = atual.get();
            if (lido != null && clock.instant().isBefore(lido.expiraEm())) {
                return lido.valor();
            }
            return remontar(clock, montar);
        }

        private synchronized T remontar(Clock clock, Supplier<T> montar) {
            Instant agora = clock.instant();
            Validade<T> lido = atual.get();
            if (lido != null && agora.isBefore(lido.expiraEm())) {
                return lido.valor(); // outra thread remontou enquanto esta esperava
            }
            T valor = montar.get();
            atual.set(new Validade<>(valor, agora.plus(VALIDADE)));
            return valor;
        }

        void descartar() {
            atual.set(null);
        }
    }

    private record Validade<T>(T valor, Instant expiraEm) {
    }
}
