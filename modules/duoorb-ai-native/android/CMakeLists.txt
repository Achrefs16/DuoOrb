cmake_minimum_required(VERSION 3.18.1)
project(duoorb_ai)

add_library(duoorb_analyzer SHARED IMPORTED)
set_target_properties(duoorb_analyzer PROPERTIES
    IMPORTED_LOCATION ${CMAKE_CURRENT_SOURCE_DIR}/src/main/jniLibs/${ANDROID_ABI}/libduoorb_analyzer.so
    IMPORTED_SONAME libduoorb_analyzer.so
)

add_library(duoorb_ai SHARED src/main/cpp/bridge.cpp)

# Link against Android log and the Rust duoorb_analyzer library
target_link_libraries(duoorb_ai log duoorb_analyzer)
