using System.IO;
using System.Runtime.InteropServices;
using Microsoft.Web.WebView2.Core;

namespace Notatnik;

// Native dependencies belong to the module, not to the executable's folder.
public static class NotebookRuntime
{
    public static string LoaderFolder => Notarium.WebHost.ModuleWebRuntime.LoaderFolder(typeof(NotebookRuntime).Assembly);
    public static void Configure() => Notarium.WebHost.ModuleWebRuntime.Configure(typeof(NotebookRuntime).Assembly);
}
