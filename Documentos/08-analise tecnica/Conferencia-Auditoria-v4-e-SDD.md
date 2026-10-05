# Conferência da Auditoria Técnica v4.0 e da SDD de TanStack Query + Zustand

Documentos conferidos: [`Relatorio-Auditoria-Tecnica-v4.0.md`](./Relatorio-Auditoria-Tecnica-v4.0.md) e [`SDD-TanStack-Query-Zustand-v1.0.md`](./SDD-TanStack-Query-Zustand-v1.0.md). Os trechos de código da SDD são o desenho de referência; onde esta conferência aponta defeito, a implementação segue a correção descrita aqui. Na cópia versionada, os links `file:///` da máquina de origem foram trocados por caminhos relativos ao repositório.

Conferido contra `develop@5f451c1` (05/10/2026, depois do PR #182).

## 1. Achados da auditoria

| Achado | Veredito | Evidência na develop |
|---|---|---|
| `request()` copiado em 4 serviços, `HospitalService` sem `.status`/`.data` | **Procede** | `HospitalService.js` lança `new Error(message)` sem status; Visita/Feedback/Perfil anexam |
| `excluirConta()` não renova o token em 401 | **Procede** | `LoginService.excluirConta` usa `fetchComTimeout` direto, sem `renovarSessao` |
| Import circular `LoginService ↔ GeofencingTaskService ↔ Hospital/VisitaService` | **Procede** | comentário em `LoginService.js` linhas 4-12 |
| Bloco 401 → refresh → logout copiado 5 vezes | **Procede** | 4 `request()` + `baixarComToken` do PDF |
| Heartbeat e `sincronizarVisitaAtiva` só alimentados pela Home | **Procede (bug real)** | únicos chamadores em `HomeScreen.js`; check-in manual em Hospitais/Detalhe não sincroniza |
| `buscarAtiva()` chamado por Home, Hospitais e Detalhe a cada foco | **Procede** | 3 chamadores independentes |
| Contagem de `useState`/refs por tela | **Procede** (±1) | Hospitais 12 `useState` + 5 refs; Ranking 9 + 2 refs |
| Logout pelo interceptor não avisa nenhuma tela | **Procede** | não há estado global de sessão |
| Heartbeat sem `AppState` e primeiro envio só depois de 30 min | **Procede** | `setInterval` sem envio imediato |
| `console.warn` "não existe em release" | **Parcial** | existe (vai para o logcat), mas ninguém vê: a conclusão (falha silenciosa) vale |
| Dois lockfiles (`package-lock.json` e `yarn.lock`) | **Não procede** | só existe `frontend/package-lock.json` |
| APK de 47 MB na raiz | **Parcial** | `frontend/saude-monitor-preview.apk` está versionado via Git LFS (ponteiro de 133 bytes) |
| `checkJs: false`, zero `.ts` | **Procede** | `tsconfig.json` |
| `lint --max-warnings 16` | **Procede** | `package.json` |
| Textos sem acento | **Procede** | "Atencao" no Login, "Permissao de localizacao negada." no contexto de GPS |
| `TouchableOpacity` em telas | **Procede** | 7 telas (User, EsqueciSenha, Login, ConfirmarEmail, Mapa, Privacidade, Perfil) |

A auditoria cita o ADR-004 só de passagem. O ADR-004 (em [`adrs.md`](./adrs.md)) decidiu por Context API; a SDD reverte essa decisão para Zustand. O ADR precisa ser atualizado para "Substituído" no PR que introduz o store.

## 2. Heartbeat de 30 min x GPS_INTERROMPIDO de 10 min (backend)

**A inconsistência é real.** `VisitaServiceImpl.processarGpsInterrompido` usa como último sinal o maior entre `ultimoHeartbeat` e `ultimaPosicaoEm`. O check-in grava `ultimoHeartbeat = agora`; depois disso, o próximo sinal só vem com o heartbeat de 30 min (e apenas com o app em primeiro plano, porque é `setInterval`). O job roda a cada 15 min e encerra a visita sem sinal há mais de 10 min.

Consequência: toda visita que dura mais de 10 a 25 minutos e não termina por checkout de geofence antes disso é encerrada como `GPS_INTERROMPIDO`, com `saida` igual ao último sinal (o check-in) e duração de poucos minutos. Isso afeta o tempo mediano de permanência (RN-15) e explica por que o PR #175 precisou aceitar feedback de visita `GPS_INTERROMPIDO`.

A regra de negócio também se contradiz: RN-06 (10 min sem GPS) e RN-23 (heartbeat a cada 30 min, SUSPEITA após 2 h) no `Documento-Negocial-v2.1`. A correção é decisão de negócio e fica fora da SDD.

## 3. Problemas nos trechos de código da SDD

1. **O ciclo de import não some, só muda de lugar.** `apiClient` importa `sessaoStore`, que importa `LoginService`, que importa `GeofencingTaskService`, que importa `HospitalService`/`VisitaService`, que importarão `apiClient`. A solução é injeção: o `apiClient` expõe `configurarSessao({ renovar, encerrar })` e o bootstrap registra as funções do `LoginService`.
2. **Persistência duplicada do usuário.** O `persist` do Zustand grava o usuário em `@saude_monitor:sessao_store`, além de `@saude_monitor:usuario` do `TokenStorage`. São duas cópias de dado pessoal que podem divergir. O logout feito fora da árvore (interceptor, task de geofencing) apagaria só uma delas. Proposta: sem `persist`; o store hidrata do `TokenStorage` no boot e é atualizado por quem grava tokens.
3. **`sincronizarVisitaAtiva(null)` na montagem.** O `useEffect` do `useSyncVisitaBackground` roda com `data` ainda `undefined` e passa `null`, o que apaga a visita persistida que o checkout em segundo plano precisa. A Home atual evita isso de propósito (comentário de 08/09). Só sincronizar com resposta do servidor (`isSuccess`).
4. **Perda de `entrada` e `hospitalId`.** A SDD chama `sincronizarVisitaAtiva(id)` com um argumento; a Home passa três (entrada e hospital vão para o checkout offline e o feedback).
5. **`setQueriesData` em `visitas.all` corrompe o histórico.** O check-in/checkout escreve `{ visita }` em todas as queries sob `["visitas"]`, inclusive `visitas.historico`, que é uma página.
6. **Retry multiplicado.** `fetchComRetry` já faz até 3 tentativas com backoff; o `retry` do QueryClient (até 2 a mais para erro sem status, que é o caso dos erros de rede) chega a 9 requisições e, em timeout, a mais de 1 minuto. O retry do Query deve ficar desligado para erros de conexão já classificados.
7. **Polling de 60 s da visita ativa** (`refetchInterval`) cria uma requisição por minuto por usuário com visita ativa, sem ganho para o heartbeat de 30 min. Não será adotado.
8. **Contradição sobre o logout.** A seção 6.4 faz `queryClient.clear()`; a tabela de riscos diz para limpar só `conta` e `visitas`. A implementação limpa só as chaves com dado pessoal.
9. **Ordem das fases diverge** entre a auditoria (0 a 8) e a SDD (0 a 4). A execução segue a ordem da SDD, com o `apiClient` separado como primeiro PR, como o próprio ADR-001 recomenda.

## 4. Ordem de execução (um PR por fase)

1. **Fase 0 (entregue, M-032):** `src/core/api/apiClient.js` + `ApiError`, os 4 serviços e o `excluirConta` migrados, refresh injetado no bootstrap (fim do ciclo de import).
2. **Fase 1 (entregue, M-033):** dependências `@tanstack/react-query` e `zustand`, `queryClient`, managers de foco/rede, `queryKeys`, `sessaoStore` e sessão reativa em Login/Perfil/Histórico.
3. **Fase 2:** visita ativa global (`VisitaAtivaSync` na raiz), corrigindo o bug do heartbeat.
4. **Fase 3:** leitura de Hospitais, Ranking, Detalhe e Mapa com Query.
5. **Fase 4:** check-in/checkout e feedback com `useMutation`.
