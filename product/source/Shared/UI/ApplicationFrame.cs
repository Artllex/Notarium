using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Shell;
namespace Notarium.UI;

// Module-free application surface. Modules supply content, never a second shell style.
public sealed class ApplicationFrame : Grid
{
    public ContentControl Sidebar { get; } = new();
    public ContentControl Workspace { get; } = new();
    public ContentControl Menu { get; } = new();
    public ApplicationFrame(Window owner)
    {
        Background = UiPolicy.Current.SurfaceBrush;
        owner.Background = UiPolicy.Current.SurfaceBrush; owner.Foreground = UiPolicy.Current.TextBrush;
        owner.FontFamily = new FontFamily(UiPolicy.Current.FontFamily);
        owner.WindowStyle = WindowStyle.None; owner.ResizeMode = ResizeMode.CanResize;
        WorkAreaMaximizer.Attach(owner);
        WindowChrome.SetWindowChrome(owner, new WindowChrome { CaptionHeight = 30, ResizeBorderThickness = new Thickness(6), GlassFrameThickness = new Thickness(0), UseAeroCaptionButtons = false });
        RowDefinitions.Add(new RowDefinition { Height = new GridLength(30) });
        RowDefinitions.Add(new RowDefinition { Height = new GridLength(25) });
        RowDefinitions.Add(new RowDefinition { Height = new GridLength(1, GridUnitType.Star) });
        ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(250) });
        ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1) });
        ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        var title = new DockPanel { Background = UiPolicy.Current.PanelBrush };
        foreach (var (label, action) in new (string, Action)[] { ("×", () => owner.Close()), ("□", () => owner.WindowState = owner.WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized), ("—", () => owner.WindowState = WindowState.Minimized) })
        {
            var button = new ActionButton { Content = label, Width = 40, Padding = new Thickness(4), FontSize = 13 };
            button.Click += (_, _) => action(); WindowChrome.SetIsHitTestVisibleInChrome(button, true); DockPanel.SetDock(button, Dock.Right); title.Children.Add(button);
        }
        var windowBrand = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(8, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center };
        windowBrand.Children.Add(new BrandIcon { Width = 16, Height = 16, Margin = new Thickness(0, 0, 7, 0) });
        windowBrand.Children.Add(new TextBlock { Text = "Notarium", VerticalAlignment = VerticalAlignment.Center, FontSize = 12 });
        title.Children.Add(windowBrand);
        title.MouseLeftButtonDown += (_, e) => { if (e.ClickCount == 2) owner.WindowState = owner.WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized; else if (e.ButtonState == MouseButtonState.Pressed) owner.DragMove(); };
        SetColumnSpan(title, 3); Children.Add(title);
        SetRow(Menu, 1); SetColumnSpan(Menu, 3); Menu.Background = UiPolicy.Current.PanelBrush; Children.Add(Menu);
        SetRow(Sidebar, 2); Sidebar.Background = UiPolicy.Current.PanelBrush; Children.Add(Sidebar);
        var line = new Border { Background = (Brush)owner.FindResource("Line") }; SetRow(line, 2); SetColumn(line, 1); Children.Add(line);
        SetRow(Workspace, 2); SetColumn(Workspace, 2); Children.Add(Workspace);
    }
    public static Grid SidebarLayout(UIElement navigation, string? heading)
    {
        var grid = new Grid();
        var hasHeading = !string.IsNullOrWhiteSpace(heading);
        foreach (var height in hasHeading
            ? new[] { new GridLength(52), new GridLength(34), new GridLength(1, GridUnitType.Star), GridLength.Auto }
            : new[] { new GridLength(52), new GridLength(1, GridUnitType.Star), GridLength.Auto }) grid.RowDefinitions.Add(new RowDefinition { Height = height });
        var brand = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(14, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center };
        brand.Children.Add(new BrandIcon { Width = 28, Height = 28 });
        brand.Children.Add(new TextBlock { Text = "Notarium", Foreground = UiPolicy.Current.TextBrush, FontWeight = FontWeights.SemiBold, Margin = new Thickness(9, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center }); grid.Children.Add(brand);
        var navigationRow = 1;
        if (hasHeading)
        {
            var label = new TextBlock { Text = heading, Foreground = UiPolicy.Current.TextBrush, FontSize = 10, Margin = new Thickness(17, 10, 0, 0) };
            SetRow(label, 1);
            grid.Children.Add(label);
            navigationRow = 2;
        }
        SetRow(navigation, navigationRow); grid.Children.Add(navigation);
        var footer = new StackPanel { Margin = new Thickness(8, 10, 8, 20) };
        foreach (var (text, glyph) in new[] { ("Konto", "\uE77B"), ("Ustawienia", "\uE713") })
        {
            var content = new StackPanel { Orientation = Orientation.Horizontal };
            content.Children.Add(new TextBlock { Text = glyph, FontFamily = new FontFamily("Segoe MDL2 Assets"), FontSize = 20, Width = 20, Margin = new Thickness(0, 0, 10, 0), Foreground = UiPolicy.Current.AccentBrush, VerticalAlignment = VerticalAlignment.Center });
            content.Children.Add(new TextBlock { Text = text, VerticalAlignment = VerticalAlignment.Center });
            var button = new ActionButton { Content = content, ToolTip = text + " — makieta", HorizontalAlignment = HorizontalAlignment.Left, HorizontalContentAlignment = HorizontalAlignment.Left, MinWidth = 160, Margin = new Thickness(0, 4, 0, 4), Foreground = UiPolicy.Current.TextBrush };
            System.Windows.Automation.AutomationProperties.SetName(button, text);
            footer.Children.Add(button);
        }
        SetRow(footer, navigationRow + 1); grid.Children.Add(footer); return grid;
    }
}
