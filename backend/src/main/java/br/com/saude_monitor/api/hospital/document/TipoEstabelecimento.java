package br.com.saude_monitor.api.hospital.document;

/**
 * Natureza administrativa do estabelecimento de saúde.
 *
 * <p>Espelha o enum definido na Especificação da API v2.0 (§2.1):</p>
 * <ul>
 *   <li>{@link #PUBLICO} — mantido pelo poder público (SUS);</li>
 *   <li>{@link #PRIVADO} — iniciativa privada;</li>
 *   <li>{@link #FILANTROPICO} — entidades beneficentes/santos.</li>
 * </ul>
 */
public enum TipoEstabelecimento {
    PUBLICO,
    PRIVADO,
    FILANTROPICO
}
