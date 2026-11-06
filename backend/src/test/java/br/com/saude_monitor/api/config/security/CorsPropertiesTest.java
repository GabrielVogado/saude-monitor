package br.com.saude_monitor.api.config.security;

import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Formato da origem do painel (ADR-013): é a única origem com CORS com credenciais, então
 * curinga, lista ou caminho derrubam o startup em vez de abrir a sessão do painel.
 */
class CorsPropertiesTest {

    private static ValidatorFactory fabrica;
    private static Validator validador;

    @BeforeAll
    static void criarValidador() {
        fabrica = Validation.buildDefaultValidatorFactory();
        validador = fabrica.getValidator();
    }

    @AfterAll
    static void fecharValidador() {
        fabrica.close();
    }

    private static CorsProperties comOrigemDoPainel(String origem) {
        return new CorsProperties(List.of("http://localhost:4200"), origem);
    }

    @ParameterizedTest
    @ValueSource(strings = {"http://localhost:4200", "https://admin.radarsaude.app"})
    void aceitaUmaOrigemExata(String origem) {
        assertThat(validador.validate(comOrigemDoPainel(origem))).isEmpty();
    }

    @ParameterizedTest
    @NullAndEmptySource
    @ValueSource(strings = {"*", "https://*.radarsaude.app", "https://admin.radarsaude.app/",
            "https://admin.radarsaude.app/painel", "https://a.app,https://b.app", "admin.radarsaude.app",
            "ftp://admin.radarsaude.app"})
    void recusaCuringaListaCaminhoOuOrigemSemEsquema(String origem) {
        assertThat(validador.validate(comOrigemDoPainel(origem))).isNotEmpty();
    }
}
