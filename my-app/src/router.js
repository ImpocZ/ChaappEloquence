import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', component: () => import('./views/Landing.vue') },
  { path: '/chat', component: () => import('./views/ChatRoom.vue') },
]

export default createRouter({
  history: createWebHistory(),
  routes,
})