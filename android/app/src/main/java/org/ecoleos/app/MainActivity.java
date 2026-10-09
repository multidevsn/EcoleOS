package org.ecoleos.app;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.SslErrorHandler;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.FileNotFoundException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

public final class MainActivity extends Activity {
    /**
     * Origine du serveur École OS.
     *
     * Ce n'est PAS un secret : c'est l'adresse publique du déploiement, envoyée en clair
     * dans chaque requête HTTPS et présente dans les journaux du serveur. La "masquer" par
     * XOR n'apporte aucune sécurité — et l'ancienne table d'octets était corrompue :
     * elle se décodait en « httpw8//egole-ow.vefgel.app » au lieu de
     * « https://ecole-os.vercel.app ». WebView refusait alors cette base URL invalide et
     * l'écran restait désespérément blanc en mode connecté (le mode démo, lui, utilisait une
     * URL valide : d'où le symptôme « la démo marche, la connexion non »).
     *
     * La valeur est maintenant une constante lisible, surchargeable au build sans toucher
     * au code :  ./gradlew assembleRelease -PecoleosServerOrigin=https://mon-ecole.vercel.app
     * Elle est de toute façon revalidée par {@link #normalizeOrigin(String)} avant usage.
     */
    private static final String TRUSTED_SERVER_ORIGIN = BuildConfig.SERVER_ORIGIN;

    /** Origine utilisée par le mode démo : base locale valide, aucun serveur à joindre. */
    private static final String DEMO_SERVER_ORIGIN = "https://demo.ecole-os.invalid";

    private static final String PREFS = "ecole_os_app";
    private static final String SERVER_KEY = "server_origin";
    private static final String DEMO_KEY = "demo_origin";
    private static final int FILE_PICKER_REQUEST = 7314;
    private static final int NAVY = Color.rgb(21, 34, 110);
    private static final int INK = Color.rgb(32, 39, 68);
    private static final int MUTED = Color.rgb(98, 105, 125);
    private static final int PAPER = Color.rgb(248, 249, 253);
    private static final int BORDER = Color.rgb(223, 227, 239);

    private LinearLayout root;
    private FrameLayout content;
    private WebView webView;
    private TextView connectionLabel;
    private volatile String serverOrigin;
    private volatile boolean demoOrigin;
    private ValueCallback<Uri[]> pendingFileSelection;

    // Cache mémoire pour l'index HTML pré-CSP afin d'accélérer le chargement
    private byte[] cachedIndexHtml;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(NAVY);
        getWindow().setNavigationBarColor(Color.WHITE);
        if (Build.VERSION.SDK_INT >= 26) {
            getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR);
        }

        demoOrigin = getPreferences(MODE_PRIVATE).getBoolean(DEMO_KEY, false);
        serverOrigin = demoOrigin ? DEMO_SERVER_ORIGIN : TRUSTED_SERVER_ORIGIN;
        preloadIndexHtml();
        buildShell();
        showWebApp();
    }

    /**
     * Normalise et valide une origine de serveur.
     * Retourne null si la valeur n'est pas une origine HTTPS exploitable par WebView :
     * c'est cette validation qui empêche un écran blanc silencieux.
     */
    private static String normalizeOrigin(String raw) {
        if (raw == null) return null;
        String value = raw.trim();
        if (value.isEmpty()) return null;
        Uri uri;
        try {
            uri = Uri.parse(value);
        } catch (Exception error) {
            return null;
        }
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme())) return null;
        String host = uri.getHost();
        if (host == null || host.isEmpty() || uri.getUserInfo() != null) return null;
        String path = uri.getPath();
        // Une origine ne porte ni chemin, ni query, ni fragment.
        if ((path != null && !path.isEmpty() && !"/".equals(path)) || uri.getQuery() != null || uri.getFragment() != null) {
            return null;
        }
        int port = uri.getPort();
        return port > 0 ? "https://" + host + ":" + port : "https://" + host;
    }

    /** Origine réellement utilisable, ou null si ni le choix courant ni le défaut ne sont valides. */
    private String resolveOrigin(String candidate) {
        String normalized = normalizeOrigin(candidate);
        if (normalized != null) return normalized;
        if (demoOrigin) return normalizeOrigin(DEMO_SERVER_ORIGIN);
        return normalizeOrigin(TRUSTED_SERVER_ORIGIN);
    }

    private void preloadIndexHtml() {
        try (InputStream input = getAssets().open("www/index.html")) {
            String html = new String(readAll(input), StandardCharsets.UTF_8);
            html = addContentSecurityPolicy(html);
            cachedIndexHtml = html.getBytes(StandardCharsets.UTF_8);
        } catch (Exception ignored) {
            cachedIndexHtml = null;
        }
    }

    private void buildShell() {
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.WHITE);
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            int top;
            int bottom;
            if (Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(WindowInsets.Type.systemBars());
                top = bars.top;
                bottom = bars.bottom;
            } else {
                top = insets.getSystemWindowInsetTop();
                bottom = insets.getSystemWindowInsetBottom();
            }
            view.setPadding(0, top, 0, bottom);
            return insets;
        });

        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(18), 0, dp(12), 0);
        toolbar.setBackgroundColor(NAVY);

        TextView title = new TextView(this);
        title.setText(R.string.app_name);
        title.setTextColor(Color.WHITE);
        title.setTextSize(19);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        toolbar.addView(title, new LinearLayout.LayoutParams(0, dp(56), 1));

        connectionLabel = new TextView(this);
        connectionLabel.setTextColor(Color.rgb(223, 229, 255));
        connectionLabel.setTextSize(12);
        connectionLabel.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.addView(connectionLabel, new LinearLayout.LayoutParams(0, dp(56), 1));

        // Bouton blanc avec texte NAVY bien visible et lisible
        Button settings = new Button(this);
        settings.setText(R.string.server_button);
        settings.setTextColor(NAVY);
        settings.setTextSize(13);
        settings.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        settings.setAllCaps(false);
        settings.setMinWidth(0);
        settings.setPadding(dp(12), 0, dp(12), 0);
        settings.setBackground(tint(Color.WHITE, 18, Color.WHITE));
        settings.setOnClickListener(view -> showEndpointDialog());
        toolbar.addView(settings, new LinearLayout.LayoutParams(-2, dp(36)));
        root.addView(toolbar, new LinearLayout.LayoutParams(-1, dp(56)));

        content = new FrameLayout(this);
        content.setBackgroundColor(PAPER);
        root.addView(content, new LinearLayout.LayoutParams(-1, 0, 1));
        setContentView(root);
        root.requestApplyInsets();
    }

    private void showEndpointDialog() {
        new AlertDialog.Builder(this)
                .setTitle(R.string.settings_title)
                .setMessage(R.string.settings_message)
                .setNegativeButton(R.string.button_cancel, null)
                .setNeutralButton(R.string.setup_demo_button, (dialog, which) -> switchOrigin(true))
                .setPositiveButton(R.string.setup_connect_button, (dialog, which) -> switchOrigin(false))
                .show();
    }

    private void switchOrigin(boolean useDemo) {
        demoOrigin = useDemo;
        serverOrigin = useDemo ? DEMO_SERVER_ORIGIN : TRUSTED_SERVER_ORIGIN;
        getPreferences(MODE_PRIVATE).edit().putBoolean(DEMO_KEY, demoOrigin).apply();
        showWebApp();
    }

    /**
     * Écran natif de secours. Sans lui, tout échec de chargement laissait l'utilisateur
     * devant un WebView vide, sans explication ni action possible.
     */
    private void showNativeError(String message) {
        connectionLabel.setText(demoOrigin ? getString(R.string.status_demo) : getString(R.string.status_server, hostLabel(serverOrigin)));
        content.removeAllViews();
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }

        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setBackgroundColor(Color.WHITE);
        card.setGravity(Gravity.CENTER_HORIZONTAL);
        card.setPadding(dp(28), dp(34), dp(28), dp(28));

        TextView title = new TextView(this);
        title.setText(R.string.error_title);
        title.setTextColor(INK);
        title.setTextSize(19);
        title.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        card.addView(title, new LinearLayout.LayoutParams(-1, -2));

        TextView detail = new TextView(this);
        detail.setText(message);
        detail.setTextColor(MUTED);
        detail.setTextSize(14);
        detail.setLineSpacing(0, 1.25f);
        LinearLayout.LayoutParams detailLayout = new LinearLayout.LayoutParams(-1, -2);
        detailLayout.topMargin = dp(10);
        card.addView(detail, detailLayout);

        if (serverOrigin != null) {
            TextView origin = new TextView(this);
            origin.setText(getString(R.string.error_origin, serverOrigin));
            origin.setTextColor(MUTED);
            origin.setTextSize(12);
            origin.setTypeface(Typeface.MONOSPACE);
            LinearLayout.LayoutParams originLayout = new LinearLayout.LayoutParams(-1, -2);
            originLayout.topMargin = dp(12);
            card.addView(origin, originLayout);
        }

        Button retry = new Button(this);
        retry.setText(R.string.error_retry);
        retry.setTextColor(Color.WHITE);
        retry.setTextSize(14);
        retry.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        retry.setAllCaps(false);
        retry.setBackground(tint(NAVY, 12, NAVY));
        retry.setOnClickListener(view -> showWebApp());
        LinearLayout.LayoutParams retryLayout = new LinearLayout.LayoutParams(-1, dp(46));
        retryLayout.topMargin = dp(24);
        card.addView(retry, retryLayout);

        Button options = new Button(this);
        options.setText(R.string.server_button);
        options.setTextColor(NAVY);
        options.setTextSize(13);
        options.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        options.setAllCaps(false);
        options.setBackground(tint(Color.WHITE, 12, BORDER));
        options.setOnClickListener(view -> showEndpointDialog());
        LinearLayout.LayoutParams optionsLayout = new LinearLayout.LayoutParams(-1, dp(46));
        optionsLayout.topMargin = dp(10);
        card.addView(options, optionsLayout);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(PAPER);
        scroll.addView(card, new FrameLayout.LayoutParams(-1, -2));
        content.addView(scroll, new FrameLayout.LayoutParams(-1, -1));
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void showWebApp() {
        // Validation avant tout : une origine invalide faisait charger WebView sur une base
        // URL inutilisable, donc un écran blanc sans aucun message d'erreur.
        String validated = resolveOrigin(serverOrigin);
        if (validated == null) {
            serverOrigin = null;
            showNativeError(getString(R.string.error_bad_origin));
            return;
        }
        serverOrigin = validated;
        connectionLabel.setText(demoOrigin ? getString(R.string.status_demo) : getString(R.string.status_server, hostLabel(serverOrigin)));
        content.removeAllViews();
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setAllowFileAccessFromFileURLs(false);
        settings.setAllowUniversalAccessFromFileURLs(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setLoadsImagesAutomatically(true);
        settings.setBlockNetworkImage(false);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setMediaPlaybackRequiresUserGesture(true);
        if (Build.VERSION.SDK_INT >= 26) settings.setSafeBrowsingEnabled(true);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false);
        WebView.setWebContentsDebuggingEnabled(false);

        webView.setWebViewClient(new AppWebViewClient());
        webView.setWebChromeClient(new AppChromeClient());
        content.addView(webView, new FrameLayout.LayoutParams(-1, -1));

        if (cachedIndexHtml == null) {
            preloadIndexHtml();
        }

        if (cachedIndexHtml == null) {
            showNativeError(getString(R.string.missing_assets));
            return;
        }

        String html = new String(cachedIndexHtml, StandardCharsets.UTF_8);
        webView.loadDataWithBaseURL(serverOrigin + "/", html, "text/html", "UTF-8", null);
    }

    private final class AppWebViewClient extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (isSameOrigin(uri)) {
                String path = uri.getPath() == null ? "/" : uri.getPath();
                if (path.equals("/api") || path.startsWith("/api/")) {
                    if (demoOrigin) return errorResponse(503, "Démo sans serveur API");
                    return null;
                }
                if (path.startsWith("/_vercel/")) return errorResponse(404, "Not found");
                if (path.equals("/sw.js") || path.startsWith("/workbox-")) {
                    return errorResponse(404, "Service Worker disabled in WebView");
                }
                if (!"GET".equalsIgnoreCase(request.getMethod())) return errorResponse(405, "Method not allowed");
                return localAsset(path);
            }
            if (isPaymentHost(uri) || isTrustedService(uri)) return null;
            return errorResponse(403, "External resource blocked");
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            if (!request.isForMainFrame()) return false;
            Uri uri = request.getUrl();
            if (isSameOrigin(uri)) return false;
            // Wave demande l'ouverture de son checkout dans le navigateur / l'application Wave.
            // Le garder dans la WebView peut empêcher la bascule vers l'application native.
            if (isWavePaymentHost(uri)) {
                openExternal(uri);
                return true;
            }
            // SasPay et Paddle gardent leur navigation dans la WebView pour préserver le retour
            // vers l'application et leur flux de checkout ; les autres domaines HTTPS sont externes.
            if (isPaymentHost(uri)) return false;
            if ("https".equalsIgnoreCase(uri.getScheme()) && uri.getUserInfo() == null) {
                openExternal(uri);
            }
            return true;
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            Uri uri = Uri.parse(url);
            if (isSameOrigin(uri)) return false;
            if (isWavePaymentHost(uri)) { openExternal(uri); return true; }
            if (isPaymentHost(uri)) return false;
            if ("https".equalsIgnoreCase(uri.getScheme()) && uri.getUserInfo() == null) openExternal(uri);
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            // Seul le document principal compte : une ressource secondaire en échec ne doit
            // pas remplacer l'interface par un écran d'erreur.
            if (!request.isForMainFrame()) return;
            String description = error == null || error.getDescription() == null ? "" : error.getDescription().toString();
            showNativeError(getString(R.string.connection_failed) + (description.isEmpty() ? "" : "\n" + description));
        }

        @Override
        public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse errorResponse) {
            if (!request.isForMainFrame()) return;
            int status = errorResponse == null ? 0 : errorResponse.getStatusCode();
            showNativeError(getString(R.string.error_http, status == 0 ? "inconnu" : String.valueOf(status)));
        }

        @Override
        public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
            // Ne jamais « proceed » : un certificat invalide bloque le chargement.
            handler.cancel();
            showNativeError(getString(R.string.error_tls));
        }
    }

    private final class AppChromeClient extends WebChromeClient {
        @Override
        public void onProgressChanged(WebView view, int newProgress) {
            // L'utilisateur voit où en est le chargement au lieu d'un écran figé.
            if (newProgress >= 100) {
                connectionLabel.setText(demoOrigin ? getString(R.string.status_demo) : getString(R.string.status_server, hostLabel(serverOrigin)));
            } else {
                connectionLabel.setText(getString(R.string.status_loading, newProgress));
            }
        }

        @Override
        public void onConsoleMessage(android.webkit.ConsoleMessage consoleMessage) {
            android.util.Log.w("EcoleOS", consoleMessage.message()
                    + " @" + consoleMessage.sourceId() + ":" + consoleMessage.lineNumber());
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (pendingFileSelection != null) pendingFileSelection.onReceiveValue(null);
            pendingFileSelection = callback;
            Intent picker = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            picker.addCategory(Intent.CATEGORY_OPENABLE);
            picker.setType("text/csv");
            try {
                startActivityForResult(picker, FILE_PICKER_REQUEST);
                return true;
            } catch (ActivityNotFoundException error) {
                pendingFileSelection = null;
                return false;
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_PICKER_REQUEST || pendingFileSelection == null) return;
        Uri[] results = resultCode == RESULT_OK && data != null && data.getData() != null ? new Uri[]{data.getData()} : null;
        pendingFileSelection.onReceiveValue(results);
        pendingFileSelection = null;
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) webView.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) webView.onResume();
    }

    @Override
    protected void onDestroy() {
        // Le WebView était créé avec le contexte de l'activité et jamais détruit :
        // la fenêtre entière restait retenue en mémoire après chaque fermeture.
        if (webView != null) {
            content.removeView(webView);
            webView.stopLoading();
            webView.setWebViewClient(null);
            webView.setWebChromeClient(null);
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private WebResourceResponse localAsset(String path) {
        if (path.isEmpty() || path.equals("/")) path = "/index.html";
        if (path.contains("..") || path.indexOf('\\') >= 0 || !path.matches("/[A-Za-z0-9._/-]+")) {
            return errorResponse(400, "Invalid asset path");
        }
        if (path.equals("/index.html") && cachedIndexHtml != null) {
            return new WebResourceResponse("text/html", "UTF-8", 200, "OK", null, new ByteArrayInputStream(cachedIndexHtml));
        }
        String assetPath = "www" + path;
        try {
            InputStream stream = getAssets().open(assetPath);
            String mime = mimeType(path);
            return new WebResourceResponse(mime, isText(mime) ? "UTF-8" : null, stream);
        } catch (FileNotFoundException error) {
            if (!path.contains(".")) {
                return localAsset("/index.html");
            }
            return errorResponse(404, "Asset not found");
        } catch (Exception error) {
            return errorResponse(500, "Asset unavailable");
        }
    }

    private WebResourceResponse errorResponse(int status, String message) {
        byte[] body = ("{\"error\":\"" + message.replace("\\", "\\\\").replace("\"", "\\\"") + "\"}")
                .getBytes(StandardCharsets.UTF_8);
        return new WebResourceResponse("application/json", "UTF-8", status,
                status == 404 ? "Not Found" : status == 405 ? "Method Not Allowed" : "Unavailable",
                null, new ByteArrayInputStream(body));
    }

    private boolean isSameOrigin(Uri uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getUserInfo() != null) return false;
        Uri configured = Uri.parse(serverOrigin);
        return configured.getHost() != null && configured.getHost().equalsIgnoreCase(uri.getHost())
                && effectivePort(configured) == effectivePort(uri);
    }

    private int effectivePort(Uri uri) {
        return uri.getPort() < 0 ? 443 : uri.getPort();
    }

    private boolean isTrustedService(Uri uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getUserInfo() != null) return false;
        String host = uri.getHost();
        if (host == null) return false;
        host = host.toLowerCase(Locale.ROOT);
        return host.equals("supabase.co") || host.endsWith(".supabase.co")
                || host.equals("paddle.com") || host.endsWith(".paddle.com")
                || host.equals("wave.com") || host.endsWith(".wave.com")
                || host.equals("pay.saspay.me");
    }

    private void openExternal(Uri uri) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (ActivityNotFoundException ignored) {
            Toast.makeText(MainActivity.this, R.string.no_browser, Toast.LENGTH_SHORT).show();
        }
    }

    private boolean isWavePaymentHost(Uri uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getUserInfo() != null) return false;
        String host = uri.getHost();
        return host != null && host.equalsIgnoreCase("pay.wave.com");
    }

    private boolean isPaymentHost(Uri uri) {
        if (uri == null || !"https".equalsIgnoreCase(uri.getScheme()) || uri.getUserInfo() != null) return false;
        String host = uri.getHost();
        if (host == null) return false;
        host = host.toLowerCase(Locale.ROOT);
        return host.equals("wave.com") || host.endsWith(".wave.com")
                || host.equals("paddle.com") || host.endsWith(".paddle.com")
                || host.equals("pay.saspay.me");
    }

    private String addContentSecurityPolicy(String html) {
        String policy = "default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; "
                + "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.paddle.com https://*.paddle.com; "
                + "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; "
                + "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.paddle.com; "
                + "frame-src 'self' https://*.paddle.com https://*.wave.com https://pay.saspay.me; "
                + "form-action 'self' https://*.paddle.com https://*.wave.com https://pay.saspay.me; upgrade-insecure-requests";
        String meta = "<meta http-equiv=\"Content-Security-Policy\" content=\"" + policy + "\">";
        int head = html.toLowerCase(Locale.ROOT).indexOf("<head>");
        if (head < 0) return html;
        int insertionPoint = head + "<head>".length();
        return html.substring(0, insertionPoint) + meta + html.substring(insertionPoint);
    }

    private String hostLabel(String origin) {
        Uri uri = Uri.parse(origin);
        return uri.getHost() == null ? "Connecté" : uri.getHost();
    }

    private String mimeType(String path) {
        String lower = path.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".html")) return "text/html";
        if (lower.endsWith(".js")) return "application/javascript";
        if (lower.endsWith(".css")) return "text/css";
        if (lower.endsWith(".svg")) return "image/svg+xml";
        if (lower.endsWith(".png")) return "image/png";
        if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
        if (lower.endsWith(".webmanifest")) return "application/manifest+json";
        if (lower.endsWith(".woff2")) return "font/woff2";
        if (lower.endsWith(".woff")) return "font/woff";
        if (lower.endsWith(".ico")) return "image/x-icon";
        return "application/octet-stream";
    }

    private boolean isText(String mime) {
        return mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("svg");
    }

    private byte[] readAll(InputStream input) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        byte[] buffer = new byte[8192];
        int count;
        while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
        return output.toByteArray();
    }

    private GradientDrawable tint(int fill, int radiusDp, int stroke) {
        GradientDrawable drawable = new GradientDrawable();
        drawable.setColor(fill);
        drawable.setCornerRadius(dp(radiusDp));
        if (stroke != fill) drawable.setStroke(dp(1), stroke);
        return drawable;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }
}
