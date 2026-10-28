import 'react-native-gesture-handler';
import {registerRootComponent} from 'expo';
import {envolverRaiz, iniciarMonitoramento} from './src/config/monitoramento';
// Liga o cliente HTTP ao refresh/logout do LoginService antes de qualquer serviço rodar,
// inclusive quando o SO acorda o app fechado só para a tarefa de geofencing abaixo.
import './src/core/api/sessaoApi';
// Registra as tarefas de geofencing antes de qualquer tela: quando o SO acorda o app
// fechado para entregar uma entrada/saída de hospital, o evento só é tratado se a
// tarefa já estiver definida no carregamento do bundle.
import './src/screens/visitas/service/GeofencingTaskService';

import App from './App';

// E8-07: crash reporting. Liga antes de registrar o componente raiz, então cobre também o
// processo que o SO acorda só para a tarefa de geofencing (a tarefa roda depois deste
// ponto). Sem `EXPO_PUBLIC_SENTRY_DSN` (dev local, testes) não faz nada.
iniciarMonitoramento();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(envolverRaiz(App));
