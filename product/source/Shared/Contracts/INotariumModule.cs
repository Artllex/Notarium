using System.Windows;
namespace Notarium.Contracts;

// UI module contract only. No shared data model or storage service is implemented here.
public interface INotariumModule
{
    string Id { get; }
    string DisplayName { get; }
    Window CreateWindow();
}
