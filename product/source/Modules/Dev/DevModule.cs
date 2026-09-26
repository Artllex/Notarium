using System.Windows;
using Notarium.Contracts;
namespace Notarium.Dev;

public sealed class DevModule : INotariumModule
{
    public string Id => "dev";
    public string DisplayName => "DEV tests";
    public Window CreateWindow() => new DevWindow();
}
