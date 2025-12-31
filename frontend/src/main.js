import { createApp } from 'vue';
import PrimeVue from 'primevue/config';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';
import Password from 'primevue/password';
import Card from 'primevue/card';
import DataTable from 'primevue/datatable';
import Column from 'primevue/column';
import ProgressBar from 'primevue/progressbar';
import Panel from 'primevue/panel';
import Divider from 'primevue/divider';
import Avatar from 'primevue/avatar';
import Toolbar from 'primevue/toolbar';
import Tag from 'primevue/tag';
import Skeleton from 'primevue/skeleton';
import Toast from 'primevue/toast';
import ProgressSpinner from 'primevue/progressspinner';
import ToastService from 'primevue/toastservice';
import Breadcrumb from 'primevue/breadcrumb';
import RadioButton from 'primevue/radiobutton';
import InputNumber from 'primevue/inputnumber';
import Dialog from 'primevue/dialog';
import Dropdown from 'primevue/dropdown';
import PickList from 'primevue/picklist';
import Checkbox from 'primevue/checkbox';
import MultiSelect from 'primevue/multiselect';
import InputSwitch from 'primevue/inputswitch';

import 'primevue/resources/themes/aura-light-blue/theme.css';
import 'primevue/resources/primevue.min.css';
import 'primeicons/primeicons.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/prime-overrides.css';

import App from './App.vue';
import router from './router';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from './stores/auth';
import i18n from './plugins/i18n';

const app = createApp(App);
const pinia = createPinia();

setActivePinia(pinia);
app.use(pinia);
app.use(ToastService);

app.component('Button', Button);
app.component('InputText', InputText);
app.component('Password', Password);
app.component('Card', Card);
app.component('DataTable', DataTable);
app.component('Column', Column);
app.component('ProgressBar', ProgressBar);
app.component('Panel', Panel);
app.component('Divider', Divider);
app.component('Avatar', Avatar);
app.component('Toolbar', Toolbar);
app.component('Tag', Tag);
app.component('Skeleton', Skeleton);
app.component('Toast', Toast);
app.component('ProgressSpinner', ProgressSpinner);
app.component('Breadcrumb', Breadcrumb);
app.component('RadioButton', RadioButton);
app.component('InputNumber', InputNumber);
app.component('Dialog', Dialog);
app.component('Dropdown', Dropdown);
app.component('PickList', PickList);
app.component('Checkbox', Checkbox);
app.component('MultiSelect', MultiSelect);
app.component('InputSwitch', InputSwitch);

const bootstrap = async () => {
  const auth = useAuthStore();
  await auth.bootstrap();

  app.use(router);
  app.use(PrimeVue, { ripple: true });
  app.use(i18n);

  app.mount('#app');
};

bootstrap();
