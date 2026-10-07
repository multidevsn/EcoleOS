# Rules for École OS Release build
-keep class org.ecoleos.app.MainActivity { *; }
-keep class org.ecoleos.app.** { *; }
-keepclassmembers class * extends android.app.Activity { *; }
-keepclassmembers class * extends android.webkit.WebViewClient { *; }
-keepclassmembers class * extends android.webkit.WebChromeClient { *; }
-dontwarn android.webkit.**
