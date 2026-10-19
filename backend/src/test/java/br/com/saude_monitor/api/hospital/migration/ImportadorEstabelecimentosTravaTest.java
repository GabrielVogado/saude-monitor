package br.com.saude_monitor.api.hospital.migration;

import br.com.saude_monitor.api.config.trava.TravasDeTeste;
import br.com.saude_monitor.api.hospital.repository.HospitalRepository;
import br.com.saude_monitor.api.hospital.service.GeofenceFactory;
import org.junit.jupiter.api.Test;
import org.springframework.boot.ApplicationArguments;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/** A importação de estabelecimentos roda numa instância por vez (SOL-02). */
class ImportadorEstabelecimentosTravaTest {

    private final EstabelecimentoLeitor leitor = mock(EstabelecimentoLeitor.class);
    private final HospitalRepository hospitalRepository = mock(HospitalRepository.class);
    private final ImportacaoProperties properties =
            new ImportacaoProperties(true, "nao-existe/estabelecimentos.csv", "CSV", 150.0, "DF");

    private ImportadorEstabelecimentos criarImportador(br.com.saude_monitor.api.config.trava.TravaDistribuida trava) {
        return new ImportadorEstabelecimentos(leitor, mock(CategoriaMapper.class), mock(GeofenceFactory.class),
                hospitalRepository, properties, trava);
    }

    @Test
    void comATravaExecutaAImportacao() {
        // Arquivo ausente: a importação roda e para no aviso, sem ler nem gravar.
        criarImportador(TravasDeTeste.criarTravaLivre()).run(mock(ApplicationArguments.class));

        verify(leitor, never()).ler(any(), anyString());
    }

    @Test
    void semATravaNaoTocaNoBanco() {
        criarImportador(TravasDeTeste.criarTravaOcupada()).run(mock(ApplicationArguments.class));

        verifyNoInteractions(leitor, hospitalRepository);
    }
}
