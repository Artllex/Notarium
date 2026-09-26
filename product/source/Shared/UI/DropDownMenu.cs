using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;

namespace Notarium.UI;

public sealed class DropDownMenu
{

    private readonly Popup _popup;
    private readonly StackPanel _itemsHost = new();
    private readonly double? _itemWidth;
    private readonly UIElement? _target;
    private static readonly System.Runtime.CompilerServices.ConditionalWeakTable<MenuItem, UIElement> Headers = new();
    public Collection<object> Items { get; } = new();

    public DropDownMenu(UIElement? target, double? itemWidth = null)
    {
        _itemWidth = itemWidth;
        _target = target;
        // Custom placement is immune to the system's right-aligned menu policy.
        // A button menu always starts at the button's left, not at its right.
        _popup = new Popup { PlacementTarget = target, Placement = target is null ? PlacementMode.MousePoint : PlacementMode.Custom, StaysOpen = false, AllowsTransparency = true, PopupAnimation = PopupAnimation.None };
        _popup.CustomPopupPlacementCallback = (_, targetSize, _) => new[] { new CustomPopupPlacement(new Point(0, targetSize.Height), PopupPrimaryAxis.Vertical) };
        _itemsHost.PreviewKeyDown += (_, e) =>
        {
            if (e.Key == Key.Escape) { Close(); _target?.Focus(); e.Handled = true; }
            else if (e.Key == Key.Down || e.Key == Key.Up)
            {
                (Keyboard.FocusedElement as UIElement)?.MoveFocus(new TraversalRequest(e.Key == Key.Down ? FocusNavigationDirection.Next : FocusNavigationDirection.Previous)); e.Handled = true;
            }
        };
    }

    public bool IsOpen
    {
        get => _popup.IsOpen;
        set { if (value) Build(); _popup.IsOpen = value; if (value) _itemsHost.Dispatcher.BeginInvoke(new Action(() => _itemsHost.Children.OfType<Button>().FirstOrDefault(button => button.IsEnabled)?.Focus())); }
    }
    public void Close() => _popup.IsOpen = false;
    public FrameworkElement View { get { Build(); return (FrameworkElement)_popup.Child; } }

    private void Build()
    {
        _itemsHost.Children.Clear();
        foreach (var entry in Items)
        {
            if (entry is Separator)
            {
                _itemsHost.Children.Add(new Border { Height = 1, Background = new SolidColorBrush(Color.FromRgb(67, 67, 67)), Margin = new Thickness(7, 3, 7, 3) });
                continue;
            }
            if (entry is not MenuItem item) continue;

            var row = new Grid();
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            if (item.IsCheckable) row.Children.Add(new TextBlock { Text = item.IsChecked ? "✓" : "", Width = 18, Margin = new Thickness(0, 0, 5, 0) });
            var header = item.Header as UIElement ?? (Headers.TryGetValue(item, out var cached) ? cached : new TextBlock { Text = (item.Header?.ToString() ?? string.Empty).Replace("_", "") });
            if (item.Header is UIElement && !Headers.TryGetValue(item, out _)) Headers.Add(item, header);
            if (VisualTreeHelper.GetParent(header) is Panel parent) parent.Children.Remove(header);
            // HeaderedItemsControl owns UIElement headers logically. Release that
            // ownership before attaching the same visual to the popup row.
            if (item.Header is UIElement) item.Header = null;
            Grid.SetColumn(header, 1); row.Children.Add(header);
            if (!string.IsNullOrWhiteSpace(item.InputGestureText))
            {
                var shortcut = new TextBlock { Text = item.InputGestureText, Foreground = new SolidColorBrush(Color.FromRgb(155, 155, 155)), Margin = new Thickness(18, 0, 0, 0) };
                Grid.SetColumn(shortcut, 2);
                row.Children.Add(shortcut);
            }

            var button = new ActionButton
            {
                Content = row,
                MinWidth = _itemWidth ?? 150,
                Width = _itemWidth ?? double.NaN,
                MinHeight = UiPolicy.Current.ItemMinHeight,
                Padding = new Thickness(UiPolicy.Current.RowPaddingX, UiPolicy.Current.RowPaddingY, UiPolicy.Current.RowPaddingX, UiPolicy.Current.RowPaddingY),
                Margin = new Thickness(UiPolicy.Current.RowMarginX, 0, UiPolicy.Current.RowMarginX, 0),
                FontFamily = new FontFamily(UiPolicy.Current.FontFamily),
                FontSize = UiPolicy.Current.FontSize,
                HorizontalContentAlignment = HorizontalAlignment.Stretch,
                VerticalContentAlignment = VerticalAlignment.Center,
                Foreground = UiPolicy.Brush(UiPolicy.Current.MenuText),
                Background = item.IsChecked ? UiPolicy.Brush(UiPolicy.Current.MenuSelected) : Brushes.Transparent,
                IsEnabled = item.IsEnabled
            };
            button.Template = RowTemplate();
            System.Windows.Automation.AutomationProperties.SetName(button, item.Header?.ToString()?.Replace("_", "") ?? (header as TextBlock)?.Text ?? "Menu option");
            button.Click += (_, _) =>
            {
                if (item.IsCheckable) item.IsChecked = !item.IsChecked;
                if (item.Command is RoutedCommand routed && routed.CanExecute(item.CommandParameter, item.CommandTarget)) routed.Execute(item.CommandParameter, item.CommandTarget);
                else if (item.Command is ICommand command && command.CanExecute(item.CommandParameter)) command.Execute(item.CommandParameter);
                item.RaiseEvent(new RoutedEventArgs(MenuItem.ClickEvent, item));
                _popup.IsOpen = false;
            };
            _itemsHost.Children.Add(button);
        }

        _popup.Child = new Border
        {
            Background = UiPolicy.Brush(UiPolicy.Current.MenuBackground),
            BorderBrush = UiPolicy.Brush(UiPolicy.Current.MenuBorder),
            BorderThickness = new Thickness(1),
            Padding = new Thickness(UiPolicy.Current.MenuPadding),
            CornerRadius = new CornerRadius(UiPolicy.Current.MenuRadius),
            Child = new ScrollViewer { VerticalScrollBarVisibility = ScrollBarVisibility.Auto, HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled, MaxHeight = UiPolicy.Current.MenuMaxHeight, Content = _itemsHost }
        };
    }

    private static ControlTemplate RowTemplate()
    {
        var border = new FrameworkElementFactory(typeof(Border), "Row");
        border.SetBinding(Border.BackgroundProperty, new System.Windows.Data.Binding(nameof(Button.Background)) { RelativeSource = new System.Windows.Data.RelativeSource(System.Windows.Data.RelativeSourceMode.TemplatedParent) });
        border.SetBinding(Border.PaddingProperty, new System.Windows.Data.Binding(nameof(Button.Padding)) { RelativeSource = new System.Windows.Data.RelativeSource(System.Windows.Data.RelativeSourceMode.TemplatedParent) });
        border.SetValue(Border.CornerRadiusProperty, new CornerRadius(UiPolicy.Current.RowRadius));
        var content = new FrameworkElementFactory(typeof(ContentPresenter));
        content.SetValue(FrameworkElement.VerticalAlignmentProperty, VerticalAlignment.Center);
        border.AppendChild(content);
        var template = new ControlTemplate(typeof(Button)) { VisualTree = border };
        var hover = new Trigger { Property = UIElement.IsMouseOverProperty, Value = true };
        hover.Setters.Add(new Setter(Border.BackgroundProperty, UiPolicy.Brush(UiPolicy.Current.MenuHover), "Row"));
        template.Triggers.Add(hover);
        var focus = new Trigger { Property = UIElement.IsKeyboardFocusedProperty, Value = true };
        focus.Setters.Add(new Setter(Border.BackgroundProperty, UiPolicy.Brush(UiPolicy.Current.MenuHover), "Row"));
        template.Triggers.Add(focus);
        var disabled = new Trigger { Property = UIElement.IsEnabledProperty, Value = false };
        disabled.Setters.Add(new Setter(UIElement.OpacityProperty, UiPolicy.Current.DisabledOpacity)); template.Triggers.Add(disabled);
        return template;
    }
}
