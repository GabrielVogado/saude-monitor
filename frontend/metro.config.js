// E8-07: a config padrão do Expo com o serializer do Sentry, que grava um Debug ID no bundle
// e no mapa de código. O Sentry casa o erro com o mapa por esse ID, sem depender de o
// release/dist calculado no aparelho bater com o nome usado no envio do build.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
