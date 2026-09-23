# Relatório de Auditoria Técnica — Saúde Monitor
**Versão:** 3.0
**Data:** Agosto de 2026
**Público:** Liderança Técnica e Engenharia de Software
**Base de referência:** Callstack Agent Skills, Expo SDK 55 Docs, React Native Architecture Guide, OWASP Mobile Top 10, LGPD

---

## Avaliação Geral

O projeto apresenta uma base visual e de acessibilidade sólida, com Design System coerente e aplicação correta de tokens de design em toda a árvore de componentes. Contudo, a camada de infraestrutura — comunicação de rede, gerenciamento de estado, organização de módulos e estratégias de renderização — acumulou dívida técnica expressiva que compromete a resiliência, escalabilidade e manutenibilidade do sistema a médio prazo.

### Scorecard Técnico

| Categoria | Nota Atual | Nota Potencial | Criticidade |
|:---|:---:|:---:|:---:|
| Design System & Tokens | 9.5/10 | 10/10 | Baixa |
| Acessibilidade (a11y) | 8.5/10 | 10/10 | Média |
| Performance de Renderização | 5.5/10 | 9.5/10 | Alta |
| Arquitetura de Módulos | 5/10 | 9/10 | Crítica |
| Segurança — Persistência de Tokens | 6/10 | 9.5/10 | Alta |
| Consistência de Padrões | 5.5/10 | 9/10 | Alta |
| Segurança de Tipos (TypeScript) | 2/10 | 10/10 | Alta |
| Testabilidade | 5/10 | 9/10 | Alta |

---

## Arquitetura e Estrutura de Pastas — Diagnóstico Completo

### Estrutura Atual

```
frontend/
├── App.js                              ← Navegação, providers, task registration
├── app.json
├── src/
│   ├── components/                     ← Design System (14 arquivos flat)
│   │   ├── CSBadge.js
│   │   ├── CSButton.js
│   │   ├── CSCard.js
│   │   ├── CSChip.js
│   │   ├── CSEmptyState.js
│   │   ├── CSGeoStatusCard.js          ← Dependência de GeofencingTaskService
│   │   ├── CSHeader.js
│   │   ├── CSHospitalCard.js           ← Contém lógica de domínio (enums, RN-15)
│   │   ├── CSIconButton.js
│   │   ├── CSLoading.js
│   │   ├── CSRatingStars.js
│   │   ├── CSSelect.js
│   │   ├── CSTextField.js
│   │   └── index.js                    ← Barrel export (14 componentes)
│   │
│   ├── config/
│   │   └── api.js                      ← buildApiUrl — único arquivo de configuração
│   │
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── service/LoginService.js
│   │   │   └── view/
│   │   │       ├── LoginScreen.js
│   │   │       └── css/LoginStyle.js   ← StyleSheet em subpasta separada
│   │   │
│   │   ├── feedback/
│   │   │   ├── service/
│   │   │   │   ├── FeedbackService.js
│   │   │   │   └── FeedbackNotificationService.js
│   │   │   └── view/FeedbackFormScreen.js
│   │   │
│   │   ├── geolocalizacao/
│   │   │   ├── service/GeoLocalizacaoService.js  ← Context + Provider (convenção errada)
│   │   │   └── view/GeoLocalizacaoScreen.js
│   │   │
│   │   ├── home/
│   │   │   └── view/HomeScreen.js
│   │   │
│   │   ├── hospitais/
│   │   │   ├── service/HospitalService.js
│   │   │   └── view/
│   │   │       ├── HospitaisScreen.js
│   │   │       ├── HospitalDetalheScreen.js
│   │   │       ├── RevisarSugestaoScreen.js
│   │   │       ├── SugerirHospitalScreen.js
│   │   │       └── SugestoesPendentesScreen.js
│   │   │
│   │   ├── perfil/
│   │   │   ├── service/PerfilService.js
│   │   │   └── view/
│   │   │       ├── PerfilScreen.js
│   │   │       ├── PrivacidadeScreen.js
│   │   │       └── css/PerfilStyle.js
│   │   │
│   │   ├── user/
│   │   │   └── view/UserScreen.js
│   │   │
│   │   ├── visitas/
│   │   │   ├── service/
│   │   │   │   ├── GeofencingTaskService.js
│   │   │   │   ├── HeartbeatService.js
│   │   │   │   └── VisitaService.js
│   │   │   └── view/CheckinManualScreen.js
│   │   │
│   │   └── views/
│   │       └── index.js                ← Barrel de compatibilidade legado (10 re-exports)
│   │
│   ├── services/
│   │   └── TokenStorage.js             ← Único serviço fora de screens/ — isolado
│   │
│   ├── theme/
│   │   ├── index.js                    ← Barrel export
│   │   └── tokens.js
│   │
│   └── utils/
│       ├── format.js
│       ├── geojson.js
│       ├── mapStyle.js
│       └── normalize.js
│
└── __tests__/
```

---

### Problemas Estruturais Identificados

#### 1. Modelo de Organização Type-First em conflito com as fronteiras reais do sistema

A estrutura atual agrupa código por **tipo técnico** (`screens`, `services`, `components`, `utils`). Este modelo funciona adequadamente em projetos de até 5–8 módulos, mas apresenta fricção crescente à medida que o sistema evolui, por duas razões:

**Fronteiras de módulo cruzadas:** o `GeofencingTaskService.js`, que implementa a lógica de background de geofencing e é crítico para o módulo de Visitas, fica dentro de `screens/visitas/service/`. Porém, ele é consumido por `HomeScreen.js` (que está em `screens/home/`) e indiretamente pelo `FeedbackNotificationService.js` (que está em `screens/feedback/service/`). A localização em `screens/visitas/` comunica ao desenvolvedor que o serviço pertence à tela de visitas — mas seu escopo real é de infraestrutura de background compartilhada.

**Acoplamento de navegação e lógica:** `App.js` concentra ao mesmo tempo a configuração de navegação, o registro de tasks de background (`TaskManager`/`GeofencingTaskService`) e o setup de providers. Com o crescimento do número de rotas e providers, este arquivo se tornará um ponto de modificação frequente e de alta probabilidade de conflitos em branches paralelas.

**`screens/views/index.js` — barrel de compatibilidade sem dono claro:** o arquivo re-exporta 10 telas de módulos diferentes. O comentário interno (`Compatibility barrel for any legacy imports`) indica que já foi necessário criar uma camada de compatibilidade para imports que apontavam para o caminho errado. Isso significa que a estrutura de pastas já foi inconsistente a ponto de exigir um shim — o que não foi removido após a correção.

#### 2. Convenção de nomeação de subpastas inconsistente

Três módulos organizam seus arquivos de estilo em subpastas `css/`:
- `screens/auth/view/css/LoginStyle.js`
- `screens/perfil/view/css/PerfilStyle.js`

Os demais módulos (`hospitais`, `feedback`, `geolocalizacao`, `visitas`, `home`) definem seus `StyleSheet.create` diretamente nos arquivos de tela. Não há convenção documentada — desenvolvedores adicionando novas telas não têm como inferir qual padrão seguir.

#### 3. `GeoLocalizacaoService.js` — Context Provider nomeado como Service

O arquivo `src/screens/geolocalizacao/service/GeoLocalizacaoService.js` não é um service — é um **React Context Provider** com hooks (`GeolocalizacaoProvider`, `useGeolocalizacao`). A convenção de nomeação (`*Service.js`) e a localização (`service/`) comunicam responsabilidade de acesso a dados, mas o arquivo exporta primariamente primitivos React. Esta inversão de convenção pode induzir o desenvolvedor a instanciar o "serviço" sem o Provider no topo da árvore, resultando em um erro de runtime difícil de rastrear.

#### 4. `src/services/` — diretório singleton sem propósito escalável

A pasta `src/services/` contém apenas um arquivo: `TokenStorage.js`. Não representa uma camada arquitetural — é um arquivo solto que não se encaixa nas outras categorias. Ao mesmo tempo, serviços como `LoginService`, `HospitalService`, `VisitaService` e `FeedbackService` vivem dentro de `screens/`, criando a percepção equivocada de que esses serviços pertencem exclusivamente àquela tela específica.

---

### Estrutura Proposta — Feature-First com Core Compartilhado

O modelo Feature-First (também chamado de Module-Based ou Vertical Slice) agrupa por **domínio de negócio** em vez de tipo técnico. Cada feature é auto-contida: tem seus próprios screens, services, hooks e tipos. O que é genuinamente compartilhado vai para `core/`.

```
frontend/
├── App.js                              ← Apenas: NavigationContainer + Providers
├── app.json
├── src/
│   │
│   ├── core/                           ← Infraestrutura genuinamente compartilhada
│   │   ├── api/
│   │   │   └── apiClient.js            ← HTTP client unificado com Mutex (ADR-001)
│   │   │
│   │   ├── components/                 ← Design System (ex. src/components/)
│   │   │   ├── CSBadge.jsx
│   │   │   ├── CSButton.jsx
│   │   │   ├── CSCard.jsx
│   │   │   ├── CSChip.jsx
│   │   │   ├── CSEmptyState.jsx
│   │   │   ├── CSHeader.jsx
│   │   │   ├── CSIconButton.jsx
│   │   │   ├── CSLoading.jsx
│   │   │   ├── CSPressableRow.jsx      ← NOVO — substitui TouchableOpacity
│   │   │   ├── CSRatingStars.jsx
│   │   │   ├── CSSelect.jsx
│   │   │   └── CSTextField.jsx
│   │   │   ← sem index.js barrel
│   │   │
│   │   ├── constants/
│   │   │   └── hospitalDomain.js       ← Enums TIPO_LABEL, CATEGORIA_LABEL, RN-15
│   │   │
│   │   ├── storage/
│   │   │   └── TokenStorage.js         ← Migrado para expo-secure-store (ADR-005)
│   │   │
│   │   └── theme/
│   │       └── tokens.js               ← Sem barrel — import direto
│   │
│   ├── features/                       ← Módulos por domínio de negócio
│   │   │
│   │   ├── auth/
│   │   │   ├── AuthContext.jsx         ← Provider + useAuth (ADR-004)
│   │   │   ├── services/
│   │   │   │   └── LoginService.js
│   │   │   └── screens/
│   │   │       └── LoginScreen.jsx
│   │   │
│   │   ├── hospitais/
│   │   │   ├── services/
│   │   │   │   └── HospitalService.js
│   │   │   └── screens/
│   │   │       ├── HospitaisScreen.jsx
│   │   │       ├── HospitalDetalheScreen.jsx
│   │   │       ├── SugerirHospitalScreen.jsx
│   │   │       ├── SugestoesPendentesScreen.jsx
│   │   │       └── RevisarSugestaoScreen.jsx
│   │   │
│   │   ├── visitas/
│   │   │   ├── VisitaContext.jsx        ← Provider + useVisita (ADR-004)
│   │   │   ├── services/
│   │   │   │   ├── VisitaService.js
│   │   │   │   ├── GeofencingTaskService.js   ← Infraestrutura de background
│   │   │   │   └── HeartbeatService.js
│   │   │   └── screens/
│   │   │       ├── HomeScreen.jsx
│   │   │       └── CheckinManualScreen.jsx
│   │   │
│   │   ├── feedback/
│   │   │   ├── services/
│   │   │   │   ├── FeedbackService.js
│   │   │   │   └── FeedbackNotificationService.js
│   │   │   └── screens/
│   │   │       └── FeedbackFormScreen.jsx
│   │   │
│   │   ├── geolocalizacao/
│   │   │   ├── GeolocalizacaoContext.jsx  ← Renomeado de GeoLocalizacaoService.js
│   │   │   └── screens/
│   │   │       └── GeoLocalizacaoScreen.jsx
│   │   │
│   │   ├── perfil/
│   │   │   ├── services/
│   │   │   │   └── PerfilService.js
│   │   │   └── screens/
│   │   │       ├── PerfilScreen.jsx
│   │   │       └── PrivacidadeScreen.jsx
│   │   │
│   │   └── user/
│   │       └── screens/
│   │           └── UserScreen.jsx
│   │
│   ├── navigation/
│   │   ├── AppNavigator.jsx            ← createNativeStackNavigator (ADR-002)
│   │   └── TabNavigator.jsx            ← Bottom Tabs separado
│   │
│   └── utils/                          ← Mantido — utilitários sem acoplamento de domínio
│       ├── format.js
│       ├── geojson.js
│       ├── mapStyle.js
│       └── normalize.js
│
└── __tests__/
```

---

### Comparativo: Estrutura Atual vs. Proposta

| Aspecto | Atual | Proposta |
|:---|:---|:---|
| **Modelo de organização** | Type-First (`screens/`, `components/`, `services/`) | Feature-First com `core/` compartilhado |
| **Localização do HTTP client** | Duplicado em 4 arquivos dentro de `screens/` | `core/api/apiClient.js` |
| **Storage** | `src/services/TokenStorage.js` (diretório singleton) | `core/storage/TokenStorage.js` |
| **Design System** | `src/components/` com barrel `index.js` | `core/components/` sem barrel |
| **Tema** | `src/theme/` com barrel | `core/theme/tokens.js` sem barrel |
| **Contextos React** | Misturados em `service/` (`GeoLocalizacaoService.js`) | `features/<domínio>/<Domínio>Context.jsx` |
| **Enums de domínio** | Duplicados em `CSHospitalCard.js` e `HospitalDetalheScreen.js` | `core/constants/hospitalDomain.js` |
| **Navegação** | Definida diretamente em `App.js` | `src/navigation/AppNavigator.jsx` |
| **Barrel legado** | `screens/views/index.js` (10 re-exports sem uso aparente) | Removido |
| **Estilos CSS** | Híbrido: subpastas `css/` em auth e perfil, inline nos demais | StyleSheet no mesmo arquivo da tela (padrão único) |

---

### Estratégia de Migração Incremental

A migração completa de uma estrutura type-first para feature-first em um repositório ativo exige cuidado para não gerar conflitos entre branches e não interromper o desenvolvimento de features em paralelo.

**Princípio:** mover arquivos apenas quando eles já estão sendo modificados por outra razão (refatoração, bug fix, nova feature). Nunca criar um commit exclusivamente de movimentação de arquivos sem mudança de comportamento — isso gera diffs gigantes sem valor de negócio e dificulta `git blame`.

**Fase 0 (preparação, sem mover nada):**
- Criar `src/core/api/apiClient.js` (ADR-001)
- Criar `src/core/storage/TokenStorage.js` (ADR-005)
- Criar `src/core/constants/hospitalDomain.js` (ADR-007)
- Criar `src/navigation/AppNavigator.jsx` extraindo a navegação do `App.js`

**Fase 1 (migrar conforme telas são tocadas):**
- Ao refatorar `HospitaisScreen` para FlashList → mover para `features/hospitais/screens/`
- Ao implementar `AuthContext` → criar `features/auth/AuthContext.jsx`
- Ao corrigir `GeoLocalizacaoService` → renomear para `features/geolocalizacao/GeolocalizacaoContext.jsx`

**Fase 2 (limpeza final):**
- Remover `screens/views/index.js` após confirmar que nenhum import aponta para ele
- Remover subpastas `css/` consolidando StyleSheets nos arquivos de tela
- Remover `src/services/` após `TokenStorage` estar em `core/storage/`

---

## Problema 1 — Duplicação Sistêmica da Camada HTTP e Race Condition no Refresh de Token

### Localização

```
src/screens/hospitais/service/HospitalService.js   (linhas 12–89)
src/screens/visitas/service/VisitaService.js        (linhas 12–92)
src/screens/feedback/service/FeedbackService.js     (linhas 12–83)
src/screens/auth/service/LoginService.js            (linhas 112–154, implementação divergente)
```

### Diagnóstico

As funções `authHeaders()`, `request()` e `buildQuery()` estão literalmente duplicadas em três serviços distintos, com uma quarta implementação manual no fluxo de exclusão de conta do `LoginService`. O próprio `VisitaService.js` documenta a duplicação no comentário da linha 20: *"Replica o padrão de HospitalService.js"*.

Além da duplicação evidente, a implementação atual expõe o sistema a uma **race condition** no refresh de token JWT. O fluxo problemático:

```
t=0ms   HomeScreen é aberta — dispara buscarAtiva() e listar() simultaneamente
t=1ms   VisitaService.buscarAtiva() → HTTP 401 → inicia LoginService.refresh()
t=2ms   HospitalService.listar()   → HTTP 401 → inicia LoginService.refresh() concorrentemente
t=140ms  Refresh #1 conclui: refreshToken rotacionado, novo accessToken emitido
t=142ms  Refresh #2 chega ao servidor com o refreshToken já invalidado → 401
         → LoginService.logout() executado → sessão destruída sem intervenção do usuário
```

O comportamento de refresh token rotacionado é o padrão descrito na especificação interna (§3.1): o servidor invalida o refresh token antigo ao emitir o novo par. Com múltiplas instâncias independentes da lógica de refresh, o segundo refresh sistematicamente recebe um 401 e dispara o logout forçado.

Em conexões lentas — comuns em ambientes hospitalares com sinal congestionado — a janela de concorrência é amplificada, tornando o bug mais frequente em campo do que em ambiente de desenvolvimento.

Adicionalmente, as implementações divergem em detalhes críticos:
- `VisitaService.request()` enriquece o objeto de erro com `.status` e `.data` (linhas 86–88)
- `HospitalService.request()` e `FeedbackService.request()` replicam o mesmo enriquecimento
- `LoginService.excluirConta()` (linhas 112–154) implementa um cliente HTTP próprio, simplificado, sem renovação de token em 401 — inconsistência que pode causar falhas silenciosas na exclusão de conta com sessão próxima do vencimento

### Alternativas de Solução

#### Alternativa 1 — `apiClient.js` com Mutex de Refresh (Recomendada)

Centraliza toda a lógica HTTP em um único módulo com proteção contra concorrência via Promise compartilhada:

```javascript
// src/core/api/apiClient.js
import { buildApiUrl } from "../config/api";
import TokenStorage from "../storage/TokenStorage";

let refreshPromise = null; // Mutex: garante exatamente um refresh ativo por vez

async function authHeaders() {
  const token = await TokenStorage.getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function renovarToken() {
  if (refreshPromise) return refreshPromise; // Coalesce — aguarda o refresh em andamento

  refreshPromise = (async () => {
    try {
      const { default: LoginService } = await import("../auth/service/LoginService");
      return await LoginService.refresh();
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export async function apiRequest(path, { method = "GET", body, headers = {} } = {}) {
  const doFetch = async () => {
    const url = buildApiUrl(path);
    const config = {
      method,
      headers: { "Content-Type": "application/json", ...(await authHeaders()), ...headers },
    };
    if (body !== undefined) {
      config.body = typeof body === "string" ? body : JSON.stringify(body);
    }
    try {
      return await fetch(url, config);
    } catch (error) {
      if (error?.message === "Network request failed") {
        throw new Error(`Falha de conectividade ao tentar alcançar ${url}.`);
      }
      throw error;
    }
  };

  let response = await doFetch();

  if (response.status === 401) {
    const refreshToken = await TokenStorage.getRefreshToken();
    if (refreshToken) {
      try {
        await renovarToken();
        response = await doFetch();
      } catch {
        const { default: LoginService } = await import("../auth/service/LoginService");
        await LoginService.logout();
        throw new Error("Sessão expirada. Realize o login novamente.");
      }
    }
  }

  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch { data = null; }
  }

  if (!response.ok) {
    const erro = new Error(data?.message || data?.error || `HTTP ${response.status}`);
    erro.status = response.status;
    erro.data = data;
    throw erro;
  }
  return data;
}

export const api = {
  get:    (path, opts)       => apiRequest(path, { ...opts, method: "GET" }),
  post:   (path, body, opts) => apiRequest(path, { ...opts, method: "POST", body }),
  put:    (path, body, opts) => apiRequest(path, { ...opts, method: "PUT", body }),
  patch:  (path, body, opts) => apiRequest(path, { ...opts, method: "PATCH", body }),
  delete: (path, opts)       => apiRequest(path, { ...opts, method: "DELETE" }),
};
```

Resultado nos serviços — eliminação de ~200 linhas duplicadas:

```javascript
// HospitalService.js pós-refatoração
import { api } from "../../../core/api/apiClient";

class HospitalService {
  static listar(params = {}) {
    return api.get(`/api/v1/hospitais${buildQuery(params)}`);
  }
  static buscarPorId(id) { return api.get(`/api/v1/hospitais/${id}`); }
  static buscarGeofence(id) { return api.get(`/api/v1/hospitais/${id}/geofence`); }
  // ...
}
```

#### Alternativa 2 — Módulo compartilhado sem reorganização estrutural

Para times com restrição de prazo, extrair as funções para `src/shared/http.js` sem mover os serviços:

```javascript
// src/shared/http.js
export { apiRequest as request, buildQuery };
```

Cada serviço importa de `shared/http.js`. Não resolve a race condition, mas centraliza a manutenção.

#### Alternativa 3 — Adoção de `@tanstack/react-query` (Longo Prazo)

Além de resolver a camada HTTP, o React Query oferece:
- Cache com stale-while-revalidate configurable por query
- Retry automático com backoff exponencial
- Background refetch ao retornar ao foreground (`refetchOnAppFocus`)
- Eliminação de toda a lógica `useState + useEffect` para dados remotos nas telas
- Integração direta com `@tanstack/query-async-storage-persister` para persistência de cache no React Native

**Impacto se não resolvido:** com múltiplas telas fazendo requisições simultâneas ao abrir o app — comportamento esperado e documentado nos épicos — a race condition de 401 afetará usuários com sessões próximas do vencimento, degradando a confiabilidade percebida do produto.

---

## Problema 2 — Tokens JWT Persistidos em `AsyncStorage` (Risco de Segurança e LGPD)

### Localização

```
src/services/TokenStorage.js (linhas 9–11)
```

### Diagnóstico

O `AsyncStorage` armazena dados em texto plano no sistema de arquivos do dispositivo, sem criptografia de camada de aplicação. O próprio código já registra a vulnerabilidade:

```javascript
// TODO (pré-produção): migrar para `expo-secure-store` no nativo, conforme §2.2
// (token JWT apenas no SecureStore do cliente), mantendo fallback em localStorage no Web.
```

Vetores de exposição relevantes:
- Dispositivos Android com root (acesso irrestrito ao sistema de arquivos)
- Backups ADB não criptografados (`adb backup`)
- Extração forense física em dispositivos Android sem Full Disk Encryption habilitado (APIs < 28)
- Compartilhamento de dispositivo sem bloqueio de tela

Para um app que processa dados de visitas hospitalares, feedbacks de atendimento e informações de localização em tempo real, o vazamento de tokens representa uma violação ao Art. 46 da LGPD — que exige medidas técnicas e administrativas aptas a proteger dados pessoais.

A OWASP Mobile Top 10 classifica o armazenamento inseguro de credenciais como **M9: Insecure Data Storage**.

### Alternativas de Solução

#### Alternativa 1 — `expo-secure-store` com fallback para Web (Recomendada)

```javascript
// src/core/storage/SecureTokenStorage.js
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

// iOS: Keychain Services   Android: Android Keystore (API 18+) / EncryptedSharedPreferences
async function setSecure(key, value) {
  if (Platform.OS === "web") {
    sessionStorage.setItem(key, value); // sessionStorage expira com a aba
    return;
  }
  await SecureStore.setItemAsync(key, value, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

async function getSecure(key) {
  if (Platform.OS === "web") return sessionStorage.getItem(key);
  return SecureStore.getItemAsync(key);
}
```

**Atenção:** `SecureStore` no iOS tem limite de 2KB por item. O objeto `usuario` serializado deve ser monitorado para não exceder esse limite à medida que o perfil do usuário cresce.

#### Alternativa 2 — Validação de Expiração no cliente (Melhoria imediata, sem migrar o storage)

```javascript
// Decodifica o payload JWT sem verificar assinatura — apenas para leitura local de `exp`
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return Date.now() >= payload.exp * 1000;
  } catch {
    return true;
  }
}

static async getAccessToken() {
  const token = await AsyncStorage.getItem(ACCESS_TOKEN_KEY);
  if (!token || isTokenExpired(token)) return null;
  return token;
}
```

Evita requisições com token sabidamente expirado, reduzindo a frequência de 401s e o ciclo de refresh.

**Impacto se não resolvido:** exposição dos tokens JWT em dispositivos comprometidos, risco de conformidade com LGPD e não atendimento às políticas de segurança de autenticação da especificação interna (§2.2).

---

## Problema 3 — Ausência de Estado Global Reativo (Auth e Visita Ativa)

### Localização

Padrão disperso por múltiplos arquivos:
- `LoginScreen.js` (linha 28–30): navegação pós-login sem atualização de estado global
- `PerfilScreen.js` (linhas 37–52): `useFocusEffect` com leitura de disco a cada foco
- `GeofencingTaskService.js` (linhas 37–40): variáveis de módulo isoladas do estado React

### Diagnóstico

O estado de autenticação e de visita ativa é gerenciado por leitura direta de `AsyncStorage` em cada tela individualmente, sob demanda. Não há mecanismo de propagação reativa: uma alteração em uma tela não notifica as demais.

**Consequências observáveis:**

1. **Dessincronia pós-login:** após `LoginService.login()` na `LoginScreen`, a navegação para "Inicio" ocorre sem que o `HomeScreen` receba qualquer notificação de mudança de estado. O `HomeScreen` só descobre a sessão ativa no próximo foco, via `useFocusEffect`.

2. **Leituras redundantes de disco:** `PerfilScreen` executa `TokenStorage.getUsuario()` a cada vez que a aba recebe foco — operação assíncrona em disco que poderia ser substituída por uma leitura de memória de um store centralizado.

3. **Coordenação frágil entre `GeofencingTaskService` e `HomeScreen`:** o serviço mantém `visitaAtivaId` em variável de módulo e depende de chamada explícita a `sincronizarVisitaAtiva()` para se manter coerente com o estado exibido na UI. Essa ponte imperativa é propensa a divergência de estado quando o processo JS é reiniciado pelo sistema operacional.

### Alternativas de Solução

#### Alternativa 1 — React Context separado por domínio (Recomendada para MVP)

```javascript
// src/core/auth/AuthContext.jsx
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [inicializado, setInicializado] = useState(false);

  useEffect(() => {
    TokenStorage.getUsuario()
      .then(setUsuario)
      .finally(() => setInicializado(true));
  }, []);

  const login = useCallback(async (credenciais) => {
    const resultado = await LoginService.login(credenciais);
    setUsuario(resultado.usuario);
    return resultado;
  }, []);

  const logout = useCallback(async () => {
    await LoginService.logout();
    setUsuario(null);
  }, []);

  if (!inicializado) return null; // Evita flash de conteúdo não autenticado

  return (
    <AuthContext.Provider value={{ usuario, isAuthenticated: !!usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth requer AuthProvider na árvore");
  return ctx;
};
```

Separar `VisitaContext` de `AuthContext` é fundamental: a visita ativa muda a cada heartbeat (30min), enquanto o usuário raramente muda. Contexts unificados causariam re-renders globais desnecessários.

#### Alternativa 2 — Zustand com middleware de persistência

```javascript
// src/core/stores/authStore.js
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export const useAuthStore = create(
  persist(
    (set, get) => ({
      usuario: null,
      setUsuario: (usuario) => set({ usuario }),
      isAuthenticated: () => !!get().usuario,
      logout: async () => {
        await LoginService.logout();
        set({ usuario: null });
      },
    }),
    { name: "auth-storage", storage: createJSONStorage(() => AsyncStorage) }
  )
);
```

Vantagem sobre Context: seletores finos evitam re-renders em componentes que consomem apenas `isAuthenticated` quando `usuario` muda de objeto sem alterar o estado de autenticação.

#### Alternativa 3 — Jotai com átomos derivados

Para times familiarizados com o modelo atômico (Recoil/Jotai), permite re-renders seletivos por átomo sem configuração de seletor:

```javascript
import { atom, useAtom, useAtomValue } from "jotai";

export const usuarioAtom = atom(null);
export const isAuthenticatedAtom = atom((get) => !!get(usuarioAtom));
```

**Impacto se não resolvido:** inconsistência de estado entre abas, requisições redundantes ao servidor e ao disco, e acoplamento imperativo entre `GeofencingTaskService` e `HomeScreen` que se tornará cada vez mais difícil de manter com o crescimento das funcionalidades.

---

## Problema 4 — Stack Navigator Executando na Thread JavaScript

### Localização

```javascript
// App.js (linha 2)
import { createStackNavigator } from "@react-navigation/stack"; // Implementação JS
```

### Diagnóstico

O `@react-navigation/stack` implementa as transições de tela via animações na thread JavaScript, usando `Animated` com interpolações calculadas no lado React. A thread JS é compartilhada com: renderização de componentes, processamento de dados da API, cálculos de geofencing e debounce de busca.

Em cenários de carga simultânea — ex: transição para `GeoLocalizacaoScreen` enquanto `iniciarGeofencing()` resolve permissões e busca hospitais próximos — a thread JS fica bloqueada e as animações de transição perdem frames.

O `@react-navigation/native-stack` delega a stack inteira para os controladores nativos:
- iOS: `UINavigationController` — processado pelo compositor do sistema, sempre a 60 FPS (ou 120 FPS em ProMotion)
- Android: `FragmentTransaction` — gerenciado pelo sistema operacional, independente da thread JS

O pacote já está instalado (`package.json`, `@react-navigation/native-stack`). O app usa `headerShown: false` em todos os navigators, eliminando qualquer dependência de personalização JS de cabeçalho que poderia exigir o stack legado.

### Alternativas de Solução

#### Alternativa 1 — Migrar para `createNativeStackNavigator` (Recomendada)

```javascript
// App.js
import { createNativeStackNavigator } from "@react-navigation/native-stack";

const Stack = createNativeStackNavigator();
// Uso idêntico ao anterior — nenhuma alteração nas Screen declarations
```

#### Alternativa 2 — Otimização parcial mantendo o stack JS

```javascript
import { CardStyleInterpolators, TransitionSpecs } from "@react-navigation/stack";

screenOptions={{
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
  transitionSpec: {
    open:  { animation: "spring", config: { stiffness: 1000, damping: 500, mass: 3 } },
    close: { animation: "spring", config: { stiffness: 1000, damping: 500, mass: 3 } },
  },
}}
```

Melhoria cosmética sem resolver o problema de thread compartilhada.

**Impacto se não resolvido:** em dispositivos com SoC Snapdragon 400/600 ou Helio G35/G70 — segmento que representa ~60% do mercado mobile brasileiro — as transições apresentarão jank mensurável (< 30 FPS) durante operações concorrentes na thread JS.

---

## Problema 5 — Renderização Ineficiente em Telas de Listagem

### Localização

```
src/screens/hospitais/view/HospitaisScreen.js       (linha 136–151)
src/screens/hospitais/view/SugestoesPendentesScreen.js (linha 161)
src/screens/visitas/view/CheckinManualScreen.js     (linha 119)
src/components/CSSelect.js                          (linha 54)
```

### Diagnóstico

**1. `renderItem` declarado como função anônima inline:**

```javascript
// HospitaisScreen.js (linhas 139–141)
renderItem={({ item }) => (
  <CSHospitalCard hospital={item} onPress={() => abrirDetalhe(item)} />
)}
```

A cada re-render da `HospitaisScreen` — disparado a cada caractere digitado no campo de busca (com debounce de 400ms) — uma nova referência de função é passada como `renderItem`. O `FlatList` interpreta isso como mudança de prop e invalida a memoização interna de todos os itens visíveis.

Com 20 hospitais na lista, cada keystroke aciona a reconciliação de 20 instâncias de `CSHospitalCard` e seus subcomponentes (`CSBadge`, `CSRatingStars`, `Building2`).

**2. Ausência de `React.memo` nos componentes de item:**

`CSHospitalCard`, `CSBadge` e `CSRatingStars` não são memoizados. Com `renderItem` inline e a ausência de `React.memo`, **não existe nenhuma camada de proteção contra re-renders desnecessários** na cadeia completa de renderização de cada item da lista.

**3. `FlatList` sem reciclagem real de views:**

O `FlatList` implementa windowing (apenas renderiza os itens visíveis + buffer), mas não recicla as instâncias de View nativas. Itens que saem da janela de renderização são desmontados — suas views nativas são destruídas e recriadas quando o item retorna à janela. Em listas com cards complexos (como `CSHospitalCard`, que contém ícones SVG, múltiplos `Text` e `CSBadge`), isso gera pressão no garbage collector e pode causar blank areas durante rolagem rápida.

### Alternativas de Solução

#### Alternativa 1 — `@shopify/flash-list` com `useCallback` (Recomendada)

```bash
npx expo install @shopify/flash-list
```

```javascript
import { FlashList } from "@shopify/flash-list";

const renderHospital = useCallback(({ item }) => (
  <CSHospitalCard hospital={item} onPress={() => abrirDetalhe(item)} />
), [abrirDetalhe]);

<FlashList
  data={dados}
  keyExtractor={(item) => item.id}
  renderItem={renderHospital}
  estimatedItemSize={96}
  ListEmptyComponent={renderVazio}
  refreshControl={<RefreshControl ... />}
/>
```

O FlashList recicla os componentes React e as views nativas associadas — ao invés de desmontar/montar, reutiliza a instância existente com novos dados (padrão RecyclerView do Android / UICollectionView do iOS).

#### Alternativa 2 — Otimização do `FlatList` existente

```javascript
// Estabilizar renderItem com useCallback
const renderHospital = useCallback(({ item }) => (
  <CSHospitalCard hospital={item} onPress={() => abrirDetalhe(item)} />
), [abrirDetalhe]);

// Adicionar getItemLayout se a altura dos cards for previsível
const getItemLayout = useCallback((_, index) => ({
  length: CARD_HEIGHT,
  offset: CARD_HEIGHT * index,
  index,
}), []);

<FlatList
  renderItem={renderHospital}
  getItemLayout={getItemLayout}
  maxToRenderPerBatch={8}
  windowSize={4}
  removeClippedSubviews={true}
  initialNumToRender={6}
/>
```

#### Alternativa 3 — `React.memo` com comparação customizada nos componentes de item

```javascript
// CSHospitalCard.js
export default React.memo(CSHospitalCard, (prev, next) =>
  prev.hospital?.id === next.hospital?.id &&
  prev.hospital?.indicadores?.notaMedia === next.hospital?.indicadores?.notaMedia &&
  prev.distanciaKm === next.distanciaKm
);
```

Pode ser combinada com as Alternativas 1 ou 2.

**Impacto se não resolvido:** degradação de FPS proporcional ao crescimento do dataset. A tela de busca de hospitais — central no fluxo do usuário — se tornará a principal fonte de janks reportados em devices de médio/baixo desempenho.

---

## Problema 6 — Barrel Exports Inflando o Bundle e o TTI

### Localização

```javascript
// src/components/index.js — 14 exports
// src/theme/index.js — export * from "./tokens"
```

### Diagnóstico

O Metro bundler, por padrão, não realiza tree shaking eficiente de módulos CommonJS (que é o formato gerado pelo transpiler do Expo em produção). Ao importar qualquer export de `src/components/index.js`, o bundler inclui o grafo de dependências de **todos os 14 componentes** no bundle — independentemente de quantos são utilizados naquela tela.

O topo da hierarquia de dependências de `CSGeoStatusCard` inclui `@maplibre/maplibre-react-native` — uma dependência nativa pesada que não deveria estar presente no bundle de telas que não utilizam mapa.

**Impacto mensurável estimado:** segundo benchmarks do guia `bundle-barrel-exports` da Callstack, barrel exports em design systems de porte médio podem adicionar entre 150ms e 800ms ao TTI em primeira abertura.

```javascript
// HospitalDetalheScreen.js (linhas 6–13) — carrega o módulo inteiro do Design System
import { CSBadge, CSCard, CSHeader, CSEmptyState, CSLoading, CSRatingStars } from "../../../components";

// Correção — importações diretas
import CSBadge from "../../../components/CSBadge";
import CSCard from "../../../components/CSCard";
import CSHeader from "../../../components/CSHeader";
import CSEmptyState from "../../../components/CSEmptyState";
import CSLoading from "../../../components/CSLoading";
import CSRatingStars from "../../../components/CSRatingStars";
```

**Opção complementar — tree shaking experimental do Expo SDK 52+:**

```bash
# .env
EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH=1
EXPO_UNSTABLE_TREE_SHAKING=1
```

---

## Problema 7 — Inconsistência de Primitivos de Toque (`TouchableOpacity` vs `Pressable`)

### Diagnóstico

O Design System (componentes `CS*`) foi construído sobre `Pressable`. As telas de produto, entretanto, utilizam `TouchableOpacity` em **mais de 30 instâncias** distribuídas em 6 arquivos:

| Arquivo | Instâncias |
|:---|:---:|
| `PerfilScreen.js` | 7 |
| `UserScreen.js` | 6 |
| `LoginScreen.js` | 5 |
| `SugestoesPendentesScreen.js` | 3 |
| `GeoLocalizacaoScreen.js` | 2 |
| `PrivacidadeScreen.js` | 1 |

O `TouchableOpacity` calcula seu feedback de opacidade via `Animated.timing` com `useNativeDriver: false` — o efeito visual é processado na thread JS. Em momentos de alta carga (ex: keyframe de animação de lista + processamento de resposta HTTP simultâneos), o delay do feedback tátil pode ultrapassar 100ms, percebido pelo usuário como falta de resposta do botão.

O `Pressable` delega o estado `pressed` para a camada nativa (UIKit no iOS, Android View System), garantindo feedback a < 16ms independentemente da carga na thread JS.

**Solução:** criar `CSPressableRow` no Design System para itens de lista/menu e substituir progressivamente os `TouchableOpacity` nas telas:

```javascript
// src/core/components/CSPressableRow.js
export default function CSPressableRow({ onPress, children, style, ...props }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}
      accessibilityRole="button"
      {...props}
    >
      {children}
    </Pressable>
  );
}
```

---

## Problema 8 — Enums de Domínio e Regras de Negócio Embutidas em Componentes Visuais

### Localização

```javascript
// CSHospitalCard.js (linhas 9–20) — duplicado em:
// HospitalDetalheScreen.js (linhas 29–40)
const TIPO_LABEL = { PUBLICO: "Público", PRIVADO: "Privado", FILANTROPICO: "Filantrópico" };
const CATEGORIA_LABEL = { HOSPITAL: "Hospital", UPA: "UPA", UBS: "UBS", OUTRO: "Outro" };

// CSHospitalCard.js (linha 28–30) — regra de negócio RN-15 embutida no componente visual
const temIndicadores =
  indicadores?.notaMedia !== null &&
  indicadores?.notaMedia !== undefined &&
  indicadores?.nAvaliacoes >= 5; // RN-15 hardcoded no componente
```

### Diagnóstico

Componentes do Design System devem ser **puros na camada de apresentação** — recebem dados já processados e apenas os renderizam. A presença de `TIPO_LABEL`, `CATEGORIA_LABEL` e da regra `nAvaliacoes >= 5` no `CSHospitalCard` viola o princípio de separação de responsabilidades:

- A regra RN-15 (mínimo de avaliações para exibir nota) pertence à camada de domínio. Se o backend mudar o threshold de 5 para 10, o desenvolvedor precisará buscar onde esse número está hardcoded — e pode não encontrar no componente visual.
- A duplicação dos mapeamentos em `HospitalDetalheScreen.js` significa que uma alteração de label exige edição em dois lugares.

**Solução — centralizar em módulo de domínio:**

```javascript
// src/core/constants/hospitalDomain.js
export const TIPO_HOSPITAL_LABEL = {
  PUBLICO: "Público",
  PRIVADO: "Privado",
  FILANTROPICO: "Filantrópico",
};

export const CATEGORIA_HOSPITAL_LABEL = {
  HOSPITAL: "Hospital",
  UPA: "UPA",
  UBS: "UBS",
  OUTRO: "Outro",
};

export const MIN_AVALIACOES_PARA_NOTA = 5; // RN-15

export function hasValidIndicadores(indicadores) {
  return indicadores?.notaMedia != null && indicadores?.nAvaliacoes >= MIN_AVALIACOES_PARA_NOTA;
}
```

---

## Problema 9 — `HospitalDetalheScreen` com Função `carregar` Não Estabilizada

### Localização

```javascript
// HospitalDetalheScreen.js (linha 60)
const carregar = async () => { // Recriada a cada render
  setCarregando(true);
  setErro(null);
  // ...
};

useEffect(() => {
  carregar();
}, []); // eslint-disable-line — dependência omitida intencionalmente ou por engano?
```

### Diagnóstico

A função `carregar` é declarada sem `useCallback`, criando uma nova referência a cada render do componente. A dependência vazia `[]` no `useEffect` silencia o aviso do linter mas mascara o padrão inconsistente — `HospitaisScreen.js` utiliza `useCallback` corretamente na função equivalente.

O risco real é o comportamento inesperado caso o `useEffect` seja refatorado para incluir `carregar` como dependência futuramente: sem `useCallback`, o efeito dispara a cada render, causando loop de rerenders → fetch → setState → rerender.

**Solução:**
```javascript
const carregar = useCallback(async () => {
  setCarregando(true);
  setErro(null);
  try {
    const dados = await HospitalService.buscarPorId(id);
    // ...
  } finally {
    setCarregando(false);
  }
}, [id]);
```

---

## Problema 10 — `HeartbeatService` sem Controle de Ciclo de Vida por `AppState`

### Localização

```javascript
// HeartbeatService.js (linha 54)
intervalId = setInterval(enviarHeartbeat, INTERVALO_HEARTBEAT_MS);
```

### Diagnóstico

O próprio código documenta a limitação na linha 9: *"usa `setInterval`, que só executa com o app em foreground"*. O problema não está apenas na ineficácia em background — o `setInterval` continua ativo quando o sistema suspende o app (estado "inactive" no iOS), incrementando o lifecycle counter do JS runtime sem utilidade e sem garantia de execução quando o app efetivamente retornar ao foreground.

Além disso, não há cleanup do subscription ao chamar `pararHeartbeat()` se o `AppState` listener tiver sido criado — potencial memory leak em hot reloads durante desenvolvimento.

**Solução com `AppState`:**

```javascript
import { AppState } from "react-native";

let appStateSubscription = null;

export function iniciarHeartbeat(visitaId) {
  visitaIdAtual = visitaId || null;
  if (!visitaIdAtual || intervalId) return;

  intervalId = setInterval(enviarHeartbeat, INTERVALO_HEARTBEAT_MS);

  appStateSubscription = AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") {
      if (!intervalId && visitaIdAtual) {
        intervalId = setInterval(enviarHeartbeat, INTERVALO_HEARTBEAT_MS);
        enviarHeartbeat(); // Imediato ao retornar ao foreground
      }
    } else {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    }
  });
}

export function pararHeartbeat() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
  appStateSubscription?.remove();
  appStateSubscription = null;
  visitaIdAtual = null;
}
```

---

## Problema 11 — Tipagem Estática (TypeScript) Desativada na Prática

### Localização

```
tsconfig.json (linhas 7 e 8)
Todas as telas e serviços (extensões .js e .jsx)
```

### Diagnóstico

O projeto possui toda a infraestrutura inicial do TypeScript configurada (`typescript` no `package.json`, arquivo `tsconfig.json` e script `typecheck`). No entanto, no `tsconfig.json`, a propriedade `"checkJs"` está definida como `false` e **todos** os arquivos da pasta `src/` utilizam extensões `.js` ou `.jsx`.

Na prática, isso significa que o compilador do TypeScript está rodando no vazio. Ele não verifica nenhum tipo, não alerta sobre acesso a propriedades inexistentes de objetos (`undefined is not an object`) e não garante o contrato entre os componentes do Design System e as telas que os consomem.

Para um aplicativo da área da saúde que trafega objetos complexos (dados de geofencing, respostas da API com dezenas de campos, dados de visita), a ausência de tipagem estática transfere o custo de descoberta de bugs do tempo de compilação para o tempo de execução (runtime), afetando diretamente o usuário final.

### Alternativas de Solução

#### Alternativa 1 — Ativar `checkJs: true` e usar JSDoc (Baixo Esforço)

Mantém os arquivos como `.js`, mas força o compilador a validar o código JavaScript com base na inferência e comentários JSDoc.

#### Alternativa 2 — Migração Incremental para TypeScript Strict (Recomendada)

- Manter `allowJs: true` para não quebrar a compilação atual.
- Migrar os arquivos críticos de `.js` para `.ts` / `.tsx` incrementalmente, começando pelos arquivos de núcleo (core), serviços de API e componentes do Design System.
- Definir interfaces claras para os retornos da API (ex: `IHospital`, `IVisitaAtiva`, `IUsuario`).

**Impacto se não resolvido:** o crescimento da complexidade do estado global (ADR-004) e a grande refatoração de estrutura (ADR-008) serão exponencialmente mais difíceis e propensos a falhas sem a rede de segurança de um compilador de tipos, prolongando o tempo gasto em QA manual e debug.

---

## O que está bem e deve ser preservado

### Design System com Tokens Centralizados
Todos os valores de `colors`, `typography`, `spacing`, `radii` e `shadows` são consumidos de `src/theme/tokens.js`. Não há valores hardcoded espalhados pelos componentes — padrão de excelência que facilita refatorações visuais globais.

### Acessibilidade Consistente
`accessibilityRole`, `accessibilityLabel`, `accessibilityState` e `accessibilityLiveRegion` estão presentes de forma sistemática. `CSLoading` usa `progressbar` corretamente. O tratamento de `accessibilityElementsHidden` nas imagens decorativas do `HomeScreen` é exemplar.

### Skeleton Loading com `useNativeDriver`
`CSLoading` usa `Animated.loop` com `useNativeDriver: true` — a implementação correta para animações de baixo custo na thread JS, delegando as transformações à thread de composição nativa.

### `GeofencingTaskService` com Tolerâncias de Debounce
A implementação de `timersEntrada` e `timersSaida` com `setTimeout` para aplicar as tolerâncias RN-01 (2min) e RN-03 (5min) está correta e evita falsos positivos sem depender de polling. O registro de `TaskManager.defineTask` no escopo de módulo (e não em componente) segue o requisito do Expo Task Manager.

### Documentação Inline Referenciando Regras de Negócio
Os comentários JSDoc referenciando épicos (E2-04, E3-01, RN-15) e seções da especificação (§3.1, §3.5) são rastreáveis e contextualizam decisões não-óbvias — prática que reduz o custo de onboarding e manutenção.

---

## Consequências a Longo Prazo — Manter Status Quo vs. Evoluir

| Dimensão | 6 meses (status quo) | 18 meses (status quo) | Com melhorias implementadas |
|:---|:---|:---|:---|
| **Race condition no refresh** | Incidente esporádico em sessões longas | Reclamações frequentes de logout inesperado em produção | Zero — Mutex garante exatamente um refresh por vez |
| **Custo de alteração da API** | Edição em 4 arquivos por mudança | 6–8 arquivos com novos serviços | 1 arquivo — `apiClient.js` |
| **Performance em dispositivos mid-range** | Perceptível em listas > 30 itens | FPS médio < 30 durante buscas, avaliações negativas nas lojas | 60 FPS consistentes com FlashList + memoização |
| **Segurança dos tokens** | Risco baixo-médio (sem incidents conhecidos) | Risco médio em frota crescente com perfis de dispositivo variados | OWASP M9 endereçado, conformidade §2.2 da especificação |
| **Onboarding de novos engenheiros** | 3–5 dias | 1–2 semanas (mais padrões distintos para aprender) | 1–2 dias com estrutura Feature-First documentada |
| **Consistência de estado entre telas** | Inconsistências pontuais notadas em QA | Inconsistências sistêmicas visíveis para usuários | Estado reativo propagado — zero divergência entre abas |

---

## Roadmap de Execução

### Sprint 1 — Fundação (semana 1–2)
1. Criar `src/core/api/apiClient.js` com Mutex de refresh
2. Migrar `TokenStorage` para `expo-secure-store`
3. Refatorar `HospitalService`, `VisitaService`, `FeedbackService` e `LoginService` para consumir `apiClient`
4. Executar suíte de testes (`npm test`) após cada serviço migrado

### Sprint 2 — Performance de UI (semana 3)
1. Migrar `createStackNavigator` → `createNativeStackNavigator` em `App.js`
2. Adicionar `React.memo` em `CSHospitalCard`, `CSRatingStars`, `CSBadge`
3. Converter `renderItem` para `useCallback` nas 4 telas com listas
4. Instalar e migrar `FlatList` → `FlashList` nas telas de hospitais e sugestões

### Sprint 3 — Estado e Consistência (semana 4–5)
1. Implementar `AuthContext` e `VisitaContext`
2. Refatorar `LoginScreen`, `PerfilScreen` e `HomeScreen` para consumir os contexts
3. Substituir `TouchableOpacity` por `Pressable`/`CSPressableRow`
4. Extrair enums e constantes de domínio para `hospitalDomain.js`

### Sprint 4 — Limpeza e Escalabilidade (semana 6–8)
1. Converter barrel imports para imports diretos em todas as telas
2. Adicionar controle de `AppState` ao `HeartbeatService`
3. Estabilizar `carregar` com `useCallback` na `HospitalDetalheScreen`
4. Remover `src/screens/views/index.js` (barrel de compatibilidade legado)
5. Iniciar migração incremental para estrutura Feature-First (novos módulos)

### Sprint 5 — Tipagem Estática (Ongoing)
1. Tipar respostas da API e entidades de domínio (`core/types/`)
2. Converter Design System (`core/components/`) para `.tsx`
3. Converter Contexts e Hooks (`features/...`) para `.ts`/`.tsx`
