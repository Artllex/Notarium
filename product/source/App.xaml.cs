using System.Windows;

namespace Notatnik;

public partial class App : Application
{
    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
        if (e.Args.Length == 2 && e.Args[0] == "--check-modules")
        {
            var catalog = new Notarium.Shell.ModuleCatalog(System.IO.Path.Combine(AppContext.BaseDirectory, "Modules"));
            System.IO.File.WriteAllText(e.Args[1], System.Text.Json.JsonSerializer.Serialize(new { modules = catalog.Modules.Select(module => module.Id), entries = catalog.Entries.Select(entry => new { entry.Id, entry.DisplayName, entry.IsAvailable }), errors = catalog.Errors }));
            Shutdown(catalog.Errors.Count == 0 ? 0 : 1);
            return;
        }
        MainWindow = new Notarium.Shell.MainPanel();
        MainWindow.Show();
    }
}
