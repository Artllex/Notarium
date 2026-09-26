using System.Reflection;
using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Web.WebView2.Core;
namespace Notarium.WebHost;

public static class ModuleWebRuntime
{
    private static readonly object Gate = new();
    private static bool _configured;
    public static string LoaderFolder(Assembly module) => Path.Combine(Path.GetDirectoryName(module.Location)!, "runtimes", "win-" + RuntimeInformation.ProcessArchitecture.ToString().ToLowerInvariant(), "native");
    public static void Configure(Assembly module)
    {
        lock (Gate)
        {
            if (_configured) return;
            var folder = LoaderFolder(module);
            if (!File.Exists(Path.Combine(folder, "WebView2Loader.dll"))) throw new FileNotFoundException("Brak natywnej zależności WebView2 w module.", Path.Combine(folder, "WebView2Loader.dll"));
            CoreWebView2Environment.SetLoaderDllFolderPath(folder); _configured = true;
        }
    }
}
