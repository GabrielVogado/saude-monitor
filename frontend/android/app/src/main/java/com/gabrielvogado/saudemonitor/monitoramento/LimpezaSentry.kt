package com.gabrielvogado.saudemonitor.monitoramento

import io.sentry.BackfillingEventProcessor
import io.sentry.Breadcrumb
import io.sentry.EventProcessor
import io.sentry.Hint
import io.sentry.SentryEvent
import io.sentry.protocol.User
import kotlin.math.abs

/**
 * Crash reporting (E8-07): a mesma limpeza do `src/config/monitoramento.js`, para os eventos
 * que nascem no lado nativo (crash Java/Kotlin, ANR). Eles não passam pelo `beforeSend` do
 * JS, e a política de privacidade promete que o próprio app apaga localização, e-mail, nome,
 * senhas, tokens e o identificador do aparelho antes do envio.
 *
 * Mantenha as listas iguais às do JS. O que vem do JS (breadcrumbs, tags) já chega limpo;
 * aqui o alvo é o texto das exceções nativas e o que o próprio SDK nativo acrescenta.
 */
object LimpezaSentry {

  /**
   * O SDK separa as filas: evento "backfillable" (o ANR da sessão anterior, lido do sistema na
   * abertura seguinte) só passa por `BackfillingEventProcessor`, e o resto só pelos outros.
   * Por isso a mesma limpeza entra nas duas.
   */
  val processadores: List<EventProcessor> = listOf(
    object : EventProcessor {
      override fun process(event: SentryEvent, hint: Hint): SentryEvent = limpar(event)
    },
    object : BackfillingEventProcessor {
      override fun process(event: SentryEvent, hint: Hint): SentryEvent = limpar(event)
    },
  )

  private const val REMOVIDO = "[removido]"

  private val CHAVES_SENSIVEIS = setOf(
    "lat", "lng", "lon", "latitude", "longitude", "coords", "coordinates", "posicao",
    "localizacao", "email", "nome", "telefone", "fullname", "phone", "celular", "senha",
    "password", "token", "accesstoken", "refreshtoken", "authorization", "cookie", "cookies",
    "x-cliente-id", "dispositivoid",
    // Query e fragmento da URL, que o breadcrumb de rede nativo guarda à parte.
    "http.query", "http.fragment",
  )

  private val PADROES_DE_TEXTO = listOf(
    Regex("""eyJ[\w-]+\.[\w-]+\.[\w-]+""") to "[token]",
    Regex("""Bearer\s+[\w.~+/=-]+""", RegexOption.IGNORE_CASE) to "Bearer [token]",
    Regex("""(?<![\w.%+-])[\w.%+-]+@[\w-]+(?:\.[\w-]+)+""", RegexOption.IGNORE_CASE) to "[email]",
    // Coordenada em grau decimal com 4+ casas (~11 m), como no JS.
    Regex("""-?\b\d{1,3}\.\d{4,}\b""") to "[coord]",
  )

  fun limparTexto(texto: String?): String? =
    texto?.let { PADROES_DE_TEXTO.fold(it) { atual, (padrao, troca) -> padrao.replace(atual, troca) } }

  private fun semQueryString(url: String): String = url.substringBefore('?').substringBefore('#')

  private fun pareceCoordenada(numero: Double): Boolean {
    if (numero.isNaN() || numero.isInfinite() || abs(numero) > 180) {
      return false
    }
    val decimais = numero.toString().substringAfter('.', "")
    return !decimais.contains('E') && decimais.length >= 4
  }

  private fun limparValor(chave: String, valor: Any?): Any? = when {
    chave.lowercase() in CHAVES_SENSIVEIS -> REMOVIDO
    valor is String -> limparTexto(if (chave == "url") semQueryString(valor) else valor)
    valor is Double -> if (pareceCoordenada(valor)) "[coord]" else valor
    valor is Float -> if (pareceCoordenada(valor.toDouble())) "[coord]" else valor
    valor is Map<*, *> -> valor.entries.associate { (k, v) -> k.toString() to limparValor(k.toString(), v) }
    valor is Collection<*> -> valor.map { limparValor("", it) }
    else -> valor
  }

  private fun limparBreadcrumb(breadcrumb: Breadcrumb) {
    breadcrumb.message = limparTexto(breadcrumb.message)
    val dados = breadcrumb.data
    for (chave in dados.keys.toList()) {
      breadcrumb.setData(chave, limparValor(chave, dados[chave]))
    }
  }

  fun limpar(event: SentryEvent): SentryEvent {
    event.message?.let { mensagem ->
      mensagem.formatted = limparTexto(mensagem.formatted)
      mensagem.message = limparTexto(mensagem.message)
      mensagem.params = null
    }
    event.exceptions?.forEach { it.value = limparTexto(it.value) }
    event.breadcrumbs?.forEach(::limparBreadcrumb)
    event.tags?.let { tags ->
      for (chave in tags.keys.toList()) {
        event.setTag(chave, limparValor(chave, tags[chave]).toString())
      }
    }
    event.extras?.let { extras ->
      for (chave in extras.keys.toList()) {
        event.setExtra(chave, limparValor(chave, extras[chave]))
      }
    }
    // Do usuário fica só o código aleatório da instalação, como no JS e na política.
    event.user = event.user?.id?.let { codigo -> User().apply { id = codigo } }
    event.request = null
    return event
  }
}
