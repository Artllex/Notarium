using System.Windows;
using System.Windows.Controls;
namespace Notarium.UI;

public class ActionButton : Button
{
    public ActionButton() => SetResourceReference(StyleProperty, typeof(Button));
}
public class ToolPanel : Border { }
public class TabCard : Grid { }
public class CompositePanel : UserControl
{
    public event System.Action<string, object, RoutedEventArgs>? Action;
    protected void Emit(string name, object sender, RoutedEventArgs args) => Action?.Invoke(name, sender, args);
}

// Definitions are MenuItems; the visible controls and every popup belong to
// DropDownMenu. No native MenuItem popup is created by this bar.
public sealed class MenuBar : ItemsControl
{
    private readonly StackPanel _bar = new() { Orientation = Orientation.Horizontal };
    private DropDownMenu? _open;
    public StackPanel Surface => _bar;
    public MenuBar()
    {
        Loaded += (_, _) => Rebuild();
        var factory = new FrameworkElementFactory(typeof(ContentPresenter));
        factory.SetBinding(ContentPresenter.ContentProperty, new System.Windows.Data.Binding(nameof(Surface)) { RelativeSource = new System.Windows.Data.RelativeSource(System.Windows.Data.RelativeSourceMode.TemplatedParent) });
        Template = new ControlTemplate(typeof(ItemsControl)) { VisualTree = factory };
    }
    private void Rebuild()
    {
        _bar.Children.Clear();
        foreach (var definition in Items.OfType<MenuItem>())
        {
            var button = new ActionButton { Content = new AccessText { Text = definition.Header?.ToString() ?? "" }, Foreground = UiPolicy.Current.TextBrush, Padding = new Thickness(10, 2, 10, 2), FontSize = FontSize };
            System.Windows.Automation.AutomationProperties.SetName(button, (definition.Header?.ToString() ?? "").Replace("_", ""));
            void Open()
            {
                _open?.Close();
                var popup = new DropDownMenu(button);
                foreach (var item in definition.Items) popup.Items.Add(item);
                _open = popup; popup.IsOpen = true;
            }
            button.Click += (_, _) => Open();
            button.MouseEnter += (_, _) => { if (_open?.IsOpen == true) Open(); };
            button.PreviewKeyDown += (_, e) => { if (e.Key == System.Windows.Input.Key.Down) { Open(); e.Handled = true; } };
            _bar.Children.Add(button);
        }
    }
}
