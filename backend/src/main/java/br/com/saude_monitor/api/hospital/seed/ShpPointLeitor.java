package br.com.saude_monitor.api.hospital.seed;

import org.springframework.stereotype.Component;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Lê as coordenadas (X=longitude, Y=latitude) de um shapefile {@code .shp} ESRI.
 *
 * <p>Implementação leve e sem dependências (evita o GeoTools, que é desnecessariamente
 * pesado e acopla-se à versão do Java para ler apenas pontos). Suporta os shape types
 * {@code 1} (Point) e {@code 11} (PointZ) usados nas camadas de estabelecimentos do DF;
 * descarta Z/M. Projeção WGS84/EPSG:4326 (X=longitude, Y=latitude) — sem reprojeção.</p>
 *
 * <p>O formato é binário e bem documentado:</p>
 * <ul>
 *   <li>cabeçalho de 100 bytes (file code 9994, shape type, bbox);</li>
 *   <li>registros com cabeçalho de 8 bytes (número + tamanho em words, big-endian) e
 *       conteúdo com shape type (int32 LE) seguido de X e Y (double LE).</li>
 * </ul>
 *
 * <p>Registros nulos (shape type 0) ou truncados retornam {@code null} na lista — o
 * seed os descarta, assim como o pipeline ETL de referência.</p>
 */
@Component
public class ShpPointLeitor {

    /**
     * Lê todos os pontos do shapefile na ordem dos registros.
     * A ordem é 1:1 com os registros do DBF correspondente (pareamento por índice).
     */
    public List<double[]> ler(Path arquivo) {
        try (InputStream raw = new BufferedInputStream(Files.newInputStream(arquivo))) {
            // Cabeçalho principal (100 bytes): file code, versão, shape type, bbox, Z/M.
            skipFully(raw, 100);

            List<double[]> pontos = new ArrayList<>();
            byte[] cabecalho = new byte[8];
            while (true) {
                int lidos = raw.read(cabecalho);
                if (lidos < cabecalho.length) {
                    break; // fim do arquivo (ou cauda truncada)
                }
                int contentWords = bigInt(cabecalho, 4); // tamanho do conteúdo em words de 16 bits
                byte[] content = new byte[contentWords * 2];
                readFully(raw, content);

                if (content.length < 20) {
                    pontos.add(null); // registro nulo/truncado: sem geometria
                    continue;
                }
                int shapeType = littleInt(content, 0);
                if (shapeType == 0) {
                    pontos.add(null); // null shape
                    continue;
                }
                double x = littleDouble(content, 4);   // longitude
                double y = littleDouble(content, 12);  // latitude
                pontos.add(new double[]{x, y});
            }
            return pontos;

        } catch (IOException e) {
            throw new IllegalArgumentException("Falha ao ler o SHP: " + arquivo, e);
        }
    }

    private static void skipFully(InputStream in, int n) throws IOException {
        int restantes = n;
        while (restantes > 0) {
            long pulados = in.skip(restantes);
            if (pulados <= 0) {
                if (in.read() < 0) {
                    throw new IOException("SHP truncado (cabeçalho incompleto)");
                }
                restantes--;
            } else {
                restantes -= (int) pulados;
            }
        }
    }

    private static void readFully(InputStream in, byte[] buf) throws IOException {
        int offset = 0;
        while (offset < buf.length) {
            int lidos = in.read(buf, offset, buf.length - offset);
            if (lidos < 0) {
                throw new IOException("SHP truncado (registro incompleto)");
            }
            offset += lidos;
        }
    }

    /** Big-endian int32 (cabeçalho do registro). */
    private static int bigInt(byte[] b, int offset) {
        return ((b[offset] & 0xFF) << 24)
                | ((b[offset + 1] & 0xFF) << 16)
                | ((b[offset + 2] & 0xFF) << 8)
                | (b[offset + 3] & 0xFF);
    }

    /** Little-endian int32 (shape type do conteúdo). */
    private static int littleInt(byte[] b, int offset) {
        return (b[offset] & 0xFF)
                | ((b[offset + 1] & 0xFF) << 8)
                | ((b[offset + 2] & 0xFF) << 16)
                | ((b[offset + 3] & 0xFF) << 24);
    }

    /** Little-endian double (X/Y do conteúdo). */
    private static double littleDouble(byte[] b, int offset) {
        long bits = 0L;
        for (int i = 7; i >= 0; i--) {
            bits = (bits << 8) | (b[offset + i] & 0xFFL);
        }
        return Double.longBitsToDouble(bits);
    }
}
