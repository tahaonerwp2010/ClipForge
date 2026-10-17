package com.clipforge.studio;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.provider.Settings;
import android.widget.Toast;

import androidx.activity.result.ActivityResult;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.core.content.FileProvider;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.lang.reflect.InvocationHandler;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Phone features the Node.js engine asks for: file picker, gallery export, installing updates, keep-alive and the YouTube downloader (yt-dlp). */
@CapacitorPlugin(name = "ClipForge")
public class ClipForgePlugin extends Plugin {

    @Override
    public void load() {
        if (Build.VERSION.SDK_INT >= 33) {
            try {
                if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(getActivity(), new String[]{Manifest.permission.POST_NOTIFICATIONS}, 4711);
                }
            } catch (Throwable ignored) {}
        }
    }

    private void toast(final String t) {
        getActivity().runOnUiThread(() -> Toast.makeText(getContext(), t, Toast.LENGTH_LONG).show());
    }

    // ---------------------------------------------------------------- info
    @PluginMethod
    public void info(PluginCall call) {
        try {
            Context c = getContext();
            JSObject o = new JSObject();
            o.put("nativeLibDir", c.getApplicationInfo().nativeLibraryDir);
            o.put("filesDir", c.getFilesDir().getAbsolutePath());
            File ext = c.getExternalFilesDir(null);
            if (ext == null) ext = c.getFilesDir();
            o.put("extDir", ext.getAbsolutePath());
            o.put("cacheDir", c.getCacheDir().getAbsolutePath());
            PackageInfo pi = c.getPackageManager().getPackageInfo(c.getPackageName(), 0);
            o.put("version", pi.versionName);
            o.put("sdk", Build.VERSION.SDK_INT);
            o.put("androidId", String.valueOf(Settings.Secure.getString(c.getContentResolver(), Settings.Secure.ANDROID_ID)));
            o.put("abi", Build.SUPPORTED_ABIS.length > 0 ? Build.SUPPORTED_ABIS[0] : "");
            call.resolve(o);
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    // ---------------------------------------------------------------- file picker (copies the chosen files into the app so ffmpeg can read them)
    @PluginMethod
    public void pick(PluginCall call) {
        String kind = call.getString("kind", "video");
        boolean multiple = Boolean.TRUE.equals(call.getBoolean("multiple", false));
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        if ("audio".equals(kind)) i.setType("audio/*");
        else if ("image".equals(kind)) i.setType("image/*");
        else if ("font".equals(kind)) {
            i.setType("*/*");
            i.putExtra(Intent.EXTRA_MIME_TYPES, new String[]{"font/ttf", "font/otf", "font/sfnt", "application/x-font-ttf", "application/x-font-otf", "application/octet-stream"});
        } else i.setType("video/*");
        i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, multiple);
        startActivityForResult(call, i, "pickResult");
    }

    @ActivityCallback
    private void pickResult(final PluginCall call, final ActivityResult result) {
        if (call == null) return;
        final JSArray files = new JSArray();
        final JSObject out = new JSObject();
        if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            out.put("files", files);
            call.resolve(out);
            return;
        }
        final List<Uri> uris = new ArrayList<>();
        Intent d = result.getData();
        ClipData cd = d.getClipData();
        if (cd != null) for (int k = 0; k < cd.getItemCount(); k++) uris.add(cd.getItemAt(k).getUri());
        else if (d.getData() != null) uris.add(d.getData());
        new Thread(() -> {
            try {
                File dir = new File(getContext().getFilesDir(), "imports");
                //noinspection ResultOfMethodCallIgnored
                dir.mkdirs();
                ContentResolver cr = getContext().getContentResolver();
                for (Uri u : uris) {
                    String name = "file";
                    long size = -1;
                    Cursor cur = cr.query(u, null, null, null, null);
                    if (cur != null) {
                        try {
                            if (cur.moveToFirst()) {
                                int ni = cur.getColumnIndex(OpenableColumns.DISPLAY_NAME), si = cur.getColumnIndex(OpenableColumns.SIZE);
                                if (ni >= 0) name = cur.getString(ni);
                                if (si >= 0) size = cur.getLong(si);
                            }
                        } finally { cur.close(); }
                    }
                    name = name.replaceAll("[\\\\/:*?\"<>|]", "_");
                    File dest = new File(dir, Integer.toHexString(u.toString().hashCode()) + "_" + name);
                    if (!(dest.exists() && size > 0 && dest.length() == size)) {
                        InputStream in = cr.openInputStream(u);
                        if (in == null) continue;
                        File tmp = new File(dest.getPath() + ".part");
                        OutputStream os = new FileOutputStream(tmp);
                        byte[] buf = new byte[1 << 16];
                        int n;
                        while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                        os.close();
                        in.close();
                        //noinspection ResultOfMethodCallIgnored
                        dest.delete();
                        //noinspection ResultOfMethodCallIgnored
                        tmp.renameTo(dest);
                    }
                    JSObject f = new JSObject();
                    f.put("path", dest.getAbsolutePath());
                    f.put("name", name);
                    files.put(f);
                }
                out.put("files", files);
                call.resolve(out);
            } catch (Exception e) {
                call.reject("Could not open the file: " + e.getMessage());
            }
        }).start();
    }

    // ---------------------------------------------------------------- save a clip to the gallery (Movies/ClipForge)
    @PluginMethod
    public void exportFile(final PluginCall call) {
        final String path = call.getString("path");
        final boolean quiet = Boolean.TRUE.equals(call.getBoolean("quiet", false));
        new Thread(() -> {
            try {
                File f = new File(path);
                if (!f.exists()) { call.reject("File not found"); return; }
                String low = f.getName().toLowerCase();
                String mime = low.endsWith(".mov") ? "video/quicktime" : low.endsWith(".mkv") ? "video/x-matroska" : "video/mp4";
                if (Build.VERSION.SDK_INT >= 29) {
                    ContentResolver cr = getContext().getContentResolver();
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.MediaColumns.DISPLAY_NAME, f.getName());
                    v.put(MediaStore.MediaColumns.MIME_TYPE, mime);
                    v.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_MOVIES + "/ClipForge");
                    v.put(MediaStore.MediaColumns.IS_PENDING, 1);
                    Uri uri = cr.insert(MediaStore.Video.Media.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) throw new Exception("Gallery is not available");
                    OutputStream os = cr.openOutputStream(uri);
                    InputStream in = new FileInputStream(f);
                    byte[] buf = new byte[1 << 16];
                    int n;
                    while ((n = in.read(buf)) > 0) os.write(buf, 0, n);
                    os.close();
                    in.close();
                    ContentValues done = new ContentValues();
                    done.put(MediaStore.MediaColumns.IS_PENDING, 0);
                    cr.update(uri, done, null, null);
                    if (!quiet) toast("Saved to Movies/ClipForge");
                } else {
                    Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
                    Intent s = new Intent(Intent.ACTION_SEND);
                    s.setType(mime);
                    s.putExtra(Intent.EXTRA_STREAM, uri);
                    s.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    Intent ch = Intent.createChooser(s, "Save or share clip");
                    ch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    getContext().startActivity(ch);
                }
                call.resolve();
            } catch (Exception e) {
                call.reject("Could not save the clip: " + e.getMessage());
            }
        }).start();
    }

    // ---------------------------------------------------------------- open links / install updates
    @PluginMethod
    public void openExternal(PluginCall call) {
        try {
            Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(call.getString("url", "")));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    @PluginMethod
    public void installApk(PluginCall call) {
        try {
            File f = new File(call.getString("path", ""));
            if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
                Intent s = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
                s.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(s);
                toast("Allow ClipForge to install apps, then tap Install again.");
                call.reject("Permission needed to install updates");
                return;
            }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", f);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) { call.reject(String.valueOf(e.getMessage())); }
    }

    // ---------------------------------------------------------------- keep working with the screen off
    @PluginMethod
    public void keepAlive(PluginCall call) {
        try {
            Intent i = new Intent(getContext(), KeepAliveService.class);
            if (Boolean.TRUE.equals(call.getBoolean("on", false))) {
                ContextCompat.startForegroundService(getContext(), i);
            } else {
                i.setAction("stop");
                getContext().startService(i);
            }
            call.resolve();
        } catch (Throwable e) { call.resolve(); }
    }

    // ---------------------------------------------------------------- yt-dlp (youtubedl-android; reached by reflection so the app still builds without it)
    private boolean ytReady = false;
    private Object ytObj;
    private Class<?> ytClass;

    private Object singleton(Class<?> c) throws Exception {
        try { return c.getMethod("getInstance").invoke(null); }
        catch (NoSuchMethodException e) { return c.getField("INSTANCE").get(null); }
    }

    @PluginMethod
    public void ytInit(final PluginCall call) {
        new Thread(() -> {
            try {
                synchronized (ClipForgePlugin.this) {
                    if (!ytReady) {
                        ytClass = Class.forName("com.yausername.youtubedl_android.YoutubeDL");
                        ytObj = singleton(ytClass);
                        ytClass.getMethod("init", Context.class).invoke(ytObj, getContext());
                        try {
                            Class<?> fc = Class.forName("com.yausername.ffmpeg.FFmpeg");
                            Object fi = singleton(fc);
                            fc.getMethod("init", Context.class).invoke(fi, getContext());
                        } catch (Throwable ignored) {}
                        ytReady = true;
                        // keep yt-dlp itself fresh (YouTube changes often); a failed update is not fatal
                        try {
                            for (Method m : ytClass.getMethods()) {
                                if (!m.getName().equals("updateYoutubeDL")) continue;
                                Class<?>[] pt = m.getParameterTypes();
                                if (pt.length == 1) { m.invoke(ytObj, getContext()); break; }
                                if (pt.length == 2 && pt[1].isEnum()) {
                                    Object ch = null;
                                    for (Object k : pt[1].getEnumConstants()) if (k.toString().equalsIgnoreCase("STABLE")) ch = k;
                                    if (ch == null) ch = pt[1].getEnumConstants()[0];
                                    m.invoke(ytObj, getContext(), ch);
                                    break;
                                }
                            }
                        } catch (Throwable ignored) {}
                    }
                }
                call.resolve();
            } catch (Throwable e) {
                call.reject("The YouTube downloader is not available in this build: " + e);
            }
        }).start();
    }

    private void emit(String ev, String id, String line) {
        JSObject o = new JSObject();
        o.put("id", id);
        o.put("line", line);
        notifyListeners(ev, o);
    }

    @PluginMethod
    public void ytRun(final PluginCall call) {
        final String id = call.getString("id", "yt");
        final JSArray arr = call.getArray("args");
        new Thread(() -> {
            try {
                if (!ytReady) throw new Exception("not initialised");
                final List<String> args = new ArrayList<>();
                for (int k = 0; k < arr.length(); k++) args.add(arr.getString(k));
                // all options go through one config file (the library keeps one value per option name, but we use some options twice)
                String url = args.remove(args.size() - 1);
                File cfg = new File(getContext().getCacheDir(), "yt_" + id + ".conf");
                StringBuilder sb = new StringBuilder();
                for (String a : args) sb.append('"').append(a.replace("\\", "\\\\").replace("\"", "\\\"")).append("\"\n");
                FileOutputStream fo = new FileOutputStream(cfg);
                fo.write(sb.toString().getBytes("UTF-8"));
                fo.close();

                Class<?> rc = Class.forName("com.yausername.youtubedl_android.YoutubeDLRequest");
                Object req = rc.getConstructor(String.class).newInstance(url);
                rc.getMethod("addOption", String.class, String.class).invoke(req, "--config-locations", cfg.getAbsolutePath());

                final Set<String> seen = new HashSet<>();
                Class<?> f3 = Class.forName("kotlin.jvm.functions.Function3");
                Class<?> unit = Class.forName("kotlin.Unit");
                final Object unitObj = unit.getField("INSTANCE").get(null);
                Object cb = Proxy.newProxyInstance(f3.getClassLoader(), new Class<?>[]{f3}, new InvocationHandler() {
                    @Override public Object invoke(Object p, Method m, Object[] a) {
                        if (m.getName().equals("invoke") && a != null && a.length == 3 && a[2] != null) {
                            String line = String.valueOf(a[2]);
                            seen.add(line);
                            emit("ytLine", id, line);
                        }
                        return unitObj;
                    }
                });
                Method exec = null;
                for (Method m : ytClass.getMethods()) {
                    if (m.getName().equals("execute") && m.getParameterTypes().length > 0 && m.getParameterTypes()[0] == rc) {
                        if (exec == null || m.getParameterTypes().length > exec.getParameterTypes().length) exec = m;
                    }
                }
                if (exec == null) throw new Exception("downloader API not found");
                Class<?>[] pt = exec.getParameterTypes();
                Object[] ca = new Object[pt.length];
                ca[0] = req;
                for (int k = 1; k < pt.length; k++) {
                    if (pt[k] == String.class) ca[k] = id;
                    else if (pt[k] == boolean.class) ca[k] = false;
                    else if (pt[k] == f3) ca[k] = cb;
                    else ca[k] = null;
                }
                Object resp = exec.invoke(ytObj, ca);
                String out = String.valueOf(resp.getClass().getMethod("getOut").invoke(resp));
                for (String l : out.split("\n")) { l = l.replace("\r", ""); if (!l.isEmpty() && !seen.contains(l)) emit("ytLine", id, l); }
                JSObject res = new JSObject();
                res.put("code", 0);
                call.resolve(res);
            } catch (Throwable e) {
                Throwable c = e instanceof java.lang.reflect.InvocationTargetException && e.getCause() != null ? e.getCause() : e;
                String msg = String.valueOf(c.getMessage());
                emit("ytErr", id, msg);
                JSObject res = new JSObject();
                res.put("code", 1);
                res.put("err", msg);
                call.resolve(res);
            }
        }).start();
    }

    @PluginMethod
    public void ytKill(PluginCall call) {
        try {
            if (ytReady) ytClass.getMethod("destroyProcessById", String.class).invoke(ytObj, call.getString("id", ""));
        } catch (Throwable ignored) {}
        call.resolve();
    }
}
