/* Legacy path kept so old clients that requested /firebase-messaging-sw.js
   still resolve. Push handling lives on the main PWA SW via firebase-push.js. */
/* eslint-disable no-undef */
importScripts('./firebase-sw-config.js')
importScripts('./firebase-push.js')
