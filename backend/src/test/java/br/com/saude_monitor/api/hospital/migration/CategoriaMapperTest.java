package br.com.saude_monitor.api.hospital.migration;

import br.com.saude_monitor.api.hospital.document.CategoriaEstabelecimento;
import br.com.saude_monitor.api.hospital.document.TipoEstabelecimento;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/**
 * Testes unitários da classificação CNES → categoria/tipo.
 */
class CategoriaMapperTest {

    private final CategoriaMapper mapper = new CategoriaMapper();

    @Test
    void deveClassificarUpa() {
        assertEquals(CategoriaEstabelecimento.UPA, mapper.categorizar("36", "UNIDADE DE PRONTO ATENDIMENTO"));
    }

    @Test
    void deveClassificarHospital() {
        assertEquals(CategoriaEstabelecimento.HOSPITAL, mapper.categorizar("05", "HOSPITAL GERAL"));
        assertEquals(CategoriaEstabelecimento.HOSPITAL, mapper.categorizar("20", "PRONTO SOCORRO GERAL"));
    }

    @Test
    void deveClassificarUbs() {
        assertEquals(CategoriaEstabelecimento.UBS, mapper.categorizar("02", "CENTRO DE SAUDE / UNIDADE BASICA"));
        assertEquals(CategoriaEstabelecimento.UBS, mapper.categorizar("01", "POSTO DE SAUDE"));
    }

    @Test
    void deveClassificarDesconhecidoComoOutro() {
        assertEquals(CategoriaEstabelecimento.OUTRO, mapper.categorizar("99", "CONSULTORIO ISOLADO"));
    }

    @Test
    void deveTolerarAcentosEMaiusculas() {
        assertEquals(CategoriaEstabelecimento.UBS, mapper.categorizar("02", "Centro de Saúde"));
    }

    @Test
    void deveTipificarComoPublico() {
        assertEquals(TipoEstabelecimento.PUBLICO, mapper.tipificar(null));
    }
}
