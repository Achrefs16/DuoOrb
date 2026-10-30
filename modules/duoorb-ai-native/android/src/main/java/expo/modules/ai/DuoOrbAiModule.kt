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

    AsyncFunction("getRankedActions") { stateJson: String, simulations: Int, threads: Int, topK: Int, promise: Promise ->
      scope.launch {
        try {
          val ranked = DuoOrbNativeBridge.findRankedActions(stateJson, simulations, threads, topK)
          promise.resolve(ranked)
        } catch (_: Throwable) {
          promise.resolve(null)
        }
      }
    }

    AsyncFunction("getBotAction") { stateJson: String, botId: String?, seed: Long, promise: Promise ->
      scope.launch {
        try {
          val action = DuoOrbNativeBridge.getBotAction(stateJson, botId, seed)
          promise.resolve(action)
        } catch (_: Throwable) {
          promise.resolve(null)
        }
      }
    }

    AsyncFunction("getHint") { stateJson: String, promise: Promise ->
      scope.launch {
        try {
          val hint = DuoOrbNativeBridge.getHint(stateJson)
          promise.resolve(hint)
        } catch (_: Throwable) {
          promise.resolve(null)
        }
      }
    }

    AsyncFunction("analyzeGame") { initialStateJson: String, historyJson: String, promise: Promise ->
      scope.launch {
        try {
          val review = DuoOrbNativeBridge.analyzeGame(initialStateJson, historyJson)
          promise.resolve(review)
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

  fun findRankedActions(stateJson: String, simulations: Int, threads: Int, topK: Int): String? {
    return try {
      nativeFindRankedActions(stateJson, simulations, threads, topK)
    } catch (_: Throwable) {
      null
    }
  }

  fun getBotAction(stateJson: String, botId: String?, seed: Long): String? {
    return try {
      nativeGetBotAction(stateJson, botId, seed)
    } catch (_: Throwable) {
      null
    }
  }

  fun getHint(stateJson: String): String? {
    return try {
      nativeGetHint(stateJson)
    } catch (_: Throwable) {
      null
    }
  }

  fun analyzeGame(initialStateJson: String, historyJson: String): String? {
    return try {
      nativeAnalyzeGame(initialStateJson, historyJson)
    } catch (_: Throwable) {
      null
    }
  }

  private external fun nativeFindBestAction(stateJson: String, simulations: Int, threads: Int): String?
  private external fun nativeFindRankedActions(stateJson: String, simulations: Int, threads: Int, topK: Int): String?
  private external fun nativeGetBotAction(stateJson: String, botId: String?, seed: Long): String?
  private external fun nativeGetHint(stateJson: String): String?
  private external fun nativeAnalyzeGame(initialStateJson: String, historyJson: String): String?
}