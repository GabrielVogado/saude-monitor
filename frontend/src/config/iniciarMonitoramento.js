import { iniciarMonitoramento } from "./monitoramento";

/**
 * Primeiro import do `index.js` (E8-07). Os `import` sobem para o topo do arquivo, então uma
 * chamada a `iniciarMonitoramento()` no corpo do `index.js` só rodaria depois de `App`,
 * `sessaoApi` e o `defineTask` do geofencing já terem sido avaliados, e um erro no
 * carregamento deles não chegaria ao Sentry. Como módulo próprio, importado antes de todos,
 * o Sentry liga primeiro. Sem `EXPO_PUBLIC_SENTRY_DSN` (dev local, testes) não faz nada.
 */
iniciarMonitoramento();
