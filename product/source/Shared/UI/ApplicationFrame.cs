using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
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
    private readonly ColumnDefinition _sidebarColumn = new() { Width = new GridLength(250), MinWidth = 110, MaxWidth = 450 };
    private readonly ColumnDefinition _separatorColumn = new() { Width = new GridLength(6) };
    private readonly Border _separatorLine;
    private readonly GridSplitter _sidebarSplitter;
    private readonly ActionButton _sidebarToggle;
    private readonly BrandIcon _titleBrandIcon;
    private double _lastSidebarWidth = 250;
    private double _dragStartSidebarWidth = 250;
    public bool RestoreSidebarFromWorkspace { get; set; }
    public event Action<bool>? SidebarVisibilityChanged;

    public void ToggleSidebar() => SetSidebarVisible(Sidebar.Visibility != Visibility.Visible, true);

    private void SetSidebarVisible(bool show, bool rememberCurrentWidth)
    {
        if (!show && rememberCurrentWidth) _lastSidebarWidth = Math.Clamp(_sidebarColumn.ActualWidth, 110, 450);
        _sidebarColumn.MinWidth = show ? 110 : 0;
        _sidebarColumn.Width = new GridLength(show ? _lastSidebarWidth : 0);
        _separatorColumn.Width = new GridLength(show ? 6 : 0);
        Sidebar.Visibility = show ? Visibility.Visible : Visibility.Collapsed;
        _separatorLine.Visibility = show ? Visibility.Visible : Visibility.Collapsed;
        _sidebarSplitter.Visibility = show ? Visibility.Visible : Visibility.Collapsed;
        _sidebarToggle.ToolTip = show ? "Ukryj panel boczny" : "Pokaż panel boczny";
        _titleBrandIcon.Width = _titleBrandIcon.Height = show ? 16 : 28;
        _sidebarToggle.Width = _sidebarToggle.Height = show ? 20 : 28;
        _sidebarToggle.Visibility = !show && RestoreSidebarFromWorkspace ? Visibility.Collapsed : Visibility.Visible;
        SidebarVisibilityChanged?.Invoke(show);
    }

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
        ColumnDefinitions.Add(_sidebarColumn);
        ColumnDefinitions.Add(_separatorColumn);
        ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        var title = new DockPanel { Background = UiPolicy.Current.PanelBrush };
        ActionButton AddCaptionButton(string label, string glyph, Action action, bool close = false)
        {
            var button = new ActionButton { Content = new TextBlock { Text = glyph, FontFamily = new FontFamily("Segoe Fluent Icons"), FontSize = 11 }, Style = (Style)owner.FindResource(close ? "WindowCaptionCloseButton" : "WindowCaptionButton"), ToolTip = label };
            System.Windows.Automation.AutomationProperties.SetName(button, label);
            button.Click += (_, _) => action(); WindowChrome.SetIsHitTestVisibleInChrome(button, true); DockPanel.SetDock(button, Dock.Right); title.Children.Add(button);
            return button;
        }
        AddCaptionButton("Zamknij", "\uE8BB", () => owner.Close(), close: true);
        var maximizeButton = AddCaptionButton("Maksymalizuj", "\uE922", () => owner.WindowState = owner.WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized);
        AddCaptionButton("Minimalizuj", "\uE921", () => owner.WindowState = WindowState.Minimized);
        void UpdateMaximizeButton()
        {
            var maximized = owner.WindowState == WindowState.Maximized;
            ((TextBlock)maximizeButton.Content).Text = maximized ? "\uE923" : "\uE922";
            maximizeButton.ToolTip = maximized ? "Przywróć" : "Maksymalizuj";
            System.Windows.Automation.AutomationProperties.SetName(maximizeButton, (string)maximizeButton.ToolTip);
        }
        owner.StateChanged += (_, _) => UpdateMaximizeButton();
        owner.Loaded += (_, _) => UpdateMaximizeButton();
        var windowBrand = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(8, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center };
        _titleBrandIcon = new BrandIcon { Width = 16, Height = 16 };
        _sidebarToggle = new ActionButton { Content = _titleBrandIcon, Width = 20, Height = 20, Padding = new Thickness(0), Margin = new Thickness(0, 0, 3, 0), ToolTip = "Ukryj panel boczny" };
        System.Windows.Automation.AutomationProperties.SetName(_sidebarToggle, "Pokaż lub ukryj panel boczny");
        _sidebarToggle.Click += (_, _) => ToggleSidebar();
        WindowChrome.SetIsHitTestVisibleInChrome(_sidebarToggle, true);
        windowBrand.Children.Add(_sidebarToggle);
        windowBrand.Children.Add(new TextBlock { Text = "Notarium", VerticalAlignment = VerticalAlignment.Center, FontSize = 12 });
        title.Children.Add(windowBrand);
        title.MouseLeftButtonDown += (_, e) => { if (e.ClickCount == 2) owner.WindowState = owner.WindowState == WindowState.Maximized ? WindowState.Normal : WindowState.Maximized; else if (e.ButtonState == MouseButtonState.Pressed) owner.DragMove(); };
        SetColumnSpan(title, 3); Children.Add(title);
        SetRow(Menu, 1); SetColumnSpan(Menu, 3); Menu.Background = UiPolicy.Current.PanelBrush; Children.Add(Menu);
        SetRow(Sidebar, 2); Sidebar.Background = UiPolicy.Current.PanelBrush; Children.Add(Sidebar);
        _separatorLine = new Border { Background = (Brush)owner.FindResource("Line"), Width = 1, Margin = new Thickness(0, 34, 0, 0), HorizontalAlignment = HorizontalAlignment.Center, IsHitTestVisible = false };
        SetRow(_separatorLine, 2); SetColumn(_separatorLine, 1); Children.Add(_separatorLine);
        _sidebarSplitter = new GridSplitter { Background = Brushes.Transparent, Cursor = Cursors.SizeWE, ResizeDirection = GridResizeDirection.Columns, ResizeBehavior = GridResizeBehavior.PreviousAndNext, HorizontalAlignment = HorizontalAlignment.Stretch, VerticalAlignment = VerticalAlignment.Stretch, ToolTip = "Przeciągnij, aby zmienić szerokość panelu bocznego" };
        _sidebarSplitter.DragStarted += (_, _) => _dragStartSidebarWidth = _sidebarColumn.ActualWidth;
        _sidebarSplitter.DragCompleted += (_, e) =>
        {
            if (e.Canceled || e.HorizontalChange >= 0 || _sidebarColumn.ActualWidth > _sidebarColumn.MinWidth + 0.5) return;
            // Reaching the narrowest position closes the panel. Reopening uses
            // the width from before this drag, not the nearly unusable minimum.
            if (_dragStartSidebarWidth > _sidebarColumn.MinWidth + 0.5)
                _lastSidebarWidth = Math.Clamp(_dragStartSidebarWidth, 110, 450);
            SetSidebarVisible(false, false);
        };
        SetRow(_sidebarSplitter, 2); SetColumn(_sidebarSplitter, 1); Children.Add(_sidebarSplitter);
        SetRow(Workspace, 2); SetColumn(Workspace, 2); Children.Add(Workspace);
    }
    public static Grid SidebarLayout(UIElement navigation, string? heading, Action? toggleSidebar = null)
    {
        var grid = new Grid();
        var hasHeading = !string.IsNullOrWhiteSpace(heading);
        foreach (var height in hasHeading
            ? new[] { new GridLength(52), new GridLength(34), new GridLength(1, GridUnitType.Star), GridLength.Auto }
            : new[] { new GridLength(52), new GridLength(1, GridUnitType.Star), GridLength.Auto }) grid.RowDefinitions.Add(new RowDefinition { Height = height });
        var brand = new Grid { Margin = new Thickness(14, 0, 8, 0), VerticalAlignment = VerticalAlignment.Center };
        brand.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(28) });
        brand.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        var brandButton = new ActionButton { Content = new BrandIcon { Width = 28, Height = 28 }, Width = 28, Height = 28, Padding = new Thickness(0), ToolTip = "Ukryj panel boczny" };
        System.Windows.Automation.AutomationProperties.SetName(brandButton, "Ukryj panel boczny");
        brandButton.Click += (_, _) => toggleSidebar?.Invoke();
        brand.Children.Add(brandButton);
        var brandText = new TextBlock { Text = "Notarium", Foreground = UiPolicy.Current.TextBrush, FontSize = 18, FontWeight = FontWeights.SemiBold, Margin = new Thickness(9, 0, 0, 0), VerticalAlignment = VerticalAlignment.Center, TextTrimming = TextTrimming.CharacterEllipsis, TextWrapping = TextWrapping.NoWrap };
        SetColumn(brandText, 1); brand.Children.Add(brandText); grid.Children.Add(brand);
        var navigationRow = 1;
        if (hasHeading)
        {
            var label = new TextBlock { Text = heading, Foreground = UiPolicy.Current.TextBrush, FontSize = 10, Margin = new Thickness(17, 10, 8, 0), TextTrimming = TextTrimming.CharacterEllipsis, TextWrapping = TextWrapping.NoWrap };
            SetRow(label, 1);
            grid.Children.Add(label);
            navigationRow = 2;
        }
        SetRow(navigation, navigationRow); grid.Children.Add(navigation);
        var footer = new StackPanel { Margin = new Thickness(8, 10, 8, 20) };
        foreach (var (text, glyph) in new[] { ("Konto", "\uE77B"), ("Ustawienia", "\uE713") })
        {
            var content = new Grid();
            content.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(30) });
            content.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            content.Children.Add(new TextBlock { Text = glyph, FontFamily = new FontFamily("Segoe MDL2 Assets"), FontSize = 20, Foreground = UiPolicy.Current.AccentBrush, VerticalAlignment = VerticalAlignment.Center });
            var footerText = new TextBlock { Text = text, VerticalAlignment = VerticalAlignment.Center, TextTrimming = TextTrimming.CharacterEllipsis, TextWrapping = TextWrapping.NoWrap };
            SetColumn(footerText, 1); content.Children.Add(footerText);
            var button = new ActionButton { Content = content, ToolTip = text + " — makieta", HorizontalContentAlignment = HorizontalAlignment.Stretch, Margin = new Thickness(0, 4, 0, 4), Foreground = UiPolicy.Current.TextBrush };
            System.Windows.Automation.AutomationProperties.SetName(button, text);
            footer.Children.Add(button);
        }
        SetRow(footer, navigationRow + 1); grid.Children.Add(footer); return grid;
    }
}
