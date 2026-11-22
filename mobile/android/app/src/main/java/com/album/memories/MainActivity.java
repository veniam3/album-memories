package com.album.memories;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Ссылки на песни открываем в браузере, а не внутри альбома.
        getBridge().getWebView().addJavascriptInterface(new Object() {
            @JavascriptInterface
            public void openUrl(String url) {
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)));
                } catch (Exception ignored) {
                }
            }
        }, "Android");
    }
}
