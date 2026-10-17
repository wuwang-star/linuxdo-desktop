import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
// 样式按部位拆分（assets/styles/），引入顺序即优先级
import './assets/styles/tokens.css'
import './assets/styles/base.css'
import './assets/styles/shell.css'
import './assets/styles/topbar.css'
import './assets/styles/browse.css'
import './assets/styles/home.css'
import './assets/styles/topic.css'
import './assets/styles/login.css'
import './assets/styles/settings.css'
import './assets/styles/notifications.css'
import './assets/styles/user.css'
import './assets/styles/lightbox.css'

createApp(App).use(createPinia()).use(router).mount('#app')
