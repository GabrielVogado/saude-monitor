import 'react-native-gesture-handler';
import {registerRootComponent} from 'expo';
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
registerRootComponent(App);
