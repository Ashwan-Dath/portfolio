/**
 * xray/constants.ts
 * Values shared by the X-ray code that runs in the browser (XrayContext) and the tiny script the server
 * puts in the page <head> (app/layout.tsx). It is a plain module (no 'use client'), so server code
 * can import the real string values.
 */

/** localStorage key that remembers whether the visitor left X-ray on. "1" = on, "0" = off. */
export const XRAY_STORAGE_KEY = 'xray-enabled';

/**
 * Runs before the page is painted and switches X-ray on early if it was saved as on, so a returning
 * visitor doesn't see the normal page flash first. Wrapped in try/catch because localStorage throws
 * in some private-browsing modes.
 */
export const XRAY_BOOT_SCRIPT = `try{if(localStorage.getItem('${XRAY_STORAGE_KEY}')==='1'){document.documentElement.dataset.xray='on'}}catch(e){}`;
