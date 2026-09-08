# Auditoria — Código Morto, Lógica Ambígua/Sobreposta e Erros Silenciosos

**Versão:** 1.0
**Data:** 08/09/2026
**Commit-base:** `27ee9e6` (branch `feature/e6-ux-detalhamento-hospitais`, após merge de `develop`)
**Escopo:** código-fonte completo do backend (`backend/src/main/java`, 138 arquivos) e do frontend
(`frontend/src`, 56 arquivos fora de teste) — **não** é revisão de diff, é varredura do estado atual.
**Motivação:** desconfiança relatada pelo PO — "a cada interação descubro lógicas ambíguas ou que se
sobrepõem a outras, pontos que dizem estar validados, mas não estão". Auditoria feita por dois agentes
independentes (um por área), cada um lendo o código-fonte por completo, não apenas amostras.

> Esta é a fonte única do plano de correção descrito aqui. Conforme as estórias forem corrigidas, o
> status abaixo é atualizado no mesmo PR que entrega a correção (mesma regra do `De-Para-Backlog-Features.md`
> §8: PR que entrega atualiza o status, no mesmo PR).

## Status geral (08/09/2026)

Os 19 achados estão corrigidos nos 4 PRs abaixo, todos abertos contra `develop`, aguardando merge:

| PR | Tema | Itens |
|---|---|---|
| [#98](https://github.com/GabrielVogado/saude-monitor/pull/98) | Backend — erros silenciosos críticos (P0) | 1-4 |
| [#99](https://github.com/GabrielVogado/saude-monitor/pull/99) | Backend — lógica duplicada e código morto (P2/P3) | 10-11, 14-16 |
| [#100](https://github.com/GabrielVogado/saude-monitor/pull/100) | Frontend — bugs de comportamento e telas mortas (P1) | 5-9 |
| [#101](https://github.com/GabrielVogado/saude-monitor/pull/101) | Frontend — lógica ambígua e código morto (P2/P3) | 12, 17-19 |

**Ordem de merge:** #98 antes de #99 — os dois tocam `UserServiceImpl.java`/`AuthServiceImpl.java`;
mergear fora de ordem gera conflito (documentado na descrição do #99). #100 e #101 são independentes
dos PRs de backend e entre si.

---

## Decisões do PO (08/09/2026)

1. **Estratégia de entrega:** vários PRs pequenos agrupados por tema, não um PR único.
2. **"Esqueci minha senha" (login):** não existe endpoint de reset de senha no backend. Decisão: remover
   o link agora (nada por trás dele) e registrar recuperação de senha como item de backlog futuro — é
   feature nova (endpoint + e-mail + token), fora do escopo de uma correção de bug.
3. **"Aprovar e cadastrar hospital" (moderação de sugestões, mobile):** a rota de destino não existe
   porque o CRUD de hospital migrou para o Painel Administrativo Web (F-11, adiado para P2, ainda não
   construído) — decisão já registrada em `De-Para-Backlog-Features.md` (E1-06) e no DoD de F-10
   (`Features-MVP-v2.1.md` linhas 1024-1025, itens nunca marcados como concluídos). Decisão: remover a
   tela de moderação do app mobile por enquanto. **Achado adicional que reforça a decisão:** a tela
   `SugestoesPendentesScreen` está registrada em `App.js` mas nenhum ponto do app navega até ela — nem
   o menu do Perfil. Já está inacessível hoje; a remoção não tira nada que esteja em uso.

---

## Legenda de prioridade

| Prioridade | Critério |
|---|---|
| **P0 — Crítico** | Mascara falha real como sucesso, ou afirma uma ação (segurança/LGPD) que não acontece de fato |
| **P1 — Alto** | Comportamento real errado, visível ao usuário ou ao sistema, sem mascarar sucesso |
| **P2 — Médio** | Lógica duplicada/ambígua que pode divergir silenciosamente se um dos pontos mudar sem o outro |
| **P3 — Baixo** | Código morto sem efeito em runtime hoje — risco é confundir quem ler/editar o código depois |

---

## Plano de correção (ordem de execução)

| # | Prior. | Área | Achado | PR | Status |
|---|---|---|---|---|---|
| 1 | P0 | Backend | Cadastro com e-mail duplicado devolve HTTP 201 com `success:false` no corpo | PR-1 | ✅ Corrigido (aguardando PR) |
| 2 | P0 | Backend | `catch (RuntimeException)` genérico no logout mascara falha real de revogação como sucesso | PR-1 | ✅ Corrigido (aguardando PR) |
| 3 | P0 | Backend | Seed do admin com senha vazia sobe sem erro nem aviso | PR-1 | ✅ Corrigido (aguardando PR) |
| 4 | P0 | Backend | Exclusão de conta (LGPD) afirma remover `auth_logins`, coleção nunca escrita (`AuthDocument` morto) | PR-1 | ✅ Corrigido (aguardando PR) |
| 5 | P1 | Frontend | `pararGeofencing()` nunca chamado no logout/exclusão de conta | PR-3 | ✅ Corrigido (aguardando merge) |
| 6 | P1 | Frontend | `feedbackAvaliavel()` (expiração 24h, RN-09) nunca aplicada no cliente | PR-3 | ✅ Corrigido (aguardando merge) |
| 7 | P1 | Frontend | "Esqueci minha senha" sem `onPress` | PR-3 | ✅ Corrigido — link removido (aguardando merge) |
| 8 | P1 | Frontend | Botão "Voltar" do cadastro sem `onPress` e com ícone trocado | PR-3 | ✅ Corrigido (aguardando merge) |
| 9 | P1 | Frontend | Moderação de sugestões navega para rota inexistente e já é inacessível | PR-3 | ✅ Corrigido — telas removidas (aguardando merge) |
| 10 | P2 | Backend | Regra RN-17 (cobertura GPS ≥ 90%) implementada duas vezes de forma independente | PR-2 | ✅ Corrigido (aguardando merge) |
| 11 | P2 | Backend | Normalização de e-mail reimplementada em 4 lugares (uma delas sem `trim()`) | PR-2 | ✅ Corrigido — 5 pontos (achado extra: `AdminUserSeeder`) (aguardando merge) |
| 12 | P2 | Frontend | Critério "avaliação suficiente" com acoplamento implícito entre card e detalhe | PR-4 | ✅ Corrigido (aguardando merge) |
| 13 | P2 | Frontend | Formatação de data divergente em `SugestoesPendentesScreen` | — | ✅ Resolvido pela remoção do item 9 |
| 14 | P3 | Backend | `VisitaRepository` — 2 métodos de busca nunca chamados | PR-2 | ✅ Corrigido (aguardando merge) |
| 15 | P3 | Backend | `HospitalRepository.existsByCnpj` nunca chamado | PR-2 | ✅ Corrigido (aguardando merge) |
| 16 | P3 | Backend | Claim `papel` gravado no JWT mas nunca lido de volta | PR-2 | ✅ Corrigido — achado extra: claim `userId` também removido (aguardando merge) |
| 17 | P3 | Frontend | `CSHospitalCard.distanciaKm` — prop existe, nunca é alimentada | PR-4 | ✅ Corrigido (aguardando merge) |
| 18 | P3 | Frontend | `CSRatingStars.showLabel` — nunca ativado por nenhum chamador | PR-4 | ✅ Corrigido (aguardando merge) |
| 19 | P3 | Frontend | `CSHeader.subtitle` — prop nunca usada | PR-4 | ✅ Corrigido (aguardando merge) |

---

## Detalhamento dos achados

### P0.1 — Cadastro duplicado devolve 201 (sucesso) com corpo de falha
**Arquivo:** `backend/.../auth/controller/AuthController.java:44`, `.../user/service/impl/UserServiceImpl.java:62-79`
**Cenário de falha:** `AuthController.registro` sempre retorna `HttpStatus.CREATED`, mesmo quando
`saveUser` detecta e-mail duplicado e retorna `UserResponse(success=false, ...)`. Qualquer cliente que
decida sucesso/erro pelo código HTTP (padrão comum) trata uma tentativa de recadastro como "conta criada".
Diferente do resto do domínio (hospital duplicado, CNPJ duplicado, feedback duplicado — todos 409
`CONFLITO`), aqui a duplicidade não é uma exceção.
**Correção:** `saveUser` passa a lançar `ConflitoException` (409, mesmo padrão já usado em todo o domínio)
em vez de retornar um `UserResponse` de sucesso falso. O app mobile já trata `!response.ok` como erro
(`UserService.js:49`), então o comportamento visível ao usuário não muda — a correção é para o contrato
da API, hoje divergente da própria especificação (`Especificacao-API-v2.1.md` §1.2, "Violação de
unicidade" = `CONFLITO`/409).

### P0.2 — Logout mascara falha real de revogação como sucesso
**Arquivo:** `backend/.../auth/service/impl/AuthServiceImpl.java:98-111`
**Cenário de falha:** o `catch (RuntimeException ex)` assume que a única causa possível é chave duplicada
(jti já revogado, esperado em logout repetido), mas captura qualquer `RuntimeException`, inclusive falha
de conexão/timeout do Mongo. `logout()` sempre devolve 200 "sessão encerrada", mesmo quando a revogação
não foi persistida — o refresh token continua válido por até 30 dias sem que ninguém saiba.
**Correção:** restringir o `catch` à causa realmente esperada (chave duplicada — `DuplicateKeyException`
do Spring Data Mongo), deixando qualquer outra `RuntimeException` propagar para o handler genérico (500),
que já loga o erro.

### P0.3 — Seed do admin com senha vazia sobe sem aviso
**Arquivo:** `backend/.../user/seed/AdminUserSeeder.java:45`
**Cenário de falha:** se `app.seed-admin.senha` não estiver configurada, o seeder grava um hash BCrypt de
string vazia e loga "criado com sucesso" — sem warning, sem falha de boot. Em um deploy onde a variável
foi esquecida, o time só descobre que está sem acesso administrativo ao tentar logar (a senha vazia é
barrada pela validação de login, então o admin fica de fato trancado para fora, sem sinal nenhum no boot).
**Correção:** se `email` estiver configurado mas `senha` não, falhar o boot com mensagem explícita (ou, no
mínimo, logar `ERROR` em vez de `INFO` e não criar o usuário) — decisão técnica, não de produto, então
implementada diretamente.

### P0.4 — Exclusão de conta (LGPD) afirma remover dado que nunca existiu
**Arquivo:** `backend/.../user/service/impl/UserServiceImpl.java:200`, `.../auth/document/AuthDocument.java`,
`.../auth/repository/AuthRepository.java`
**Cenário de falha:** `excluirConta()` chama `authRepository.deleteByUser_Id(usuarioId)` e loga "Dados
pessoais removidos" — mas nenhum `AuthDocument` é escrito em lugar nenhum do sistema (busca completa por
`authRepository.save`/`.insert`/`AuthDocument.builder()` não encontrou nenhuma ocorrência). A chamada é
um no-op permanente. Se essa alegação for usada para responder a uma auditoria LGPD sobre o que é
efetivamente apagado, a resposta estaria errada.
**Correção:** remover a chamada morta, a classe `AuthDocument`, o `AuthRepository` e a menção a
"auth_logins" no comentário/log — documentar apenas o que `excluirConta()` de fato faz (remove `users`,
anonimiza `visitas`/`feedbacks`). Escrever a trilha de auditoria de login de verdade é uma feature nova
(fora do escopo desta correção) e fica registrada como item de backlog, não implementada aqui.

### P1.1 — `pararGeofencing()` nunca chamado no logout/exclusão de conta
**Arquivo:** `frontend/src/screens/visitas/service/GeofencingTaskService.js:326-338`,
`frontend/src/screens/perfil/service/PerfilService.js:245-247`
**Cenário de falha:** nem o logout nem a exclusão de conta param o monitoramento nativo de geofence — ele
continua rodando e pode confirmar entrada/saída de hospital depois que a conta foi encerrada (a visita
vira anônima via `dispositivoId`, sem que ninguém tenha pedido isso).
**Correção:** chamar `pararGeofencing()` no fluxo de logout e de exclusão de conta.

### P1.2 — `feedbackAvaliavel()` (expiração 24h, RN-09) nunca aplicada no cliente
**Arquivo:** `frontend/src/screens/feedback/service/FeedbackNotificationService.js:144-154`, `App.js:160-178`
**Cenário de falha:** a única função do módulo que aplica a janela de 24h e limpa pendência vencida do
`AsyncStorage` só é exercitada em teste. Em produção, o app abre o formulário de feedback checando apenas
`pendencia?.visitaId === data.visitaId`, sem checar a janela de 24h — o usuário pode preencher um
formulário inteiro e só descobrir que expirou ao tentar enviar (o backend responde 404, tratado em
`FeedbackFormScreen.js:244-245`).
**Correção:** usar `feedbackAvaliavel()` antes de abrir o formulário a partir de notificação/pendência
salva, evitando abrir um formulário que vai falhar de antemão.

### P1.3 — "Esqueci minha senha" sem `onPress`
**Arquivo:** `frontend/src/screens/login/view/LoginScreen.js:121-126`
**Decisão do PO:** remover o link agora; recuperação de senha vira item de backlog futuro.

### P1.4 — Botão "Voltar" do cadastro sem `onPress` e com ícone trocado
**Arquivo:** `frontend/src/screens/user/view/UserScreen.js:82-86`
**Correção:** adicionar `onPress={() => navigation.goBack()}` e trocar o ícone `ArrowRight` por `ArrowLeft`.

### P1.5 — Moderação de sugestões quebrada e inacessível
**Arquivo:** `frontend/App.js` (rotas `SugestoesPendentes`/`RevisarSugestao`),
`frontend/src/screens/hospitais/view/SugestoesPendentesScreen.js`,
`frontend/src/screens/hospitais/view/RevisarSugestaoScreen.js`
**Decisão do PO:** remover as duas telas e suas rotas do app mobile. Endpoints de backend
(`aprovar`/`rejeitar`/`sugestoes`) continuam intactos — são a base do futuro Painel Administrativo Web
(F-11). A tela pública de sugestão (`SugerirHospitalScreen`, E1-05) não é afetada.

### P2.1 — Regra RN-17 (cobertura GPS ≥ 90%) duplicada
**Arquivo:** `backend/.../agregado/service/EstatisticaService.java:74-90` (testado, nunca chamado em
produção) vs. `backend/.../agregado/service/impl/AgregadoServiceImpl.java:180-194` (o que roda de fato).
**Cenário de falha:** se o limiar for alterado em um lugar e não no outro, os testes de
`EstatisticaServiceTest` continuam "verdes" provando uma regra que já divergiu do comportamento real.
**Correção:** `AgregadoServiceImpl.tempoConfiável` passa a chamar `EstatisticaService.coberturaGpsConfiável`
em vez de reimplementar o cálculo inline — uma única fonte de verdade, coberta pelo teste que já existe.

### P2.2 — Normalização de e-mail duplicada em 4 lugares
**Arquivo:** `AuthServiceImpl.normalizeEmail`, `UserServiceImpl.normalizeEmail`,
`CustomUserDetailsService.normalizeEmail`, `AutenticacaoHelper.usuarioIdAtual` (esta última sem `.trim()`).
**Cenário de falha:** um e-mail com espaço à direita que escape do trim em algum ponto pode fazer um
usuário autenticado (token válido) não ser encontrado nas consultas que usam `AutenticacaoHelper`.
**Correção:** extrair um único método utilitário (`EmailNormalizer` ou método estático em local
compartilhado) e usá-lo nos 4 pontos.

### P2.3 — Critério "avaliação suficiente" com acoplamento implícito
**Arquivo:** `frontend/src/components/CSHospitalCard.js:46-49` vs.
`frontend/src/screens/hospitais/view/HospitalDetalheScreen.js:241-245`
**Cenário de falha:** o detalhe usa `indicadoresDisponiveis !== false` além de `nAvaliacoes >= 5`; hoje os
dois concordam porque o backend deriva um campo do outro, mas isso é acoplamento implícito não garantido
pelo contrato do card. Se o backend um dia zerar `indicadoresDisponiveis` por outro motivo mantendo
`notaMedia`/`nAvaliacoes` preenchidos, a lista voltaria a mostrar nota onde o detalhe esconde.
**Correção:** extrair a regra para uma função pura compartilhada (`avaliacaoSuficiente(indicadores)`) usada
nos dois componentes, eliminando a possibilidade de reimplementação divergente.

### P3 — Código morto (sem efeito em runtime hoje)
Remoção direta, sem mudança de comportamento:
- `VisitaRepository.findFirstByUsuarioIdAndHospitalIdAndStatusInOrderByEntradaDesc` e
  `findFirstByDispositivoIdAndHospitalIdAndStatusInOrderByEntradaDesc` (nunca chamados).
- `HospitalRepository.existsByCnpj` (nunca chamado; `validarUnicidade` usa `findByCnpj`).
- Claim `papel` no JWT (`JwtService.java:34,110`) — a autorização real busca o papel fresco no Mongo
  (`CustomUserDetailsService.java:32`), o claim nunca é lido de volta.
- `CSHospitalCard.distanciaKm` — nenhum dos dois chamadores (`HospitaisScreen`, `RankingScreen`) passa
  essa prop.
- `CSRatingStars.showLabel`/`labelMap` — nenhum dos dois usos do componente ativa esse rótulo.
- `CSHeader.subtitle` — nenhum dos 9 usos do componente passa essa prop.

---

## Achados investigados e descartados (sem evidência de problema real)

- Backend: nenhum `catch` vazio sem log encontrado; regra de geofence (point-in-polygon) tem uma única
  implementação via `$geoIntersects`; critério de "avaliação suficiente" está centralizado em
  `AgregadoServiceImpl` no backend (a divergência histórica dos PRs #94/#95 era só no frontend).
- Frontend: nenhum estado de `error`/`loading` computado e nunca exibido na UI; os padrões `catch {}`
  existentes nos services de rede são conscientes e documentados (fallback de JSON inválido, best-effort
  de logout, limitação já assumida da fila offline).
