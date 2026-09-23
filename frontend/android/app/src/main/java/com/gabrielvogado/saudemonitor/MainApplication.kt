package com.gabrielvogado.saudemonitor

import android.app.Application
import android.content.Context
import android.content.res.Configuration

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ExpoReactHostFactory

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    ExpoReactHostFactory.getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
      // [FIX] Usa o flag de debug do APP (não o ReactBuildConfig.DEBUG da lib RN,
      // que vem false no AAR pré-compilado). Sem isso o app tenta carregar o bundle
      // dos assets e crasha com "Unable to load script" em build debug.
      useDevSupport = BuildConfig.DEBUG
    )
  }

  override fun onCreate() {
    super.onCreate()
    // [FIX TELA BRANCA] Força o dev server a usar 127.0.0.1 (via `adb reverse`),
    // evitando o NAT 10.0.2.2 do emulador que corrompe respostas chunked/gzip
    // grandes e causava "Compiling JS failed" / tela branca infinita.
    // Obs: usar "localhost" NÃO funciona neste emulador (não resolve o hostname);
    // 127.0.0.1 é o loopback IPv4 equivalente, roteado pelo `adb reverse`.
    val prefs = getSharedPreferences("${packageName}_preferences", Context.MODE_PRIVATE)
    prefs.edit().putString("debug_http_host", "127.0.0.1:8081").apply()
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }
}
