using System.IO;
using System.Reflection;
using System.Runtime.Loader;
using Notarium.Contracts;
namespace Notarium.Shell;

public sealed class ModuleCatalog
{
    public List<INotariumModule> Modules { get; } = new();
    public List<string> Errors { get; } = new();
    public List<ModuleEntry> Entries { get; } = new()
    {
        new("notebook", "Notatnik"), new("calendar", "Kalendarz"),
        new("collections", "Kolekcje"), new("prompting", "Prompting"), new("dev", "DEV tests")
    };
    public ModuleCatalog(string root)
    {
        if (!Directory.Exists(root)) return;
        var folders = Directory.GetDirectories(root);
        AssemblyLoadContext.Default.Resolving += (_, name) =>
        {
            foreach (var folder in folders)
            {
                var path = Path.Combine(folder, name.Name + ".dll");
                if (File.Exists(path)) return AssemblyLoadContext.Default.LoadFromAssemblyPath(path);
            }
            return null;
        };
        foreach (var folder in folders)
        {
            foreach (var path in Directory.GetFiles(folder, "Notarium.*.dll"))
            {
                try
                {
                    var assembly = AssemblyLoadContext.Default.LoadFromAssemblyPath(Path.GetFullPath(path));
                    foreach (var type in assembly.GetTypes().Where(t => !t.IsAbstract && typeof(INotariumModule).IsAssignableFrom(t)))
                    {
                        if (Activator.CreateInstance(type) is INotariumModule module && !Modules.Any(m => m.Id == module.Id))
                        {
                            Modules.Add(module);
                            var index = Entries.FindIndex(entry => entry.Id == module.Id);
                            var entry = new ModuleEntry(module.Id, module.DisplayName, module);
                            if (index >= 0) Entries[index] = entry; else Entries.Add(entry);
                        }
                    }
                }
                catch (Exception error) { Errors.Add($"{Path.GetFileName(folder)}: {error.Message}"); }
            }
        }
    }
}
