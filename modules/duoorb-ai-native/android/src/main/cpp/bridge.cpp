#include <jni.h>
#include <string>

extern "C" {
    char* duoorb_ai_find_best_action(const char* state_json, uint32_t simulations, uint32_t threads, int64_t seed);
    void duoorb_ai_free_string(char* ptr);

    JNIEXPORT jstring JNICALL
    Java_expo_modules_ai_DuoOrbNativeBridge_nativeFindBestAction(
        JNIEnv* env,
        jobject /* this */,
        jstring stateJson,
        jint simulations,
        jint threads
    ) {
        if (!stateJson) return nullptr;
        const char* nativeState = env->GetStringUTFChars(stateJson, nullptr);
        char* result = duoorb_ai_find_best_action(nativeState, (uint32_t)simulations, (uint32_t)threads, 0);
        env->ReleaseStringUTFChars(stateJson, nativeState);

        if (!result) return nullptr;
        jstring jresult = env->NewStringUTF(result);
        duoorb_ai_free_string(result);
        return jresult;
    }
}