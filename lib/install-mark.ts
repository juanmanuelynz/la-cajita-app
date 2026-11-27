// Marca de la app instalada (pantalla de inicio): con qué ícono se instaló.
// Un script en <head> (app/layout.tsx) la graba antes que cualquier otra cosa
// de la app: si el almacenamiento está vacío es una instalación nueva (queda
// ICON_VERSION); si ya había datos, es de antes (queda "old") y el aviso de
// components/pwa-install.tsx sugiere volver a agregarla. Subir ICON_VERSION
// cuando cambie el ícono.

export const INSTALL_KEY = "la-cajita:instalada"
export const ICON_VERSION = "2"
export const OLD_INSTALL = "old"

export const INSTALL_MARK_SCRIPT = `try{var s=window.matchMedia("(display-mode: standalone)").matches||navigator.standalone===true;if(s){var k=${JSON.stringify(INSTALL_KEY)},v=${JSON.stringify(ICON_VERSION)},m=localStorage.getItem(k);if(m===null)localStorage.setItem(k,localStorage.length?${JSON.stringify(OLD_INSTALL)}:v);else if(m!==v&&m!==${JSON.stringify(OLD_INSTALL)})localStorage.setItem(k,${JSON.stringify(OLD_INSTALL)})}}catch(e){}`
