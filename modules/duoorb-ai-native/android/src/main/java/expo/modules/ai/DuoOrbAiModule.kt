package expo.modules.ai

import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class DuoOrbAiModule : Module() {
  private val scope = CoroutineScope(Dispatchers.Default)

  override fun definition() = ModuleDefinition {
    Name("DuoOrbAi")

    AsyncFunction("getBestAction") { stateJson: String, simulations: Int, threads: Int, promise: Promise ->
      scope.launch {
        try {
          val action = DuoOrbNativeBridge.findBestAction(stateJson, simulations, threads)
          promise.resolve(action)
        } catch (_: Throwable) {
          promise.resolve(null)
        }
      }
    }
  }
}

object DuoOrbNativeBridge {
  init {
    try {
      System.loadLibrary("duoorb_analyzer")
    } catch (_: Throwable) {}
  }

  fun findBestAction(stateJson: String, simulations: Int, threads: Int): String? {
    return try {
      nativeFindBestAction(stateJson, simulations, threads)
    } catch (_: Throwable) {
      null
    }
  }

  private external fun nativeFindBestAction(stateJson: String, simulations: Int, threads: Int): String?
}