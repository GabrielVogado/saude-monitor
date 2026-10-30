package com.gabrielvogado.saudemonitor.monitoramento

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class LimpezaSentryPackage : ReactPackage {

  override fun createNativeModules(contexto: ReactApplicationContext): List<NativeModule> =
    listOf(LimpezaSentryModule(contexto))

  override fun createViewManagers(contexto: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
