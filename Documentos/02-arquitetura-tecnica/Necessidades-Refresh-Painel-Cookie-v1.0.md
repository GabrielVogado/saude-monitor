# Necessidades para o refresh do painel em cookie HttpOnly funcionar (item 7, ADR-013, SEG-05)

> | Campo | Valor |
> |---|---|
> | **Versão** | 1.0 |
> | **Data** | 09/11/2026 |
> | **Base** | branch `feature/refresh-painel-admin` (código do item 7 pronto, ainda sem PR) |
> | **Natureza** | Lista do que falta fora do código, ou depois dele, para o item 7 valer ponta a ponta. O que foi implementado está no [ADR-013](../08-analise%20tecnica/adrs.md), na [Especificação §3.1](./Especificacao-API-v2.4.md) e na M-071 do [Histórico de Melhorias](../09-melhoria-continua/Historico-Melhorias.md). |
> | **Fonte das dependências** | Guia técnico de pendências de 25/10/2026, itens 3, 7 e I4 |

---

## 1. Resumo

O código do item 7 está pronto: o backend emite o refresh do painel no cookie `__Host-painel_refresh` (`Secure`, `HttpOnly`, `SameSite=Strict`, `Path=/`), e o painel guarda o access token só em memória e recupera a sessão pelo cookie ao recarregar a aba. Isso foi medido com backend e painel locais, que para o navegador são o mesmo site.

Para funcionar em dev, homologação e produção falta **pôr o painel e a API no mesmo site**. Com `SameSite=Strict`, o navegador só guarda e só manda o cookie quando a página do painel e a API têm o mesmo domínio registrável. `run.app` está na Public Suffix List, então cada serviço do Cloud Run é um site diferente. Hoje o painel roda no `ng serve` (`localhost:4200`) chamando a API de dev em `…run.app`: o login funciona, mas o cookie é descartado, e o painel volta ao login ao recarregar a aba e quando o access token de 15 min vence.

Subir o item 7 antes disso não quebra nada: o app não muda e o painel não tem deploy publicado. Só a sessão do painel em dev fica mais curta até as necessidades abaixo serem atendidas.

---

## 2. Necessidades obrigatórias

### N1. Domínio próprio da API (item 3 do guia)

- Decisão P11 tomada (Cloudflare na frente ou load balancer do Google) e o item 3 entregue: `api.saudemonitor.dev` (produção), `api-hom.saudemonitor.dev` (homologação) e, se o painel de dev também for usar cookie, `api-dev.saudemonitor.dev`.
- HTTPS no domínio. O prefixo `__Host-` exige `Secure`: fora de HTTPS (e fora de `localhost`) o navegador recusa o cookie.

### N2. Painel publicado no mesmo site da API

- O painel não tem hospedagem hoje (não há CD do `admin/`). Precisa de uma, com um subdomínio do mesmo domínio da API, por ambiente: `admin.saudemonitor.dev` com `api.saudemonitor.dev`, `admin-hom.saudemonitor.dev` com `api-hom.saudemonitor.dev`.
- Opções de hospedagem do SPA: Cloudflare Pages (se P11 for Cloudflare), Firebase Hosting ou um Cloud Run com servidor estático. Qualquer uma serve, desde que fique sob o mesmo domínio.
- Workflow de CD do painel (`ng build` e publicação), que hoje não existe.
- O painel em subdomínio próprio continua sendo outra **origem** (o CORS continua necessário), mas passa a ser o mesmo **site** (o cookie funciona).

### N3. Endereço da API no painel por ambiente

- Hoje `admin/src/app/app.config.ts` fixa `API_BASE_URL` em `https://saude-monitor-backend-dev-…run.app`. Precisa passar a vir do ambiente (`environments/` do Angular ou substituição no build), apontando para o domínio da API do mesmo site do painel.

### N4. Variáveis do backend por ambiente

| Variável | Valor (exemplo para produção) | Onde |
|---|---|---|
| `APP_CORS_PAINEL_ORIGIN` | `https://admin.saudemonitor.dev` | `env_vars` do `cd-backend-google.yml`, por ambiente |
| `APP_CORS_ALLOWED_ORIGINS` | incluir `https://admin.saudemonitor.dev` (item 3, passo 6) | idem |

- `APP_CORS_PAINEL_ORIGIN` aceita **uma** origem exata, sem `*`, sem barra no fim e sem caminho. Valor fora disso impede a aplicação de subir (validado no startup), e o smoke test do deploy acusa.
- Sem a variável vale o padrão `http://localhost:4200`, que serve só para desenvolvimento local.
- O `env_vars` da action é sensível a vírgula (comentário no próprio workflow): `APP_CORS_PAINEL_ORIGIN` tem um valor só e não tem esse problema; `APP_CORS_ALLOWED_ORIGINS` é lista separada por vírgula e precisa do formato de delimitador do `gcloud` ao entrar no workflow.

### N5. Borda (item I4) sem atrapalhar o cookie

Se P11 for Cloudflare (Origin Rule ou Worker de proxy), conferir na borda:

- `Set-Cookie` repassado intacto na resposta de `/api/v1/auth/painel/**`, sem reescrever `Domain` (o `__Host-` proíbe `Domain`);
- cabeçalhos `Origin` e `X-Requested-With` repassados na requisição. Sem eles o backend responde 403 (defesa CSRF);
- preflight `OPTIONS` repassado ao backend, com `Access-Control-Allow-Credentials` na resposta;
- `/api/v1/auth/painel/**` fora de qualquer cache da borda;
- o cabeçalho secreto de borda do item 3 (passo 2) também nessas rotas, para o filtro de origem não as barrar.

### N6. Conta ADMIN em cada ambiente

- O login do painel só aceita o papel ADMIN, com e-mail confirmado. Hoje o seed de admin está desligado em todos os ambientes, porque `ADMIN_EMAIL` e `ADMIN_SENHA` não existem no Secret Manager (`deploy/google/README.md`).
- Para testar a homologação e a produção: criar os secrets e ligar o seed, ou promover uma conta existente a ADMIN direto no banco.

---

## 3. Decisões pendentes do PO (não bloqueiam o merge)

| # | Decisão | Efeito | Recomendação |
|---|---|---|---|
| D1 | Proxy do `ng serve` (`proxy.conf.json`) para o painel de dev chamar `/api` na própria origem | A sessão sobrevive ao recarregar já em dev, antes do item 3. Não afeta produção | Fazer, se a perda de sessão em dev incomodar; é o caminho 3 que o ADR-013 já prevê para dev |
| D2 | Nova tentativa do refresh ao recarregar quando a resposta for 503 ou erro de rede | Hoje um cold start do Cloud Run no recarregamento manda ao login mesmo com o cookie válido | Fazer; pequeno. O item 6 (boot mais rápido) reduz a frequência, mas não elimina |
| D3 | CSP estrita no painel (citada no SEG-05) | Segunda barreira contra XSS. O access token em memória ainda pode ser usado por um XSS durante a sessão aberta | Fazer junto com a hospedagem (N2), onde os cabeçalhos são definidos |
| D4 | Revogar o refresh anterior quando o admin faz login de novo com um cookie ainda válido | Hoje o refresh antigo fica inacessível (o cookie foi sobrescrito), mas válido até vencer | Baixa prioridade |

---

## 4. Risco encontrado na leitura do código, ainda sem correção

**Duas abas renovando ao mesmo tempo podem derrubar as duas.** As abas do mesmo navegador dividem o cookie. As chamadas simultâneas **dentro de uma aba** já viram uma renovação só, mas não há coordenação entre abas. Se duas abas recebem 401 no mesmo instante e as duas pedem `/painel/refresh` com o mesmo cookie:

1. a primeira renova e o backend revoga o refresh usado (rotação);
2. a segunda leva 401;
3. o interceptor dessa segunda aba chama o logout, que manda ao backend o cookie que está no navegador naquele momento. Esse cookie já é o novo, gravado pela primeira aba, e é revogado;
4. a primeira aba perde a sessão na próxima renovação.

O caso exige duas abas renovando no mesmo instante, por isso é raro. Ainda não foi reproduzido em navegador.

**Correção proposta, pequena e no próprio item 7:**

- quando a renovação falha, o interceptor encerra só a sessão local, sem chamar o logout do servidor (não há o que revogar);
- só o botão Sair revoga no servidor;
- opcional: coordenar a renovação entre abas com `BroadcastChannel`.

---

## 5. Critério de aceite em cada ambiente

Com N1 a N6 atendidas, no navegador e no ambiente publicado:

1. Login no painel → no DevTools (Application › Cookies, no domínio da API), cookie `__Host-painel_refresh` com `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/` e validade de 30 dias.
2. `sessionStorage` só com `admin.usuario`, sem nenhum token. `document.cookie` no console não mostra o refresh.
3. Recarregar a aba em uma rota protegida → continua na mesma tela, com `POST /api/v1/auth/painel/refresh` 200 na aba Rede.
4. Deixar o painel aberto mais de 15 min e usar → a chamada recebe 401, o painel renova sozinho e a tela carrega.
5. Sair → `POST /api/v1/auth/painel/logout` 200, o cookie some, e reabrir uma rota protegida leva ao login.
6. Conta USER no login do painel → mesma mensagem de senha errada, sem cookie.
7. `curl` em `/api/v1/auth/painel/refresh` com outra `Origin`, ou sem `X-Requested-With` → 403.
8. O app (Android) continua logando, renovando e saindo como antes.

Os itens 1, 2, 3, 5 e 7 já foram conferidos localmente em 05/11/2026, com backend e painel em `localhost`: 2, 3 e 5 no navegador embutido do app Claude (Chromium); 1 e 7 pelos cabeçalhos da resposta com `curl`.

---

## 6. Ordem sugerida

1. Merge do item 7 (código) na `develop`. Opcionalmente com D1, D2 e a correção do §4.
2. Item 3 (domínio da API) com a borda (I4), atendendo N1 e N5.
3. Hospedagem e CD do painel com N2 e N3, já com a CSP (D3).
4. N4 e N6 em cada ambiente, e o critério de aceite do §5.
5. SEG-05 passa de 🟡 Parcial para ✅ Entregue no `De-Para-Backlog-Features.md` quando o §5 passar em homologação.
