import java.util.Properties

plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

val localProperties = Properties().apply {
  val file = rootProject.file("local.properties")
  if (file.exists()) {
    file.inputStream().use(::load)
  }
}

fun localValue(key: String, fallback: String = ""): String {
  return localProperties.getProperty(key)
    ?: System.getenv(key.replace('.', '_').uppercase())
    ?: fallback
}

fun escapedBuildConfig(value: String): String {
  return "\"" + value
    .replace("\\", "\\\\")
    .replace("\"", "\\\"")
    .replace("\n", "\\n") + "\""
}

android {
  namespace = "com.shorty.control"
  compileSdk = 36

  defaultConfig {
    applicationId = "com.shorty.control"
    minSdk = 28
    targetSdk = 36
    versionCode = 1
    versionName = "1.0"

    testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    vectorDrawables {
      useSupportLibrary = true
    }

    buildConfigField("String", "YOUTUBE_CLIENT_ID", escapedBuildConfig(localValue("shorty.youtubeClientId")))
    buildConfigField("String", "YOUTUBE_CLIENT_SECRET", escapedBuildConfig(localValue("shorty.youtubeClientSecret")))
    buildConfigField("String", "YOUTUBE_TOKEN_REDIRECT_URI", escapedBuildConfig(localValue("shorty.youtubeTokenRedirectUri")))
    buildConfigField("String", "GEMINI_API_KEY", escapedBuildConfig(localValue("shorty.geminiApiKey")))
    buildConfigField("String", "PEXELS_API_KEY", escapedBuildConfig(localValue("shorty.pexelsApiKey")))
    buildConfigField("String", "SHORTY_ADMIN_TOKEN", escapedBuildConfig(localValue("shorty.adminToken")))
  }

  buildTypes {
    release {
      isMinifyEnabled = false
      proguardFiles(
        getDefaultProguardFile("proguard-android-optimize.txt"),
        "proguard-rules.pro"
      )
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }

  buildFeatures {
    buildConfig = true
  }
}

dependencies {
  implementation("androidx.core:core-ktx:1.13.1")
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("com.google.android.material:material:1.12.0")
  implementation("androidx.activity:activity-ktx:1.9.3")
  implementation("com.google.android.gms:play-services-auth:21.2.0")
  implementation("org.purejava:tweetnacl-java:1.1.2")
  implementation("org.bouncycastle:bcprov-jdk18on:1.80")
}
