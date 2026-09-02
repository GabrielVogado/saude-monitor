# Architectural Decision Records (ADRs) — Saúde Monitor
**Projeto:** Saúde Monitor — Frontend Mobile
**Versão:** 3.1
**Data:** Agosto de 2026 · **Revisão 3.1:** 02/09/2026
**Formato:** MADR — Markdown Any Decision Records
**Público:** Liderança Técnica e Engenharia de Software
**Commit-base da revisão:** `develop@f26666e`

> ### Nota da revisão 3.1 (02/09/2026)
>
> **Todos os 10 ADRs continuam com status `Proposto`. Nenhum foi implementado.** Isso é coerente: entre a redação deles (31/08) e hoje, a Sprint S8 fechou o escopo funcional do app e não houve sprint de refatoração. Eles seguem válidos como plano.
>
> **Mas a ordem de execução mudou.** Estes ADRs tratam de arquitetura do frontend — duplicação de cliente HTTP, gerenciamento de estado, organização de módulos. O problema mais grave do sistema hoje **não está no frontend**: a medição de 02/09/2026 mostra 109 s na primeira abertura (HTTP 503) e 1 a 5 s por requisição com o serviço quente, com origem na instância do backend. **Executar qualquer ADR desta lista antes da Sprint S9 não moveria a experiência do usuário.**
>
> **Pré-condição de engenharia para todos eles:** a esteira **não roda os testes do frontend** (`ci.yml` executa `npm run typecheck` e `npx expo export`, não `npm test`), e o `typecheck` não verifica nada (`checkJs: false` sobre um projeto 100% `.js`). Refatorar o frontend nessa condição é trabalhar sem rede de proteção. **E8-12 e E8-13 (Sprint S10) precedem ADR-001..ADR-010.**
>
> **Ajuste de escopo do ADR-001:** o cliente HTTP unificado precisa contemplar **respostas binárias**. A S8 acrescentou `GET /api/v1/contas/export/pdf`, que devolve `application/pdf` e é consumido com `expo-file-system` — o `request()` descrito no ADR pressupõe `response.json()` e quebraria nesse caso.

---

## ADR-001: Centralização do Cliente HTTP com Proteção contra Race Condition no Refresh de Token

**Data:** 2026-08-31
**Status:** Proposto — **não implementado** (reconfirmado em 02/09/2026 contra `develop@f26666e`)
**Área:** Camada de Comunicação com a API

> ⚠️ **Complemento da revisão 3.1 (02/09/2026) — escopo incompleto.** O `apiClient` proposto assume que toda resposta é JSON. Desde a Sprint S8 existe um endpoint que **não é**: `GET /api/v1/contas/export/pdf` devolve `application/pdf` com `Content-Disposition: attachment` e é baixado no app via `expo-file-system` (`File.downloadFileAsync`), fora do `request()` atual. A implementação deste ADR precisa, portanto, prever um caminho para **download binário autenticado** — com o mesmo tratamento de refresh de token — ou o endpoint de exportação LGPD ficará de fora da centralização, recriando exatamente a duplicação que o ADR pretende eliminar.
>
> **Precedência:** implementar depois de **E8-12** (testes do frontend no CI). Trocar a camada de rede de todos os serviços sem que a esteira execute os 166 testes existentes é risco desnecessário.

---

### Contexto e Problema

As funções `authHeaders()`, `request()` e `buildQuery()` estão duplicadas literalmente em três serviços — `HospitalService.js` (linhas 12–89), `VisitaService.js` (linhas 12–92), `FeedbackService.js` (linhas 12–83) — com uma quarta implementação divergente em `LoginService.excluirConta()` (linhas 112–154).

O `VisitaService.js` explicita a duplicação no comentário da linha 20: *"Replica o padrão de HospitalService.js"*.

Além do custo de manutenção, a duplicação expõe o sistema a uma race condition no refresh de token JWT. O fluxo de falha:

```
t=0ms   HomeScreen dispara buscarAtiva() e listar() simultaneamente
t=1ms   VisitaService recebe HTTP 401 → inicia LoginService.refresh()
t=2ms   HospitalService recebe HTTP 401 → inicia LoginService.refresh() concorrentemente
t=140ms Refresh #1 conclui: refreshToken rotacionado, novo accessToken emitido
t=142ms Refresh #2 chega ao servidor com refreshToken já invalidado → 401
        → LoginService.logout() executado → sessão destruída sem ação do usuário
```

A rotação de refresh token (especificação §3.1) invalida o token antigo ao emitir o novo par. Com cada serviço gerenciando seu próprio ciclo de refresh, requisições concorrentes com 401 garantidamente tentarão usar o mesmo refreshToken — e a segunda sempre chegará com um token já revogado.

Em conexões lentas (redes hospitalares congestionadas, 3G), a janela de concorrência se amplifica, aumentando a frequência do bug em campo.

As implementações também **divergem** em detalhes críticos:
- `VisitaService`, `HospitalService` e `FeedbackService` enriquecem o objeto de erro com `.status` e `.data`
- `LoginService.excluirConta()` usa uma implementação própria sem renovação de token em 401 — falhas silenciosas em exclusão de conta com sessão próxima do vencimento

---

### Opções Avaliadas

**Opção 1 — Extrair para `src/shared/http.js`**
- Centraliza manutenção
- Não resolve a race condition — apenas consolida o código num lugar
- Não oferece ponto único para features futuras (interceptors, métricas, modo offline)

**Opção 2 — `apiClient.js` com Mutex de refresh** ← Decisão
- Resolve a race condition via Promise compartilhada (coalesce pattern)
- Ponto único de modificação para toda a camada HTTP
- Serviços ficam com responsabilidade única: mapear endpoints da API

**Opção 3 — `@tanstack/react-query`**
- Resolve HTTP + cache + retry + sincronização de foreground/background
- Elimina `useState + useEffect` boilerplate para dados remotos nas telas
- Curva de aprendizado; mudança de paradigma para hooks `useQuery`/`useMutation`
- Recomendada para fase 2, após estabilização da Opção 2

---

### Decisão

Implementar a Opção 2. Criar `src/core/api/apiClient.js` com Mutex de refresh:

```javascript
// src/core/api/apiClient.js
let refreshPromise = null;

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
  const doFetch = async () => { /* fetch com authHeaders */ };
  let response = await doFetch();
  if (response.status === 401) {
    await renovarToken(); // Exatamente um refresh por vez, N requisições aguardam
    response = await doFetch();
  }
  // ... parse + throw padronizado
}

export const api = {
  get:    (path, opts)       => apiRequest(path, { ...opts, method: "GET" }),
  post:   (path, body, opts) => apiRequest(path, { ...opts, method: "POST", body }),
  put:    (path, body, opts) => apiRequest(path, { ...opts, method: "PUT", body }),
  patch:  (path, body, opts) => apiRequest(path, { ...opts, method: "PATCH", body }),
  delete: (path, opts)       => apiRequest(path, { ...opts, method: "DELETE" }),
};
```

---

### Consequências

**Positivas:**
- Race condition de 401 eliminada — N requisições concorrentes com token expirado resultam em exatamente um refresh
- Redução de ~200 linhas de código duplicado
- Mudanças na camada HTTP (novo header, timeout, retry, logs) ocorrem em um único arquivo
- `LoginService.excluirConta()` passa a ter cobertura de renovação de token consistente com os demais serviços

**Negativas:**
- Refatoração dos 4 serviços existentes requer suite de testes de regressão no fluxo de autenticação
- Importação dinâmica de `LoginService` no `apiClient` é necessária para evitar dependência circular — adiciona latência negligível (~0ms, já resolvido em memória após a primeira invocação)

---

## ADR-002: Migração para `createNativeStackNavigator`

**Data:** 2026-08-31
**Status:** Proposto
**Área:** Navegação e Performance de UI

---

### Contexto e Problema

`App.js` (linha 2) utiliza `createStackNavigator` de `@react-navigation/stack`, que implementa transições de tela via animações calculadas na thread JavaScript. A thread JS é compartilhada com renderização de componentes, processamento de respostas HTTP, cálculos de geofencing e debounce de busca.

Em cenários de carga simultânea — transição para `GeoLocalizacaoScreen` enquanto `iniciarGeofencing()` resolve permissões e busca hospitais — a thread JS é bloqueada e os quadros de animação são descartados.

O `@react-navigation/native-stack` (já instalado no `package.json`) delega transições para:
- iOS: `UINavigationController` — processado pelo compositor do sistema
- Android: `FragmentTransaction` — gerenciado pelo sistema operacional

O app usa `headerShown: false` em todos os navigators — não há personalização JS de cabeçalho que requeira o stack legado.

---

### Opções Avaliadas

**Opção 1 — Configurar `CardStyleInterpolators` no stack JS atual**
- Melhora cosmética sem resolver a causa raiz (thread compartilhada)

**Opção 2 — Migrar para `createNativeStackNavigator`** ← Decisão
- Transições a 60 FPS (120 FPS em ProMotion) independentes da carga na thread JS
- Mudança de 2 linhas no `App.js`
- Risco mínimo: API idêntica ao stack JS para o uso atual do projeto

---

### Decisão

```javascript
// App.js — antes
import { createStackNavigator } from "@react-navigation/stack";

// App.js — depois
import { createNativeStackNavigator } from "@react-navigation/native-stack";
```

---

### Consequências

**Positivas:** transições de tela a 60 FPS independente de carga na thread JS; menor consumo de CPU durante navegação; suporte nativo a gesture de swipe-back no iOS.

**Negativas:** algumas customizações avançadas de cabeçalho (transformações 3D, shared element transitions personalizadas) são mais restritas no native-stack — irrelevante para o uso atual do projeto.

---

## ADR-003: Adoção de `@shopify/flash-list` para Telas de Listagem

**Data:** 2026-08-31
**Status:** Proposto
**Área:** Performance de Renderização

---

### Contexto e Problema

Quatro pontos de uso de `FlatList` identificados:
- `HospitaisScreen.js` (linha 136)
- `SugestoesPendentesScreen.js` (linha 161)
- `CheckinManualScreen.js` (linha 119)
- `CSSelect.js` (linha 54)

**Problema 1 — `renderItem` declarado inline:**

```javascript
// HospitaisScreen.js (linhas 139–141)
renderItem={({ item }) => (
  <CSHospitalCard hospital={item} onPress={() => abrirDetalhe(item)} />
)}
```

A cada re-render da tela — disparado a cada keystroke no campo de busca (debounce de 400ms) — uma nova referência de função é passada como `renderItem`. O `FlatList` interpreta como mudança de prop e invalida a memoização interna de todos os itens visíveis. Com 20 hospitais, cada keystroke dispara a reconciliação de 20 instâncias de `CSHospitalCard` e seus subcomponentes.

**Problema 2 — Ausência de `React.memo` nos componentes de item:**

`CSHospitalCard`, `CSBadge` e `CSRatingStars` não são memoizados. Com `renderItem` inline e sem `React.memo`, não há nenhuma camada de proteção contra re-renders na cadeia de renderização de cada item.

**Problema 3 — Sem reciclagem de views nativas:**

O `FlatList` desmonta itens que saem da janela de renderização e recria as views nativas quando eles retornam. Em cards complexos como `CSHospitalCard` (ícones SVG, múltiplos `Text`, `CSBadge`), isso gera pressão no GC e blank areas durante scroll rápido.

---

### Opções Avaliadas

**Opção 1 — Otimizar `FlatList` com `useCallback` + `getItemLayout`**
- Melhora de 30–40% sem nova dependência
- Não resolve ausência de reciclagem de views nativas
- `getItemLayout` requer altura fixa; os cards têm altura variável

**Opção 2 — `@shopify/flash-list`** ← Decisão
- Recicla componentes React e views nativas (padrão RecyclerView/UICollectionView)
- API ~95% compatível com `FlatList`
- Instalável via `npx expo install`
- Suporta altura variável via `estimatedItemSize`

**Opção 3 — `@legendapp/list`**
- Sem dependência nativa
- Menor adoção em produção para listas verticais padrão
- Indicado se dependências nativas forem restrição

---

### Decisão

Adotar `@shopify/flash-list` com `useCallback` no `renderItem`:

```javascript
const renderHospital = useCallback(({ item }) => (
  <CSHospitalCard hospital={item} onPress={() => abrirDetalhe(item)} />
), [abrirDetalhe]);

<FlashList
  data={dados}
  keyExtractor={(item) => item.id}
  renderItem={renderHospital}
  estimatedItemSize={96}
/>
```

Adicionar `React.memo` com comparação customizada em `CSHospitalCard`:

```javascript
export default React.memo(CSHospitalCard, (prev, next) =>
  prev.hospital?.id === next.hospital?.id &&
  prev.hospital?.indicadores?.notaMedia === next.hospital?.indicadores?.notaMedia &&
  prev.distanciaKm === next.distanciaKm
);
```

---

### Consequências

**Positivas:** scroll a 60 FPS em listas de 50+ itens; redução de 40–60% no uso de memória durante scroll intensivo; eliminação de blank areas.

**Negativas:** requer rebuild do app nativo; `scrollToIndex` e alguns callbacks têm comportamento ligeiramente diferente do `FlatList` — testar após migração.

---

## ADR-004: Gerenciamento de Estado Global Reativo com React Context

**Data:** 2026-08-31
**Status:** Proposto
**Área:** Gerenciamento de Estado

---

### Contexto e Problema

O estado de autenticação e de visita ativa é gerenciado por leitura direta de `AsyncStorage` em cada tela sob demanda. Não há mecanismo de propagação reativa.

**Problema 1 — Dessincronia pós-login:**
Após `LoginService.login()` em `LoginScreen.js`, a navegação para "Inicio" ocorre sem que `HomeScreen` receba notificação de mudança de estado. O estado de sessão só é descoberto no próximo `useFocusEffect`.

**Problema 2 — Leituras redundantes de disco:**
`PerfilScreen` executa `TokenStorage.getUsuario()` a cada foco da aba — operação assíncrona de disco substituível por leitura de memória de um store centralizado.

**Problema 3 — Coordenação imperativa entre `GeofencingTaskService` e `HomeScreen`:**
`GeofencingTaskService.js` mantém `visitaAtivaId` em variável de módulo e depende de chamada explícita a `sincronizarVisitaAtiva()`. Essa ponte é propensa a divergência quando o processo JS é reiniciado pelo sistema operacional em background.

---

### Opções Avaliadas

**Opção 1 — React Context separado por domínio** ← Decisão para MVP
- Nativo do React, sem dependência adicional
- Contexts separados por domínio evitam re-renders globais desnecessários
- Limitação: re-renders em contextos com valores object exigem `useMemo` cuidadoso

**Opção 2 — Zustand**
- API mínima (`create`, `set`, `get`)
- Seletores finos — componentes se inscrevem apenas nos campos que consomem
- Funciona fora do ciclo React (em serviços e tasks de background)
- ~3KB gzipped

**Opção 3 — Redux Toolkit**
- Padrão consolidado para aplicações com store complexo
- Overhead de boilerplate desproporcional ao tamanho atual do projeto

---

### Decisão

Implementar a Opção 1 com dois Contexts separados:

**`AuthContext`** — estado de sessão (usuário, isAuthenticated, login, logout)

```javascript
// src/features/auth/AuthContext.jsx
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

  if (!inicializado) return null;

  return (
    <AuthContext.Provider value={{ usuario, isAuthenticated: !!usuario, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
```

**`VisitaContext`** — visita ativa, sincronizada com `GeofencingTaskService` e `HeartbeatService`

A separação é deliberada: `VisitaContext` atualiza a cada heartbeat (30min) e a cada evento de geofencing. Unificar com `AuthContext` causaria re-renders globais desnecessários em componentes que apenas precisam saber se o usuário está autenticado.

Se o número de stores crescer além de 5 ou surgir necessidade de estado fora do React, migrar para Zustand.

---

### Consequências

**Positivas:** estado de login/logout propagado reativamente para todas as telas; leituras redundantes de disco eliminadas; `GeofencingTaskService` sincronizado via `VisitaContext` em vez de chamada imperativa.

**Negativas:** `AuthProvider` e `VisitaProvider` adicionados ao topo de `App.js`; telas precisam ser refatoradas de chamadas diretas a serviços para hooks de context.

---

## ADR-005: Migração de Tokens JWT para `expo-secure-store`

**Data:** 2026-08-31
**Status:** Proposto (TODO documentado na linha 9 de `TokenStorage.js`)
**Área:** Segurança e Conformidade

---

### Contexto e Problema

`TokenStorage.js` usa `AsyncStorage` para persistir tokens JWT. O risco está documentado no próprio arquivo:

```javascript
// TODO (pré-produção): migrar para `expo-secure-store` no nativo, conforme §2.2
```

`AsyncStorage` armazena dados sem criptografia de camada de aplicação. Vetores de exposição:
- Dispositivos Android com root
- Backups ADB sem criptografia (`adb backup`, habilitado por padrão até Android 12)
- Extração forense física em dispositivos sem Full Disk Encryption (APIs < 28)

Classificação: OWASP Mobile Top 10 — **M9: Insecure Data Storage**.

Para um app que processa dados de visitas hospitalares, feedbacks de atendimento médico e localização em tempo real, o vazamento de tokens representa risco de não conformidade com o Art. 46 da LGPD.

---

### Opções Avaliadas

**Opção 1 — `expo-secure-store` com fallback para Web** ← Decisão
- iOS: Keychain Services
- Android: Android Keystore (API 18+) / EncryptedSharedPreferences
- Aprovados pelas políticas de segurança das App Stores
- API de substituição direta ao `AsyncStorage` para este caso de uso

**Opção 2 — Criptografar dados no `AsyncStorage`**
- Complexidade de gestão de chaves no cliente
- Chave de criptografia precisa estar acessível ao app — eficácia questionável

---

### Decisão

```javascript
// src/core/storage/TokenStorage.js
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

async function setSecure(key, value) {
  if (Platform.OS === "web") {
    sessionStorage.setItem(key, value);
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

**Atenção:** `SecureStore` no iOS tem limite de 2KB por item. O objeto `usuario` serializado deve ser monitorado à medida que o perfil cresce.

---

### Consequências

**Positivas:** conformidade com LGPD Art. 46 e políticas das App Stores; tokens protegidos por TEE (Trusted Execution Environment) do dispositivo; eliminação do risco de vazamento via backup não criptografado.

**Negativas:** usuários com a versão anterior precisam de migração transparente na primeira abertura após o update — o token antigo no `AsyncStorage` ainda pode ser lido para uma transição suave antes de ser removido.

---

## ADR-006: Padronização de Primitivos de Toque — Substituição de `TouchableOpacity` por `Pressable`

**Data:** 2026-08-31
**Status:** Proposto
**Área:** Design System e Performance

---

### Contexto e Problema

O Design System (`CS*` components) foi construído sobre `Pressable`. As telas de produto usam `TouchableOpacity` em **mais de 30 instâncias** em 6 arquivos:

| Arquivo | Instâncias |
|:---|:---:|
| `PerfilScreen.js` | 7 |
| `UserScreen.js` | 6 |
| `LoginScreen.js` | 5 |
| `SugestoesPendentesScreen.js` | 3 |
| `GeoLocalizacaoScreen.js` | 2 |
| `PrivacidadeScreen.js` | 1 |

`TouchableOpacity` calcula o feedback de opacidade via `Animated.timing` com `useNativeDriver: false` — processado na thread JS. Em momentos de alta carga, o delay do feedback tátil pode ultrapassar 100ms.

`Pressable` delega o estado `pressed` para a camada nativa (UIKit/Android View System) — feedback garantido a < 16ms independente da carga na thread JS.

---

### Decisão

Criar `CSPressableRow` no Design System para itens de lista/menu e substituir progressivamente os `TouchableOpacity`:

```javascript
// src/core/components/CSPressableRow.jsx
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

### Consequências

**Positivas:** feedback tátil consistente em todo o app; alinhamento com o modelo de concorrência do React 18+; eliminação de comportamentos diferentes entre telas do Design System e telas de produto.

**Negativas:** substituição em 6 arquivos requer verificação visual em cada tela; animações de opacidade customizadas no `TouchableOpacity` podem precisar ser reimplementadas com `Animated` explícito no `Pressable`.

---

## ADR-007: Centralização de Enums e Constantes de Domínio

**Data:** 2026-08-31
**Status:** Proposto
**Área:** Organização e Manutenibilidade

---

### Contexto e Problema

`TIPO_LABEL` e `CATEGORIA_LABEL` estão declaradas identicamente em dois arquivos:

```javascript
// CSHospitalCard.js (linhas 9–20)
const TIPO_LABEL     = { PUBLICO: "Público", PRIVADO: "Privado", FILANTROPICO: "Filantrópico" };
const CATEGORIA_LABEL = { HOSPITAL: "Hospital", UPA: "UPA", UBS: "UBS", OUTRO: "Outro" };

// HospitalDetalheScreen.js (linhas 29–40) — idêntico
```

Adicionalmente, `CSHospitalCard.js` contém a regra de negócio RN-15 hardcoded (`indicadores?.nAvaliacoes >= 5`). Componentes do Design System devem ser agnósticos a regras de domínio — recebem dados processados e apenas os renderizam.

---

### Decisão

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

`CSHospitalCard` recebe `tipoLabel` e `categoriaLabel` já resolvidos via prop, ou as telas fazem o mapeamento antes de passar o dado — o componente deixa de importar constantes de domínio.

---

### Consequências

**Positivas:** ponto único de manutenção para mapeamentos de domínio; `CSHospitalCard` passa a ser um componente de apresentação puro; mudança de threshold de avaliações (RN-15) impacta apenas `hospitalDomain.js`.

**Negativas:** telas que passam o objeto `hospital` bruto precisam ser atualizadas para fazer o mapeamento ou repassar as props derivadas.

---

## ADR-008: Migração para Estrutura de Pastas Feature-First

**Data:** 2026-08-31
**Status:** Planejado — Migração Incremental
**Área:** Organização, Escalabilidade e Manutenibilidade

---

### Contexto e Problema

#### Estrutura atual mapeada

```
src/
├── components/         ← Design System flat (14 arquivos + barrel index.js)
├── config/             ← api.js isolado
├── screens/
│   ├── auth/           service/ + view/css/
│   ├── feedback/       service/ + view/
│   ├── geolocalizacao/ service/ + view/       ← service/ contém um Context Provider
│   ├── home/           view/ apenas
│   ├── hospitais/      service/ + view/ (5 telas)
│   ├── perfil/         service/ + view/css/
│   ├── user/           view/ apenas
│   ├── visitas/        service/ (3 arquivos) + view/ (1 tela)
│   └── views/          index.js — barrel de compatibilidade legado (10 re-exports)
├── services/           ← TokenStorage.js isolado (diretório singleton)
├── theme/              tokens.js + barrel index.js
└── utils/              format.js, geojson.js, mapStyle.js, normalize.js
```

#### Anti-padrões identificados na estrutura atual

**Anti-padrão 1 — Type-First com fronteiras de módulo cruzadas**

O modelo de organização agrupa por tipo técnico (`screens`, `services`, `components`, `utils`). Para projetos com fronteiras de domínio bem definidas como este (Auth, Hospitais, Visitas, Feedback, Perfil), esse modelo cria acoplamento cruzado não explicitado pela estrutura de diretórios:

- `GeofencingTaskService.js` está em `screens/visitas/service/`, mas é consumido por `screens/home/view/HomeScreen.js` e por `screens/feedback/service/FeedbackNotificationService.js`
- `FeedbackNotificationService.js` está em `screens/feedback/service/`, mas é chamado diretamente por `screens/home/view/HomeScreen.js` e por `GeofencingTaskService.js`
- `LoginService.js` está em `screens/auth/service/`, mas é instanciado como dependência do cliente HTTP duplicado nos 3 outros serviços

O grafo de dependências real **não corresponde** ao que a estrutura de pastas sugere.

**Anti-padrão 2 — `App.js` como arquivo de múltiplas responsabilidades**

`App.js` concentra simultaneamente:
1. Configuração do `NavigationContainer` e definição de todas as rotas
2. Registro do `TaskManager.defineTask` para geofencing em background
3. Setup de `SafeAreaProvider`, `GeolocalizacaoProvider` e outros providers
4. Importação de todas as telas do app

Com o crescimento de features, `App.js` se tornará um ponto de modificação frequente, com alta probabilidade de conflitos em merges de branches paralelas.

**Anti-padrão 3 — `GeoLocalizacaoService.js` é um Context Provider nomeado como Service**

O arquivo `src/screens/geolocalizacao/service/GeoLocalizacaoService.js` exporta `GeolocalizacaoProvider` e `useGeolocalizacao` — é um React Context Provider, não um service de acesso a dados. A convenção `*Service.js` e a localização em `service/` comunicam incorretamente a responsabilidade do módulo.

**Anti-padrão 4 — Convenção de estilos híbrida sem padrão definido**

Dois módulos isolam StyleSheets em subpastas `css/` (`auth/view/css/LoginStyle.js`, `perfil/view/css/PerfilStyle.js`). Os demais 7 módulos definem StyleSheet diretamente no arquivo de tela. Não há convenção documentada — o padrão seguido por novos arquivos depende do módulo que o desenvolvedor usar como referência.

**Anti-padrão 5 — `screens/views/index.js` — shim de compatibilidade não removido**

O arquivo re-exporta 10 telas com o comentário: *"Compatibility barrel for any legacy imports still pointing to src/screens/views."*. A existência de um shim de compatibilidade indica que a estrutura já foi inconsistente a ponto de exigir uma camada de indireção — que permanece no código sem data de remoção.

**Anti-padrão 6 — `src/services/` como diretório singleton**

A pasta contém apenas `TokenStorage.js`. Não representa uma camada arquitetural — é um arquivo sem categoria definida. Simultaneamente, serviços com responsabilidade análoga (`LoginService`, `HospitalService`, `VisitaService`) vivem dentro de `screens/`, comunicando pertencimento exclusivo à tela do módulo.

---

### Opções Avaliadas

**Opção 1 — Manter Type-First e resolver problemas pontualmente**
- Menor custo imediato
- Não resolve acoplamento cruzado entre módulos
- Fricção de onboarding cresce proporcionalmente ao número de features
- Inconsistências estruturais acumulam com cada novo arquivo

**Opção 2 — Migração Big Bang para Feature-First**
- Estrutura final imediata
- Diffs enormes que dificultam revisão e invalidam `git blame`
- Alto risco de conflitos com branches de feature em andamento

**Opção 3 — Migração Incremental Feature-First** ← Decisão
- Princípio: mover arquivos apenas quando já sendo modificados por outra razão
- Commits semânticos: cada movimentação acompanha a refatoração que a motivou
- Coexistência temporária das duas estruturas durante a transição
- Risco mínimo para o desenvolvimento paralelo

---

### Estrutura Proposta

```
src/
├── core/                               ← Infraestrutura genuinamente compartilhada
│   ├── api/
│   │   └── apiClient.js                ← ADR-001: HTTP client unificado com Mutex
│   ├── components/                     ← Design System — sem barrel index.js
│   │   ├── CSBadge.jsx
│   │   ├── CSButton.jsx
│   │   ├── CSCard.jsx
│   │   ├── CSChip.jsx
│   │   ├── CSEmptyState.jsx
│   │   ├── CSHeader.jsx
│   │   ├── CSIconButton.jsx
│   │   ├── CSLoading.jsx
│   │   ├── CSPressableRow.jsx          ← ADR-006: substitui TouchableOpacity
│   │   ├── CSRatingStars.jsx
│   │   ├── CSSelect.jsx
│   │   └── CSTextField.jsx
│   ├── constants/
│   │   └── hospitalDomain.js           ← ADR-007: enums + RN-15
│   ├── storage/
│   │   └── TokenStorage.js             ← ADR-005: migrado para expo-secure-store
│   └── theme/
│       └── tokens.js                   ← sem barrel
│
├── features/
│   ├── auth/
│   │   ├── AuthContext.jsx             ← ADR-004: Provider + useAuth
│   │   ├── services/
│   │   │   └── LoginService.js
│   │   └── screens/
│   │       └── LoginScreen.jsx
│   │
│   ├── hospitais/
│   │   ├── services/
│   │   │   └── HospitalService.js
│   │   └── screens/
│   │       ├── HospitaisScreen.jsx
│   │       ├── HospitalDetalheScreen.jsx
│   │       ├── SugerirHospitalScreen.jsx
│   │       ├── SugestoesPendentesScreen.jsx
│   │       └── RevisarSugestaoScreen.jsx
│   │
│   ├── visitas/
│   │   ├── VisitaContext.jsx           ← ADR-004: Provider + useVisita
│   │   ├── services/
│   │   │   ├── VisitaService.js
│   │   │   ├── GeofencingTaskService.js
│   │   │   └── HeartbeatService.js
│   │   └── screens/
│   │       ├── HomeScreen.jsx
│   │       └── CheckinManualScreen.jsx
│   │
│   ├── feedback/
│   │   ├── services/
│   │   │   ├── FeedbackService.js
│   │   │   └── FeedbackNotificationService.js
│   │   └── screens/
│   │       └── FeedbackFormScreen.jsx
│   │
│   ├── geolocalizacao/
│   │   ├── GeolocalizacaoContext.jsx   ← Renomeado de GeoLocalizacaoService.js
│   │   └── screens/
│   │       └── GeoLocalizacaoScreen.jsx
│   │
│   ├── perfil/
│   │   ├── services/
│   │   │   └── PerfilService.js
│   │   └── screens/
│   │       ├── PerfilScreen.jsx
│   │       └── PrivacidadeScreen.jsx
│   │
│   └── user/
│       └── screens/
│           └── UserScreen.jsx
│
├── navigation/
│   ├── AppNavigator.jsx                ← ADR-002: createNativeStackNavigator
│   └── TabNavigator.jsx
│
└── utils/                              ← Mantido sem alteração
    ├── format.js
    ├── geojson.js
    ├── mapStyle.js
    └── normalize.js
```

---

### Comparativo: Estrutura Atual vs. Proposta

| Aspecto | Atual | Proposta |
|:---|:---|:---|
| Modelo | Type-First | Feature-First com `core/` compartilhado |
| HTTP client | Duplicado em 4 arquivos dentro de `screens/` | `core/api/apiClient.js` |
| Storage | `src/services/TokenStorage.js` (singleton) | `core/storage/TokenStorage.js` |
| Design System | `src/components/` + barrel `index.js` | `core/components/` sem barrel |
| Tema | `src/theme/` com barrel `index.js` | `core/theme/tokens.js` sem barrel |
| Contextos React | Em `service/` (`GeoLocalizacaoService.js`) | `features/<domínio>/<Domínio>Context.jsx` |
| Enums de domínio | Duplicados em 2 arquivos | `core/constants/hospitalDomain.js` |
| Navegação | Inline em `App.js` | `src/navigation/AppNavigator.jsx` |
| Barrel legado | `screens/views/index.js` (shim de 10 re-exports) | Removido |
| Convenção de estilos | Híbrida (`css/` em 2 módulos, inline nos demais) | StyleSheet no mesmo arquivo da tela (padrão único) |

---

### Estratégia de Migração Incremental (3 Fases)

**Fase 0 — Preparação: criar arquivos novos, sem mover nada existente**

Criar os seguintes arquivos sem tocar na estrutura atual:
```
src/core/api/apiClient.js              ← ADR-001
src/core/storage/TokenStorage.js       ← ADR-005
src/core/constants/hospitalDomain.js   ← ADR-007
src/navigation/AppNavigator.jsx        ← Extrair navegação do App.js
```

Atualizar `App.js` para importar `AppNavigator` em vez de declarar rotas inline.

**Fase 1 — Migração por oportunidade: mover ao refatorar**

Cada movimentação deve ser parte de um commit com propósito semântico:
- Ao refatorar `HospitaisScreen` para `FlashList` → mover para `features/hospitais/screens/`
- Ao implementar `AuthContext` → criar `features/auth/` e mover `LoginService` + `LoginScreen`
- Ao corrigir `GeoLocalizacaoService` → renomear para `features/geolocalizacao/GeolocalizacaoContext.jsx`
- Ao migrar `TokenStorage` para SecureStore → mover de `src/services/` para `core/storage/`

**Fase 2 — Limpeza: remoção de artefatos legados**

Após confirmação por `grep` de que nenhum import aponta para os caminhos legados:
```bash
# Verificar antes de remover
grep -r "screens/views" src/
grep -r "from.*services/TokenStorage" src/
grep -r "from.*theme/index" src/
grep -r "from.*components/index" src/
```

Remover:
- `src/screens/views/index.js`
- `src/services/` (após `TokenStorage` estar em `core/storage/`)
- `src/components/index.js` (após todas as telas usarem imports diretos)
- `src/theme/index.js` (após todas as telas importarem de `core/theme/tokens.js`)
- Subpastas `css/` — consolidar `LoginStyle.js` e `PerfilStyle.js` nos arquivos de tela

---

### Consequências

**Positivas:**
- Fronteiras de módulo refletem as fronteiras de domínio de negócio
- `App.js` se torna responsável apenas por: NavigationContainer + Providers + registro de tasks
- `GeoLocalizacaoContext` comunica corretamente sua responsabilidade — Context Provider, não Service
- Convenção de estilos unificada — `StyleSheet` no mesmo arquivo da tela
- `screens/views/index.js` e `src/services/` removidos — zero dead code de compatibilidade
- Onboarding reduzido: desenvolvedores encontram todo o código de uma feature em `features/<domínio>/`

**Negativas:**
- Coexistência temporária das duas estruturas durante a Fase 1 — pode causar confusão em PRs que misturam os dois estilos
- Caminhos de import mudam — IDEs com auto-import podem gerar imports errados até a migração estar completa

---

## ADR-009: Controle de Ciclo de Vida do `HeartbeatService` via `AppState`

**Data:** 2026-08-31
**Status:** Proposto
**Área:** Background Processing e Eficiência de Recursos

---

### Contexto e Problema

`HeartbeatService.js` usa `setInterval` para enviar sinais periódicos ao servidor (30min). O próprio arquivo documenta a limitação (linha 9):

> *"usa `setInterval`, que só executa com o app em foreground"*

O problema adicional não documentado: quando o sistema operacional suspende o app (estado "inactive" no iOS), o `setInterval` permanece ativo na fila de timers do runtime JS, incrementando o lifecycle counter sem garantia de execução. No Android, o sistema pode simplesmente descartar o callback em estado "background" dependendo da prioridade de processo.

Além disso, a função `pararHeartbeat()` não faz cleanup do listener de `AppState` se ele for adicionado externamente — potencial memory leak em hot reloads durante desenvolvimento.

---

### Decisão

Integrar `AppState` ao `HeartbeatService` para pausar o intervalo em background e retomá-lo ao voltar ao foreground, com envio imediato ao retornar:

```javascript
import { AppState } from "react-native";

let intervalId = null;
let visitaIdAtual = null;
let appStateSubscription = null;

export function iniciarHeartbeat(visitaId) {
  visitaIdAtual = visitaId || null;
  if (!visitaIdAtual || intervalId) return;

  intervalId = setInterval(enviarHeartbeat, INTERVALO_HEARTBEAT_MS);

  appStateSubscription = AppState.addEventListener("change", (nextState) => {
    if (nextState === "active") {
      if (!intervalId && visitaIdAtual) {
        intervalId = setInterval(enviarHeartbeat, INTERVALO_HEARTBEAT_MS);
        enviarHeartbeat(); // Sinal imediato ao retornar ao foreground
      }
    } else {
      // "background" ou "inactive"
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

### Consequências

**Positivas:** consumo de CPU em background eliminado; sinal imediato ao retornar ao foreground reduz o risco de `VisitaGpsInterrompidoJob` marcar GPS_INTERROMPIDO incorretamente; cleanup correto evita memory leak em hot reload.

**Negativas:** se o app ficar em background por > 10min sem geofencing cobrir o evento de saída, a visita ainda pode ser marcada como GPS_INTERROMPIDO pelo backend — comportamento documentado e esperado (RN-06).

---

## ADR-010: Migração Incremental para TypeScript (Strict Mode)

**Data:** 2026-08-31
**Status:** Proposto
**Área:** Qualidade de Código e Developer Experience (DX)

---

### Contexto e Problema

O projeto possui a infraestrutura do TypeScript instalada (`typescript` em `package.json`, arquivo `tsconfig.json` configurado), mas encontra-se inativa na prática. A flag `"checkJs"` está desativada (`false`) e todos os arquivos em `src/` possuem extensão `.js` ou `.jsx`.

A ausência de tipagem estática em um aplicativo que trafega objetos complexos do backend transfere a identificação de erros básicos (erros de digitação em propriedades, passagem incorreta de props para componentes do Design System) para o tempo de execução (runtime). Além disso, a grande refatoração estrutural proposta (ADR-008) é significativamente mais arriscada sem a verificação em tempo de compilação.

---

### Decisão

Adotar a **Migração Incremental para TypeScript** com `strict: true`.

1. Manter `"allowJs": true` no `tsconfig.json` para permitir que arquivos não migrados continuem funcionando.
2. Criar uma pasta `src/core/types/` para hospedar as interfaces centrais de domínio (`IHospital`, `IVisita`, `IUsuario`).
3. Migrar os arquivos gradualmente, começando pela base de maior dependência:
   - Nível 1: Constantes de domínio e Tipos
   - Nível 2: Design System (`core/components/`)
   - Nível 3: Cliente HTTP (`apiClient.js`) e APIs
   - Nível 4: Contextos e Providers
   - Nível 5: Telas e Hooks

---

### Consequências

**Positivas:** 
- Erros da categoria `undefined is not an object` mitigados drasticamente.
- Autocompletar (IntelliSense) funcional nos componentes do Design System, agilizando o desenvolvimento.
- Maior segurança durante a refatoração estrutural (ADR-008) e de gerenciamento de estado (ADR-004).

**Negativas:** 
- Curva de aprendizado temporária se a equipe não for fluente em TypeScript.
- Overhead inicial na criação das definições de tipos para as respostas complexas da API.

---

## Resumo de Status

| ADR | Título | Prioridade | Esforço | Impacto |
|:---|:---|:---:|:---:|:---:|
| ADR-001 | HTTP Client com Mutex de Refresh | Crítica | Médio (4–6h) | Alto |
| ADR-002 | Native Stack Navigator | Alta | Mínimo (30min) | Alto |
| ADR-003 | FlashList para Listagens | Alta | Baixo (2–3h) | Alto |
| ADR-004 | React Context (Auth + Visita) | Alta | Médio (4–6h) | Alto |
| ADR-005 | expo-secure-store para Tokens JWT | Alta | Baixo (1–2h) | Alto |
| ADR-006 | Padronizar `Pressable` | Média | Médio (3–4h) | Médio |
| ADR-007 | Centralizar Enums de Domínio | Média | Baixo (1h) | Médio |
| ADR-008 | Estrutura Feature-First | Média | Alto (incremental) | Alto (longo prazo) |
| ADR-009 | `HeartbeatService` com `AppState` | Média | Baixo (1–2h) | Médio |
| ADR-010 | Migração Incremental para TypeScript | Alta | Alto (incremental) | Alto |
