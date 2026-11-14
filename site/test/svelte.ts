import { mount } from 'svelte'
import App from './svelte-app.svelte'
import '@surdeddd/wmkit/themes/glass.css'

mount(App, { target: document.querySelector('#root') as HTMLElement })
