package com.gabrielvogado.saudemonitor.monitoramento

import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import io.sentry.Sentry
import io.sentry.SentryOptions

/**
 * Chamado pelo `onReady` do `Sentry.init` no JS, logo depois do `initNativeSdk`: o SDK nativo é
 * recriado nessa hora, e um processador instalado antes se perderia. Instala uma vez por
 * configuração do SDK.
 */
class LimpezaSentryModule(contexto: ReactApplicationContext) : ReactContextBaseJavaModule(contexto) {

  override fun getName() = "LimpezaSentry"

  @ReactMethod
  fun instalar() {
    val opcoes: SentryOptions = Sentry.getCurrentScopes().options
    for (processador in LimpezaSentry.processadores) {
      if (opcoes.eventProcessors.none { it === processador }) {
        opcoes.addEventProcessor(processador)
      }
    }
  }
}
