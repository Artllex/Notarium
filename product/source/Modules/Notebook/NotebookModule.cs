using Notarium.Contracts;
using System.Windows;
namespace Notatnik;
public sealed class NotebookModule : INotariumModule
{
    public string Id => "notebook";
    public string DisplayName => "Notatnik";
    public Window CreateWindow() => new MainWindow();
}
