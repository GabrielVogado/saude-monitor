#  Plano Técnico — Painel Administrativo Web (F-11 / Épico 7)

> **Stack, estrutura de pastas e estratégia de consumo da API para a aplicação web administrativa**
>
> | Campo | Valor |
> |---|---|
> | **Versão** | 1.0 |
> | **Status** | Proposta técnica — pronta para validação com o time antes do início da S7 |
> | **Escopo** | Nova aplicação web (SPA) para administradores; reaproveita o backend Spring Boot já existente |
> | **Referências** | Backlog v2.0 (Épico 7, E7-01..E7-09) · Features v2.0 (F-11) · Árvore Tecnológica v2.0 · Especificação da API v2.0 |
> | **Dados de origem do georreferenciamento** | `D:\saude-monitor\multiplas_camadas_saude_14` (Shapefile, CRS `GCS_WGS_1984` — mesma referência lon/lat usada pelos geofences dos hospitais) |

---

## 1. Contexto e decisão de produto

Conforme registrado no Backlog (Épico 7) e na Feature F-11, o acesso administrativo **deixa de existir no app mobile** (público-alvo: população/cidadão) e passa a ser feito por uma **aplicação web separada**, destinada exclusivamente a administradores. As telas administrativas antes previstas no app mobile (cadastro/edição de hospital de F-01, moderação de sugestões de F-10) são **migradas** para este painel. O app mobile permanece 100% focado no cidadão.

Este documento cobre apenas a camada de apresentação (frontend web) e a forma de consumir a API; **não** propõe reescrever o backend — o painel é, na sua maior parte, um novo cliente da API já especificada, com uma pequena extensão (camadas geográficas) descrita na seção 5.

---

## 2. Stack recomendada

### 2.1 Comparativo de frameworks web

| Critério (0–5) | React + Vite | Next.js | Angular |
|---|---|---|---|
| Curva com a equipe (já usa React Native) | 5 | 4 | 1 |
| Complexidade operacional (maior = melhor) | 5 | 3 | 3 |
| Necessidade de SSR/SEO (painel interno, sem SEO) | 5 (não precisa) | 3 (SSR desnecessário aqui) | 4 |
| Velocidade de build/dev (Vite HMR) | 5 | 4 | 3 |
| **Total** | **20** | **14** | **11** |

**Recomendação: React + Vite + TypeScript.** Reaproveita o conhecimento de React já presente no time (app mobile é React Native), sem a sobrecarga de SSR/roteamento de servidor do Next.js — desnecessária para um painel interno autenticado.

### 2.2 Comparativo de bibliotecas de mapa

| Critério (0–5) | Leaflet + react-leaflet | Mapbox GL JS | Google Maps JS API |
|---|---|---|---|
| Custo (maior = melhor; sem cobrança por carga de tile/API) | 5 (open source, tiles OSM gratuitos) | 2 (cobra acima de cota) | 2 (cobra acima de cota) |
| Suporte a múltiplas camadas GeoJSON independentes (toggle) | 5 | 5 | 4 |
| Simplicidade de uso com polígonos grandes (Macrorregiões) | 4 | 5 (WebGL, mais fluido com geometrias pesadas) | 3 |
| Já usado no projeto (consistência) | 3 (mobile usa react-native-maps, não Leaflet) | 1 | 1 |
| **Total** | **17** | **13** | **10** |

**Recomendação: Leaflet + react-leaflet.** Sem custo de API key/cotas (relevante para um app comunitário sem orçamento de mapas pagos), maduro para múltiplas camadas GeoJSON com toggle, e suficiente após a simplificação de geometria (seção 5.2) das camadas de Macrorregiões/RIDE. Mapbox GL fica como alternativa se a performance com os polígonos maiores (Macrorregiões de Saúde, ~400KB de shapefile) se mostrar insuficiente em teste real.

### 2.3 Demais decisões de stack

| Camada | Escolha | Justificativa |
|---|---|---|
| **Linguagem** | TypeScript | Contratos de API tipados (Hospital, Sugestão, Região) — mesma direção já recomendada para o mobile na Árvore Tecnológica v2.0 (§3.1). |
| **Roteamento** | `react-router` v6 | Padrão de mercado, simples para um painel de poucas rotas. |
| **Estado de servidor / cache de API** | `@tanstack/react-query` | Cache, refetch e invalidação automática após ações de aprovar/editar/desativar — evita gerenciar loading/erro manualmente em cada tela. |
| **Estilo** | Tailwind CSS | Produtividade em telas de formulário/tabela; reaproveita os tokens de cor/raio do Design System v2.0 (mapeados para variáveis Tailwind). |
| **Ícones** | `lucide-react` | Mesma família de ícones já usada no mobile (`lucide-react-native`) — consistência visual entre os dois produtos. |
| **Formulários** | `react-hook-form` + `zod` | Validação do formulário de hospital (nome, geofence, CNPJ) espelhando as regras já aplicadas no backend. |
| **Cliente HTTP** | `axios` (com interceptor de refresh token) | Mesmo padrão de interceptor já usado no `HospitalService.js` do app mobile. |
| **Autenticação** | JWT (reaproveita `POST /auth/login`) em `localStorage`/`sessionStorage` (nunca em cookie sem `httpOnly` server-side, que não existe aqui) | Não introduz mecanismo novo de auth — mesmo contrato do backend (ADR-001 da Árvore Tecnológica). |
| **Build/deploy** | Vite build → arquivos estáticos servidos via Nginx (container próprio) ou hospedagem estática (ex.: bucket + CDN) | Painel é uma SPA; não precisa de servidor Node em produção. |

---

## 3. Estrutura de pastas proposta

Novo diretório de primeiro nível, **irmão** de `backend/` e `frontend/` — não dentro de `frontend/`, para deixar claro que é uma aplicação e um público diferentes:

```
D:\saude-monitor\
├── backend/                        (existente — sem mudança de estrutura)
├── frontend/                       (existente — app mobile, população)
├── web-admin/                      ← NOVO (painel administrativo)
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── main.tsx                    ← bootstrap (React + QueryClientProvider + Router)
│   │   ├── App.tsx                     ← rotas + layout autenticado
│   │   ├── routes/
│   │   │   ├── LoginPage.tsx
│   │   │   ├── HospitaisListaPage.tsx      (E7-02, E7-03)
│   │   │   ├── HospitaisMapaPage.tsx       (E7-04)
│   │   │   ├── HospitalDetalhePage.tsx     (E7-05, E7-06, E7-07)
│   │   │   └── SugestoesPendentesPage.tsx  (E1-06 / F-10, migrada do mobile)
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── AppShell.tsx            (header + menu lateral — E7-09)
│   │   │   │   └── ProtectedRoute.tsx      (guarda de rota por papel ADMIN)
│   │   │   ├── mapa/
│   │   │   │   ├── MapaHospitais.tsx
│   │   │   │   ├── CamadaRegiao.tsx        (uma camada GeoJSON com toggle)
│   │   │   │   └── IconeHospital.tsx       (ícone colorido/cinza por status)
│   │   │   ├── hospitais/
│   │   │   │   ├── HospitalTabela.tsx
│   │   │   │   ├── HospitalFiltros.tsx     (E7-03)
│   │   │   │   └── HospitalForm.tsx        (reaproveita regras de E1-01/E1-02)
│   │   │   └── ui/                         (Button, Modal, Badge, EmptyState — espelha tokens do Design System v2.0)
│   │   ├── services/
│   │   │   ├── apiClient.ts                (axios + interceptor de refresh JWT)
│   │   │   ├── authService.ts
│   │   │   ├── hospitalService.ts          (GET/PUT/PATCH /hospitais)
│   │   │   ├── sugestaoService.ts          (GET/POST /hospitais/sugestoes/...)
│   │   │   └── regiaoService.ts            (GET /regioes/{tipo} — ver seção 5)
│   │   ├── hooks/
│   │   │   ├── useHospitais.ts             (react-query)
│   │   │   ├── useRegioes.ts
│   │   │   └── useAuth.ts
│   │   ├── types/
│   │   │   ├── hospital.ts
│   │   │   ├── sugestao.ts
│   │   │   └── regiao.ts
│   │   └── styles/
│   │       └── tokens.css                  (tokens do Design System v2.0 como CSS vars/Tailwind config)
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   └── .env.example                        (VITE_API_BASE_URL)
└── Documentos/                      (existente)
```

**Por que uma pasta nova e não dentro de `frontend/`:** evita qualquer acoplamento de build/dependências entre o app mobile (Expo/React Native) e o painel web (Vite/React DOM) — são runtimes diferentes (React Native não roda no browser). Mantém a mesma filosofia de organização do repositório (cada pasta de primeiro nível = uma responsabilidade: `backend`, `frontend`, `web-admin`, `Documentos`).

---

## 4. Consumo da API — reaproveitamento total dos contratos existentes

O painel **não introduz um novo backend**; consome os mesmos endpoints já especificados em `Especificacao-API-v2.0.md`, com o mesmo `Authorization: Bearer <access_token>` e o mesmo papel `ADMIN` já previsto (§5 da Especificação da API).

| Tela / Ação | Endpoint reaproveitado | Observação |
|---|---|---|
| Login do admin | `POST /api/v1/auth/login` | Front valida `roles` do JWT decodificado; se não contiver `ADMIN`, bloqueia acesso ao painel (não é um endpoint separado). |
| Listar hospitais (E7-02) | `GET /api/v1/hospitais` | **Extensão sugerida:** hoje o contrato não deixa explícito o retorno de inativos; propõe-se um parâmetro `status=TODOS\|ATIVO\|INATIVO` habilitado apenas quando o chamador tem papel `ADMIN` (a decidir/registrar formalmente na Especificação da API quando a S7 for refinada — não alterado neste documento). |
| Filtrar (E7-03) | mesmo endpoint acima, params `busca`, `tipo` já existentes + `regiaoAdministrativa`/`regiaoSaude`/`macrorregiaoSaude` (novos query params, mesma extensão) |
| Detalhe do hospital (E7-05) | `GET /api/v1/hospitais/{id}` | Já existe. |
| Editar hospital (E7-06) | `PUT /api/v1/hospitais/{id}` | Já existe; reutiliza a mesma validação de geofence do backend. |
| Desativar/reativar (E7-07) | `PATCH /api/v1/hospitais/{id}/status` | Já existe. |
| Fila de sugestões / aprovar / rejeitar | `GET /hospitais/sugestoes`, `GET /hospitais/sugestoes/{id}`, `POST /hospitais/sugestoes/{id}/aprovar`, `POST /hospitais/sugestoes/{id}/rejeitar` | Endpoints já implementados no backend para F-10 (branch `feature/f-10-moderacao-sugestoes-hospitais`); o painel web passa a ser o único consumidor — as telas mobile equivalentes (`SugestoesPendentesScreen`, `RevisarSugestaoScreen`) devem ser retiradas do app da população quando o painel entrar em produção. |
| Indicadores (somente leitura) | `GET /api/v1/hospitais/{id}/indicadores` | Reaproveitado tal como é hoje — **nenhum endpoint de escrita de feedback é chamado pelo painel** (E7-08); `PUT /api/v1/feedbacks/{id}` nunca é consumido por este cliente. |

---

## 5. Único ponto novo de backend: camadas de georreferenciamento

### 5.1 Endpoint proposto

```
GET /api/v1/regioes/{tipo}   🛡️ (ADMIN)
```
`tipo` ∈ `regiao-administrativa` | `ride` | `regiao-saude` | `macrorregiao-saude`

**200 OK** — retorna um `FeatureCollection` GeoJSON (RFC 7946), no mesmo padrão lon/lat já usado nos geofences de hospital:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "nome": "Plano Piloto", "regiaoSaude": "Central", "macrorregiaoSaude": "Macrorregião 2" },
      "geometry": { "type": "Polygon", "coordinates": [ ["..."] ] }
    }
  ]
}
```

### 5.2 Pipeline de importação (shapefile → GeoJSON)

Origem: `D:\saude-monitor\multiplas_camadas_saude_14\{Regiões_Administrativas,Região_Integrada_de_Desen,Regiões_de_Saúde,Macrorregiões_de_Saúde}.shp` (CRS já em WGS84 — sem necessidade de reprojeção).

1. **Conversão** `.shp` → `.geojson` (ex.: `ogr2ogr` ou script Python com `geopandas`/`pyshp`), reaproveitando o mesmo processo já usado para os shapefiles de estabelecimentos (ver `07-dados/relatorio-importacao-SHAPEFILE_20260819.md`).
2. **Normalização de atributos**: nomes de região com grafias divergentes entre camadas (ex.: `"Sudoeste/Octogonal"` vs. `"Sudoeste"`) devem ser padronizados antes de persistir — gerar um relatório de auditoria no mesmo padrão de `07-dados/relatorio-auditoria-campos-categorias-cnes.md`.
3. **Simplificação de geometria** (ex.: `mapshaper -simplify 10%`) para reduzir o peso das camadas mais pesadas (Macrorregiões de Saúde ~400KB em shapefile) antes de servir ao cliente — evita degradar o carregamento do mapa.
4. **Persistência**: nova coleção MongoDB `regioes_geograficas` (documento por polígono, com índice `2dsphere`, mesmo padrão já adotado para `hospital.geofence`), carregada uma única vez (seed), já que a divisão administrativa/de saúde não muda com frequência.
5. **Serviço**: `RegiaoService`/`RegiaoController`, no mesmo padrão de bounded context do backend (`br.com.saude_monitor.api.regiao`), reaproveitando o `GlobalExceptionHandler` e a segurança já existentes (`SecurityConfig`).

---

## 6. Ícone cinza de hospital desativado — lógica de apresentação

Não requer campo novo: o backend já expõe o campo de status do hospital (`ativo: boolean`, usado por `PATCH /hospitais/{id}/status`, E1-04). No frontend web:

- `IconeHospital.tsx` recebe `ativo: boolean` e escolhe o ícone/cor: **ativo → ícone colorido padrão do Design System**; **inativo → mesmo ícone em `grayscale`/tom cinza** (ex.: `filter: grayscale(100%)` ou variante de cor `--color-neutral-400` do token).
- Aplicado tanto no `MapaHospitais.tsx` (pin) quanto na `HospitalTabela.tsx` (ícone da linha) — uma única fonte de verdade de estilo, evitando duplicar a regra visual.

---

## 7. Segurança

- Login exige papel `ADMIN` (mesmo mecanismo de roles já definido na Especificação da API §5). Usuário autenticado sem esse papel é bloqueado na `ProtectedRoute` (frontend) **e** pelo backend (`SecurityConfig`, já usado para os endpoints 🛡️ de F-01/F-10) — dupla camada, front não é a única barreira.
- Nenhuma tela ou chamada de serviço do painel referencia `PUT /feedbacks/{id}` — reforça E7-08 (não é apenas ausência de botão, é ausência do método no `services/`).
- Tokens JWT armazenados no browser seguem a mesma política de expiração (access curto + refresh) já definida no ADR-001 da Árvore Tecnológica.

---

## 8. Deploy e ambiente

| Item | Proposta |
|---|---|
| **Build** | `vite build` gera estáticos em `web-admin/dist/` |
| **Servir em produção** | Container Nginx dedicado (novo serviço no `docker-compose.yml` do backend) ou hospedagem estática (bucket + CDN) — decisão de infraestrutura a definir com o time, não bloqueia o desenvolvimento |
| **Ambiente de dev** | `vite dev` local, apontando `VITE_API_BASE_URL=http://localhost:8080/api/v1` (mesmo backend usado pelo app mobile em dev) |
| **CORS** | Backend precisa liberar a origem do painel web (`Access-Control-Allow-Origin`) — hoje o backend só é consumido pelo app mobile; ajuste de configuração, não de arquitetura |

---

## 9. Riscos técnicos específicos deste plano

| # | Risco | Mitigação |
|---|---|---|
| T-W1 | Performance do mapa com os 4 GeoJSON simultâneos (principalmente Macrorregiões) | Simplificação de geometria (§5.2); lazy-load de camada só quando ativada pelo toggle; avaliar Mapbox GL (WebGL) se Leaflet não performar em teste real |
| T-W2 | CORS mal configurado bloqueando o painel em produção | Testar a integração ponta a ponta em ambiente de homologação antes do deploy final |
| T-W3 | Divergência de nomenclatura de região dificultar filtros combinados | Normalização documentada na importação (§5.2), com relatório de auditoria revisado por alguém do time de dados |
| T-W4 | Duplicidade temporária de telas administrativas (mobile ainda com F-01/F-10 enquanto o painel não estiver pronto) | Definir corte único: mobile só remove as telas administrativas quando o painel estiver em produção e testado — evitar dois pontos de verdade simultâneos |

---

## 10. Resumo de decisões (para revisão rápida)

1. **Nova pasta `web-admin/`** — React + Vite + TypeScript, irmã de `backend/` e `frontend/`.
2. **Leaflet + react-leaflet** para o mapa multi-camada (sem custo de API key).
3. **Zero reescrita de backend** além de um novo bounded context de leitura (`regiao`) para servir os 4 GeoJSON — todo o resto (hospitais, sugestões, indicadores) reaproveita os contratos já existentes.
4. **JWT com papel `ADMIN`**, mesmo mecanismo do restante da API.
5. **Nenhum endpoint/tela de escrita de feedback** é referenciado por este cliente.

---

*Fim do Plano Técnico — Painel Administrativo Web v1.0. Sujeito a validação técnica do time antes do início da Sprint S7.*
