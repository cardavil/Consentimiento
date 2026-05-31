plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "org.consentia.gateway"
    compileSdk = 34

    defaultConfig {
        applicationId = "org.consentia.gateway"
        minSdk = 26 // Android 8.0+
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"

        // Mismo backend que la web (frontend/js/config.js). Publishable key = seguro exponer.
        buildConfigField("String", "SUPABASE_URL", "\"https://pgouzutwvronvsxgdizk.supabase.co\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"sb_publishable_Nhh9XQqxEIUCRlZeThpUcA_YbwP3uLq\"")
    }

    buildTypes {
        release {
            isMinifyEnabled = false
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
        viewBinding = true
        buildConfig = true
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("com.google.android.material:material:1.12.0")
    implementation("androidx.security:security-crypto:1.1.0-alpha06")
    // Embedded HTTP server
    implementation("org.nanohttpd:nanohttpd:2.3.1")
    // QR pairing (scan the JSON emitted by onboarding)
    implementation("com.journeyapps:zxing-android-embedded:4.3.0")
    // HTTP client para el login email+OTP contra GoTrue (Supabase Auth)
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
}
