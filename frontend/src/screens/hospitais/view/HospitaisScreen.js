import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { MapPinOff, Search, Trophy } from "lucide-react-native";
import {
  CSHeader,
  CSHospitalCard,
  CSEmptyState,
  CSLoadingList,
  CSChip,
  CSTextField,
  CSIconButton,
} from "../../../components";
import { colors, spacing } from "../../../theme/tokens";
import HospitalService from "../service/HospitalService";
import VisitaService from "../../visitas/service/VisitaService";
import { normalizeText } from "../../../utils/normalize";
import { avisarSemConexao, preservarSeSemConexao } from "../../../utils/alertas";

const TIPO_FILTROS = [
  { value: "", label: "Todos" },
  { value: "PUBLICO", label: "Público" },
  { value: "PRIVADO", label: "Privado" },
  { value: "FILANTROPICO", label: "Filantrópico" },
];

// O backend limita `size` a 100 por chamada (HospitalController) e a base tem ~340
// hospitais ativos — uma única página nunca traz o catálogo inteiro. 50 é o meio-termo
// entre poucas chamadas e uma resposta que ainda cabe confortavelmente numa página.
const TAMANHO_PAGINA = 50;

/**
 * Listagem pública de hospitais ativos (E1-03).
 *
 * Navegação revisada: cada card ganhou um botão compacto de check-in manual. Ao tocar
 * em "Check-in", o app registra a visita (origem MANUAL) e redireciona para o
 * `HospitalDetalhe`, que exibe o temporizador e o botão de checkout quando a visita
 * ativa é do modo manual. O corpo do card (fora do botão) continua abrindo o detalhe
 * como antes.
 */
export default function HospitaisScreen({ navigation }) {
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("");
  const [dados, setDados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [erro, setErro] = useState(null);

  // Paginação incremental (E1-03 / bug relatado em 09/09/2026): sem isso, a lista
  // pública mostrava só os primeiros 20 hospitais (o `size` padrão do serviço) e o
  // usuário nunca via os ~320 restantes a menos que buscasse pelo nome exato.
  const [pagina, setPagina] = useState(0);
  const [temMais, setTemMais] = useState(false);
  const [carregandoMais, setCarregandoMais] = useState(false);

  const [visitaAtiva, setVisitaAtiva] = useState(null);
  const [checkinEnviandoId, setCheckinEnviandoId] = useState(null);

  // Pedido do PO (10/09/2026): o hospital do check-in ativo deve aparecer no topo,
  // sem precisar procurá-lo na lista paginada (~340 hospitais, 50 por página, ordem
  // alfabética — o hospital ativo pode estar em qualquer página, inclusive uma ainda
  // não carregada pelo scroll infinito). Buscado à parte, não depende de `dados`.
  const [hospitalCheckinAtivo, setHospitalCheckinAtivo] = useState(null);

  const debounceRef = useRef(null);
  const carregamentoInicialFeitoRef = useRef(false);

  // Geração da carga atual: `carregar()` incrementa a cada chamada (busca/tipo
  // mudou, ou refresh). Uma `carregarMais()` cuja resposta chega depois de uma
  // geração mais nova descarta o resultado em vez de concatenar a página de um
  // critério de busca que já não é o vigente (code-review de 09/09/2026).
  const geracaoRef = useRef(0);
  // Guard de reentrância síncrono: `carregandoMais` (estado) só reflete no próximo
  // render, então dois disparos de `onEndReached` antes desse commit passariam os
  // dois pelo guard baseado em estado e pediriam a mesma página duas vezes. O ref
  // bloqueia imediatamente, sem esperar o React re-renderizar.
  const buscandoMaisRef = useRef(false);

  /** Filtro defensivo no cliente: garante consistência acento/caixa mesmo que o
   * backend devolva itens fora do critério (ex.: dados legados sem normalização). */
  const filtrarLocalmente = useCallback((lista, termo) => {
    return termo
      ? lista.filter((hospital) => normalizeText(hospital?.nome).includes(termo))
      : lista;
  }, []);

  const carregar = useCallback(async (modo = "inicial") => {
    const minhaGeracao = ++geracaoRef.current;

    if (modo === "refresh") setRefreshing(true);
    else setCarregando(true);
    setErro(null);

    try {
      // Normaliza a busca (acento/caixa) antes de enviar ao backend e de filtrar localmente.
      const termo = normalizeText(busca);
      const resposta = await HospitalService.listar({ busca: termo, tipo, page: 0, size: TAMANHO_PAGINA });
      if (geracaoRef.current !== minhaGeracao) {
        return;
      }

      const lista = resposta?.content || resposta || [];
      const filtrados = filtrarLocalmente(lista, termo);

      setDados(filtrados);
      setPagina(0);
      const total = resposta?.totalElements ?? lista.length;
      setTemMais(lista.length > 0 && lista.length < total);
    } catch (e) {
      if (geracaoRef.current === minhaGeracao) {
        setErro(e.message || "Não foi possível carregar os hospitais.");
      }
    } finally {
      if (geracaoRef.current === minhaGeracao) {
        setCarregando(false);
        setRefreshing(false);
      }
    }
  }, [busca, tipo, filtrarLocalmente]);

  // Chamado pela FlatList ao chegar perto do fim (`onEndReached`) — busca a próxima
  // página e concatena, sem recarregar nem perder a posição do scroll.
  const carregarMais = useCallback(async () => {
    if (!temMais || carregando || buscandoMaisRef.current) {
      return;
    }

    buscandoMaisRef.current = true;
    const minhaGeracao = geracaoRef.current;
    setCarregandoMais(true);
    try {
      const termo = normalizeText(busca);
      const proximaPagina = pagina + 1;
      const resposta = await HospitalService.listar({
        busca: termo,
        tipo,
        page: proximaPagina,
        size: TAMANHO_PAGINA,
      });
      if (geracaoRef.current !== minhaGeracao) {
        // A busca/tipo mudou (ou um refresh rodou) enquanto esta página estava em
        // voo — aplicar agora concatenaria a página errada numa lista que já foi
        // resetada para outro critério.
        return;
      }

      const lista = resposta?.content || resposta || [];
      const filtrados = filtrarLocalmente(lista, termo);

      setDados((atual) => atual.concat(filtrados));
      setPagina(proximaPagina);
      const jaCarregado = (proximaPagina + 1) * TAMANHO_PAGINA;
      const total = resposta?.totalElements ?? jaCarregado;
      setTemMais(lista.length > 0 && jaCarregado < total);
    } catch {
      // Mantém a lista já visível; o usuário pode rolar até o fim de novo para
      // tentar a próxima página outra vez, sem perder o que já carregou.
    } finally {
      buscandoMaisRef.current = false;
      if (geracaoRef.current === minhaGeracao) {
        setCarregandoMais(false);
      }
    }
  }, [temMais, carregando, busca, tipo, pagina, filtrarLocalmente]);

  useEffect(() => {
    if (!carregamentoInicialFeitoRef.current) {
      carregamentoInicialFeitoRef.current = true;
      carregar();
      return undefined;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => carregar(), 400);
    return () => clearTimeout(debounceRef.current);
  }, [carregar]);

  // Reidrata a visita ativa ao focar a aba (e ao voltar do detalhe) para refletir o
  // estado do botão de check-in por hospital (modo anônimo via dispositivoId, §3.3).
  // Sem conexão não é "sem visita ativa" — ver `preservarSeSemConexao`, incluindo a
  // limitação conhecida sobre a janela entre reconectar e a fila sincronizar.
  const atualizarVisitaAtiva = useCallback(() => {
    VisitaService.buscarAtiva()
      .then((data) => setVisitaAtiva(data?.visita || null))
      .catch((e) => preservarSeSemConexao(e, setVisitaAtiva));
  }, []);

  useFocusEffect(
    useCallback(() => {
      atualizarVisitaAtiva();
    }, [atualizarVisitaAtiva])
  );

  // Busca o hospital do check-in ativo independente da paginação de `dados` — ele
  // pode estar em qualquer página, carregada ou não. Falha silenciosa de propósito
  // (ex.: sem conexão): a lista continua funcionando normalmente, só sem o destaque.
  useEffect(() => {
    const hospitalId = visitaAtiva?.hospitalId;
    if (!hospitalId) {
      setHospitalCheckinAtivo(null);
      return undefined;
    }

    let cancelado = false;
    HospitalService.buscarPorId(hospitalId)
      .then((hospital) => {
        if (!cancelado) setHospitalCheckinAtivo(hospital);
      })
      .catch(() => {
        if (!cancelado) setHospitalCheckinAtivo(null);
      });

    return () => {
      cancelado = true;
    };
  }, [visitaAtiva?.hospitalId]);

  // Hospital do check-in ativo primeiro, sem duplicá-lo caso já esteja em `dados`
  // (página carregada por acaso contém o mesmo hospital, ordem alfabética).
  const dadosComDestaque = useMemo(() => {
    if (!hospitalCheckinAtivo) {
      return dados;
    }
    const semODuplicado = dados.filter((h) => h.id !== hospitalCheckinAtivo.id);
    return [hospitalCheckinAtivo, ...semODuplicado];
  }, [dados, hospitalCheckinAtivo]);

  // ARQ-05 / code-review de 03/09/2026: a expressão de função nomeada `checkin` abaixo
  // congela o closure. Se a visita ativa chegar (buscarAtiva resolvendo) DEPOIS que o
  // alerta de conflito 409 apareceu, o toque no candidato reentraria com
  // `visitaAtiva === null` e furaria o guard de "check-in ativo", abrindo uma segunda
  // visita. O ref carrega o valor corrente para dentro da recursão.
  const visitaAtivaRef = useRef(visitaAtiva);
  useEffect(() => {
    visitaAtivaRef.current = visitaAtiva;
  }, [visitaAtiva]);

  const abrirDetalhe = useCallback(
    (hospital) => {
      navigation.navigate("HospitalDetalhe", { id: hospital.id });
    },
    [navigation]
  );

  // ARQ-05: `fazerCheckin` e `tratarConflitoGeofence` se chamavam mutuamente, o que
  // impediria memoizar as duas (dependência circular entre dois useCallback). A
  // expressão de função nomeada `checkin` resolve a recursão sem ref auxiliar nem
  // efeito, e o tratamento do 409 passa a viver no único lugar que o dispara.
  const fazerCheckin = useCallback(
    async function checkin(hospital) {
      const ativa = visitaAtivaRef.current;
      if (ativa) {
        if (ativa.hospitalId === hospital.id) {
          navigation.navigate("HospitalDetalhe", { id: hospital.id });
        } else {
          Alert.alert(
            "Check-in ativo",
            "Você já tem uma visita em andamento em outro hospital. Finalize-a antes de começar outra."
          );
        }
        return;
      }

      setCheckinEnviandoId(hospital.id);
      setErro(null);
      try {
        const resposta = await VisitaService.checkin({
          hospitalId: hospital.id,
          origem: "MANUAL",
        });
        setVisitaAtiva({ ...resposta, origem: "MANUAL" });
        // Redireciona ao detalhe do hospital, que exibe o temporizador + checkout
        // (específico do check-in manual).
        setCheckinEnviandoId(null);
        navigation.navigate("HospitalDetalhe", { id: hospital.id });
      } catch (e) {
        setCheckinEnviandoId(null);
        if (e.status === 409 && e.data?.candidatos?.length) {
          const conflito = e.data;
          Alert.alert(
            "Qual hospital é este?",
            conflito.message || "Encontramos mais de um hospital nesta localização.",
            [
              ...conflito.candidatos.map((candidato) => ({
                text: candidato.nome,
                onPress: () => checkin({ id: candidato.hospitalId, nome: candidato.nome }),
              })),
              { text: "Cancelar", style: "cancel" },
            ]
          );
          return;
        }
        if (e.enfileirado) {
          // Sem conexão, o check-in foi guardado para sincronizar depois (OPS-05) —
          // não é uma falha, então o alerta não pode soar como uma. Fica na lista em
          // vez de navegar para o detalhe, que dependeria da mesma rede indisponível.
          //
          // Marca a visita como ativa AQUI, localmente: arma o guard de "uma visita
          // por vez" (visitaAtivaRef, acima) antes da fila sincronizar. Janela residual
          // e decisão de aceitá-la documentadas em `preservarSeSemConexao`
          // (utils/alertas.js) — o `id: null` é substituído pelo real quando
          // `atualizarVisitaAtiva` rodar de novo (foco da aba).
          setVisitaAtiva({ id: null, hospitalId: hospital.id, origem: "MANUAL" });
          avisarSemConexao(e.message);
          return;
        }
        Alert.alert("Check-in", e.message || "Não foi possível fazer o check-in.");
      }
    },
    // `visitaAtiva` sai da lista de propósito: o guard passou a ler o ref, então a
    // função não precisa mais ser recriada a cada mudança de visita -- fica estável
    // para o renderItem memoizado abaixo. O exhaustive-deps confirma que é dependência
    // desnecessária.
    [navigation]
  );

  // ARQ-05: extraido do JSX e memoizado. Inline, ele criava uma funcao nova a cada
  // render da tela, e com ela um `onPress`/`onCheckin` novo por item -- o que anularia
  // o React.memo do CSHospitalCard por identidade de prop.
  const renderItem = useCallback(
    ({ item }) => (
      <CSHospitalCard
        hospital={item}
        onPress={abrirDetalhe}
        onCheckin={fazerCheckin}
        checkinLoading={checkinEnviandoId === item.id}
        checkinAtivo={visitaAtiva?.hospitalId === item.id}
        checkinDesabilitado={
          (checkinEnviandoId !== null && checkinEnviandoId !== item.id) ||
          (visitaAtiva !== null && visitaAtiva.hospitalId !== item.id)
        }
      />
    ),
    [abrirDetalhe, fazerCheckin, checkinEnviandoId, visitaAtiva]
  );

  // ARQ-05 / achado do code-review: o ListEmptyComponent e renderizado como
  // <ListEmptyComponent /> pelo VirtualizedList, entao identidade nova = TIPO novo de
  // elemento, e o React desmonta e remonta a subarvore inteira. Sem isto, cada tecla
  // digitada numa busca sem resultado reconstruia o estado vazio do zero.
  const renderVazio = useCallback(() => {
    const temFiltro = busca.trim() || tipo;

    if (erro) {
      return (
        <CSEmptyState
          icon={MapPinOff}
          title="Algo deu errado"
          message={erro}
          actionLabel="Tentar novamente"
          onAction={() => carregar()}
        />
      );
    }

    if (temFiltro) {
      return (
        <CSEmptyState
          icon={MapPinOff}
          title="Nenhum hospital encontrado"
          message="Tente ajustar a busca ou o filtro."
        />
      );
    }

    return (
      <CSEmptyState
        icon={MapPinOff}
        title="Nenhum hospital por aqui"
        message="Sugira um hospital que ainda não esteja cadastrado."
        actionLabel="Sugerir hospital"
        onAction={() => navigation.navigate("SugerirHospital")}
      />
    );
  }, [busca, tipo, erro, carregar, navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <CSHeader
        title="Hospitais"
        rightAction={
          <CSIconButton
            icon={Trophy}
            onPress={() => navigation.navigate("Ranking")}
            accessibilityLabel="Abrir ranking de hospitais"
          />
        }
      />

      <View style={styles.searchArea}>
        <CSTextField
          value={busca}
          onChangeText={setBusca}
          placeholder="Buscar hospital por nome"
          icon={Search}
        />

        <View style={styles.chipsRow}>
          {TIPO_FILTROS.map((f) => (
            <CSChip
              key={f.value || "todos"}
              label={f.label}
              selected={tipo === f.value}
              onPress={() => setTipo(f.value)}
            />
          ))}
        </View>
      </View>

      {carregando ? (
        <CSLoadingList count={3} />
      ) : (
        <FlatList
          testID="lista-hospitais"
          data={dadosComDestaque}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderVazio}
          contentContainerStyle={styles.listContent}
          onEndReached={carregarMais}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            carregandoMais ? (
              <ActivityIndicator
                style={styles.rodapeCarregando}
                size="small"
                color={colors.primary}
                accessibilityLabel="Carregando mais hospitais"
              />
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => carregar("refresh")}
              tintColor={colors.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  searchArea: {
    padding: spacing.s4,
    gap: spacing.s3,
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s2,
  },
  listContent: {
    paddingHorizontal: spacing.s4,
    paddingBottom: spacing.s6,
    gap: spacing.s4,
    flexGrow: 1,
  },
  rodapeCarregando: {
    paddingVertical: spacing.s4,
  },
});
