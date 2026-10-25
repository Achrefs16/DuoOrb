cmake_minimum_required(VERSION 3.18.1)
project(duoorb_ai)

add_library(duoorb_ai SHARED src/main/cpp/bridge.cpp)

# Link against Android log and the Rust duoorb_analyzer library
target_link_libraries(duoorb_ai log)