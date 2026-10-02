using System.Windows;
namespace Notarium.Contracts;
public interface IModuleNavigationHost
{
    void SetModuleNavigation(UIElement navigation);
}
