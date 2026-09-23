package br.com.saude_monitor.api.visita.document;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.springframework.data.mongodb.core.geo.GeoJsonPoint;

import java.time.Instant;

/**
 * Ponto amostral de posição registrado durante uma visita (entrada, saída ou
 * pontos intermediários), para fins de auditoria/depuração (§2.3 da Especificação da API).
 */
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PontoAmostralDocument {

    private GeoJsonPoint posicao;

    private Instant em;
}
