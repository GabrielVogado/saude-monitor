import LoginService from "../../screens/auth/service/LoginService";
import { configurarSessao } from "./apiClient";

/**
 * Liga o cliente HTTP ao ciclo de sessão do `LoginService`.
 *
 * Fica num módulo próprio, importado no `index.js` antes das tarefas de geofencing,
 * para que o `apiClient` não precise importar o `LoginService` (o que recriaria o ciclo
 * de import descrito em `apiClient.js`). Vale também quando o sistema acorda o app
 * fechado só para entregar um evento de geofence: o `index.js` é carregado do mesmo jeito.
 */
configurarSessao({
  renovar: () => LoginService.refresh(),
  encerrar: () => LoginService.logout(),
});
