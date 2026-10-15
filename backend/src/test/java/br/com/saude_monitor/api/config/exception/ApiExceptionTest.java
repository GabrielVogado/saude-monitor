package br.com.saude_monitor.api.config.exception;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.ObjectInputStream;
import java.io.ObjectOutputStream;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * {@link ApiException} é {@link java.io.Serializable} (via {@link RuntimeException}); o campo
 * {@code details} precisa sobreviver à serialização e continuar chegando no envelope de erro.
 */
class ApiExceptionTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    void serializaEDesserializaPreservandoStatusCodigoEDetalhes() throws Exception {
        ApiException original = new ValidacaoNegocioException("Dados inválidos.",
                List.of(new CampoInvalido("email", "formato inválido"),
                        new CampoInvalido("senha", "muito curta")));

        ApiException copia = roundTrip(original);

        assertThat(copia.getStatus()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(copia.getCode()).isEqualTo("CAMPOS_INVALIDOS");
        assertThat(copia.getMessage()).isEqualTo("Dados inválidos.");
        assertThat(copia.getDetails()).containsExactly(
                new CampoInvalido("email", "formato inválido"),
                new CampoInvalido("senha", "muito curta"));
    }

    @Test
    void detalhesSaoCopiaDefensivaDaListaRecebida() {
        List<CampoInvalido> mutavel = new ArrayList<>();
        mutavel.add(new CampoInvalido("nome", "obrigatório"));

        ApiException ex = new ValidacaoNegocioException("Dados inválidos.", mutavel);
        mutavel.add(new CampoInvalido("intruso", "adicionado depois"));

        assertThat(ex.getDetails()).containsExactly(new CampoInvalido("nome", "obrigatório"));
    }

    @Test
    void detalhesNulosViramListaVazia() {
        ApiException ex = new ValidacaoNegocioException("Dados inválidos.", null);

        assertThat(ex.getDetails()).isEmpty();
    }

    @Test
    void envelopeDeErroContinuaTrazendoOsDetalhes() {
        ApiException ex = new ValidacaoNegocioException("Dados inválidos.",
                List.of(new CampoInvalido("email", "formato inválido")));

        ResponseEntity<ApiError> resposta = handler.handleApiException(ex);

        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(resposta.getBody()).isNotNull();
        assertThat(resposta.getBody().code()).isEqualTo("CAMPOS_INVALIDOS");
        assertThat(resposta.getBody().details()).containsExactly(new CampoInvalido("email", "formato inválido"));
    }

    @Test
    void envelopeDeExcecaoSemDetalhesTrazListaVazia() {
        ResponseEntity<ApiError> resposta = handler.handleApiException(new ConflitoException("Já existe."));

        assertThat(resposta.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(resposta.getBody()).isNotNull();
        assertThat(resposta.getBody().details()).isEmpty();
    }

    @SuppressWarnings("unchecked")
    static <T> T roundTrip(T objeto) throws IOException, ClassNotFoundException {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ObjectOutputStream out = new ObjectOutputStream(bytes)) {
            out.writeObject(objeto);
        }
        try (ObjectInputStream in = new ObjectInputStream(new ByteArrayInputStream(bytes.toByteArray()))) {
            return (T) in.readObject();
        }
    }
}
