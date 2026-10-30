import 'react-native-gesture-handler';
// E8-07: crash reporting. Antes de todo o resto do app, para cobrir também os erros no
// carregamento dos módulos abaixo e o processo que o SO acorda só para o geofencing.
import './src/config/iniciarMonitoramento';
import {registerRootComponent} from 'expo';
import {envolverRaiz} from './src/config/monitoramento';
// Liga o cliente HTTP ao refresh/logout do LoginService antes de qualquer serviço rodar,
// inclusive quando o SO acorda o app fechado só para a tarefa de geofencing abaixo.
import './src/core/api/sessaoApi';
// Registra as tarefas de geofencing antes de qualquer tela: quando o SO acorda o app
// fechado para entregar uma entrada/saída de hospital, o evento só é tratado se a
// tarefa já estiver definida no carregamento do bundle.
import './src/screens/visitas/service/GeofencingTaskService';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(envolverRaiz(App));
