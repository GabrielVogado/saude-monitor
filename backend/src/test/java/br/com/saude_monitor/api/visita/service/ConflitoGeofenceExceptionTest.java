package br.com.saude_monitor.api.visita.service;

import br.com.saude_monitor.api.config.exception.GlobalExceptionHandler;
import br.com.saude_monitor.api.visita.dto.CandidatoGeofence;
import br.com.saude_monitor.api.visita.dto.ConflitoGeofenceResponse;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link ConflitoGeofenceException} é {@link java.io.Serializable}; os candidatos precisam
 * sobreviver à serialização e continuar chegando na resposta 409 (E2-04/RN-05).
 */
class ConflitoGeofenceExceptionTest {

    private static final CandidatoGeofence HRAN = new CandidatoGeofence("h-1", "Hospital Regional da Asa Norte", 42.0);
    private static final CandidatoGeofence HBDF = new CandidatoGeofence("h-2", "Hospital de Base", 47.5);

    @Test
    void serializaEDesserializaPreservandoOsCandidatos() throws Exception {
        ConflitoGeofenceException original = new ConflitoGeofenceException("Escolha o hospital.", List.of(HRAN, HBDF));

        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ObjectOutputStream out = new ObjectOutputStream(bytes)) {
            out.writeObject(original);
        }
        ConflitoGeofenceException copia;
        try (ObjectInputStream in = new ObjectInputStream(new ByteArrayInputStream(bytes.toByteArray()))) {
            copia = (ConflitoGeofenceException) in.readObject();
        }

        assertThat(copia.getMessage()).isEqualTo("Escolha o hospital.");
        assertThat(copia.getCandidatos()).containsExactly(HRAN, HBDF);
    }

    @Test
    void candidatosSaoCopiaDefensivaDaListaRecebida() {
        List<CandidatoGeofence> mutavel = new ArrayList<>(List.of(HRAN));

        ConflitoGeofenceException ex = new ConflitoGeofenceException("Escolha o hospital.", mutavel);
        mutavel.add(HBDF);

        assertThat(ex.getCandidatos()).containsExactly(HRAN);
    }

    @Test
    void candidatosNulosViramListaVazia() {
        assertThat(new ConflitoGeofenceException("Escolha o hospital.", null).getCandidatos()).isEmpty();
    }

    @Test
    void resposta409ContinuaTrazendoOsCandidatos() {
        ResponseEntity<ConflitoGeofenceResponse> resposta = new GlobalExceptionHandler()
                .handleConflitoGeofence(new ConflitoGeofenceException("Escolha o hospital.", List.of(HRAN, HBDF)));

        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(resposta.getBody()).isNotNull();
        assertThat(resposta.getBody().code()).isEqualTo("CONFLITO_GEOFENCE");
        assertThat(resposta.getBody().candidatos()).containsExactly(HRAN, HBDF);
    }
}
