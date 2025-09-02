import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'

// Importa Vuetify
import 'vuetify/styles';
import { createVuetify } from 'vuetify';
import * as components from 'vuetify/components';
import * as directives from 'vuetify/directives';
import { createMemoryHistory, createRouter } from 'vue-router'
import Custodias from './components/Custodias.vue';
import ProcessFile from './components/ProcessFile.vue';
import Login from './components/Login.vue';

// Crea instancia de Vuetify
const vuetify = createVuetify({
  components,
  directives,
});
const routes = [
  { path: '/', component: Login },
  { path: '/custodias', component: Custodias },
  {path: '/processfile', component: ProcessFile },
]

const router = createRouter({
  history: createMemoryHistory(),
  routes,
})
    export default router
// Crea la aplicación Vue y monta Vuetify y el router
createApp(App).use(vuetify).use(router)
  .mount('#app');
