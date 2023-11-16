# Rubric

A browser extension that allows you to inject custom HTTP request and response headers that are set on all affected requests performed by the browser.

Rubric supports Firefox and Chrome.

## Installation

Install Rubric via [Firefox Add-ons](https://addons.mozilla.org/en-GB/firefox/addon/rubric/) or [Chrome Web Store](https://chromewebstore.google.com/detail/rubric/ajlmfgkdeoeofjledikjcpnphihldlil).

## Local development

For local development with Hot Module Replacement (HMR), only Chrome is supported. Local development is supported for Firefox as well, but HMR will not work due to it relying on service workers which are currently disabled/not supported in Firefox.

1. Checkout the repository
2. Run `npm install`
3. Run `npm run dev`
4. Open Chrome and navigate to `chrome://extensions`
5. Enable "Developer mode"
6. Click "Load unpacked" and select the `dist` folder

To create a production build, run `npm run build`.

## Safari support

While Rubric should in theory support Safari as well, Apple does not make it possible to distribute a Safari Web Extension without it being wrapped in a MacOS native app.

## Technology

Rubric is built on the excellent [CRXJS Vite Plugin](https://crxjs.dev/vite-plugin), using [Preact](https://preactjs.com/) for the popup window rendering and [MUI Material Design](https://mui.com/) library for the components and styling. Rubric is a Manifest V3 extension and uses the [declerativeNetRequest API](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/declarativeNetRequest) to add rules for header injection without having to intercept each request in runtime. 