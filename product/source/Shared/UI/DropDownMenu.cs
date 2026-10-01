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
    private readonly StackPanel _itemsHost = new() { Focusable = true };
    private readonly double? _itemWidth;
    private readonly UIElement? _target;
    private readonly Action? _onLeafClick;
    private readonly bool _aboveTarget;
    private readonly bool _centerItems;
    private DropDownMenu? _childMenu;
    private static readonly System.Runtime.CompilerServices.ConditionalWeakTable<MenuItem, UIElement> Headers = new();
    public Collection<object> Items { get; } = new();

    public DropDownMenu(UIElement? target, double? itemWidth = null, bool submenu = false, Action? onLeafClick = null, FrameworkElement? parentSurface = null, bool aboveTarget = false, bool centerItems = false)
    {
        _itemWidth = itemWidth;
        _target = target;
        _onLeafClick = onLeafClick;
        _aboveTarget = aboveTarget;
        _centerItems = centerItems;
        // Custom placement is immune to the system's right-aligned menu policy.
        // A button menu always starts at the button's left, not at its right.
        _popup = new Popup { PlacementTarget = target, Placement = target is null ? PlacementMode.MousePoint : PlacementMode.Custom, StaysOpen = submenu, AllowsTransparency = true, PopupAnimation = SystemParameters.MenuAnimation ? PopupAnimation.Fade : PopupAnimation.None };
        _popup.CustomPopupPlacementCallback = (popupSize, targetSize, _) =>
        {
            if (!submenu)
            {
                if (_aboveTarget)
                {
                    var rightAligned = targetSize.Width - popupSize.Width;
                    return new[]
                    {
                        new CustomPopupPlacement(new Point(rightAligned, -popupSize.Height), PopupPrimaryAxis.Vertical),
                        new CustomPopupPlacement(new Point(rightAligned, targetSize.Height), PopupPrimaryAxis.Vertical)
                    };
                }
                return new[] { new CustomPopupPlacement(new Point(0, targetSize.Height), PopupPrimaryAxis.Vertical) };
            }
            var origin = target is FrameworkElement anchor && parentSurface is not null ? anchor.TranslatePoint(new Point(), parentSurface) : new Point();
            var parentWidth = parentSurface?.ActualWidth ?? targetSize.Width;
            return new[]
            {
                new CustomPopupPlacement(new Point(parentWidth - origin.X + 2, 0), PopupPrimaryAxis.Horizontal),
                new CustomPopupPlacement(new Point(-origin.X - popupSize.Width - 2, 0), PopupPrimaryAxis.Horizontal)
            };
        };
        _popup.Opened += (_, _) => MenuBackdrop.Apply((FrameworkElement)_popup.Child);
        _popup.Closed += (_, _) => _childMenu?.Close();
        if (!submenu && target is FrameworkElement anchor)
        {
            void AttachOutsideClose()
            {
                if (Window.GetWindow(anchor) is not { } owner) return;
                owner.PreviewMouseDown += OutsideClick;
                owner.Deactivated += OwnerDeactivated;
                _popup.Closed += (_, _) => { owner.PreviewMouseDown -= OutsideClick; owner.Deactivated -= OwnerDeactivated; };
            }
            void OutsideClick(object sender, MouseButtonEventArgs args) => Close();
            void OwnerDeactivated(object? sender, EventArgs args) => Close();
            _popup.Opened += (_, _) => AttachOutsideClose();
        }
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
        set { if (value) Build(); _popup.IsOpen = value; if (value) _itemsHost.Dispatcher.BeginInvoke(new Action(() => _itemsHost.Focus())); }
    }
    public void Close() { _childMenu?.Close(); _popup.IsOpen = false; }
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
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = _centerItems ? new GridLength(18) : GridLength.Auto });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = _centerItems ? new GridLength(18) : GridLength.Auto });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            if (item.IsCheckable) row.Children.Add(new TextBlock { Text = item.IsChecked ? "✓" : "", Width = 18, Margin = _centerItems ? new Thickness(0) : new Thickness(0, 0, 5, 0) });
            var header = item.Header as UIElement ?? (Headers.TryGetValue(item, out var cached) ? cached : new TextBlock { Text = (item.Header?.ToString() ?? string.Empty).Replace("_", ""), FontSize = 11 });
            if (item.Header is UIElement && !Headers.TryGetValue(item, out _)) Headers.Add(item, header);
            if (VisualTreeHelper.GetParent(header) is Panel parent) parent.Children.Remove(header);
            // HeaderedItemsControl owns UIElement headers logically. Release that
            // ownership before attaching the same visual to the popup row.
            if (item.Header is UIElement) item.Header = null;
            header.SetValue(System.Windows.Documents.TextElement.ForegroundProperty, item.IsEnabled ? UiPolicy.Current.TextBrush : new SolidColorBrush(Color.FromRgb(125, 125, 125)));
            if (_centerItems && header is FrameworkElement centeredHeader) centeredHeader.HorizontalAlignment = HorizontalAlignment.Center;
            Grid.SetColumn(header, 1); row.Children.Add(header);
            if (!string.IsNullOrWhiteSpace(item.InputGestureText))
            {
                var shortcut = new TextBlock { Text = item.InputGestureText, FontSize = 11, Foreground = new SolidColorBrush(Color.FromRgb(145, 145, 145)), Margin = new Thickness(18, 0, 0, 0) };
                Grid.SetColumn(shortcut, 2);
                row.Children.Add(shortcut);
            }
            if (item.HasItems)
            {
                var arrow = new TextBlock { Text = ">", FontSize = 15, Foreground = item.IsEnabled ? UiPolicy.Current.TextBrush : new SolidColorBrush(Color.FromRgb(125, 125, 125)), Margin = new Thickness(14, 0, 2, 0), VerticalAlignment = VerticalAlignment.Center };
                Grid.SetColumn(arrow, 3);
                row.Children.Add(arrow);
            }

            var button = new ActionButton
            {
                Content = row,
                MinWidth = _itemWidth ?? 150,
                Width = _itemWidth ?? double.NaN,
                MinHeight = UiPolicy.Current.ItemMinHeight,
                Padding = new Thickness(_centerItems ? 4 : UiPolicy.Current.RowPaddingX, UiPolicy.Current.RowPaddingY, _centerItems ? 4 : UiPolicy.Current.RowPaddingX, UiPolicy.Current.RowPaddingY),
                Margin = new Thickness(UiPolicy.Current.RowMarginX, 0, UiPolicy.Current.RowMarginX, 0),
                FontFamily = new FontFamily(UiPolicy.Current.FontFamily),
                FontSize = 11,
                HorizontalContentAlignment = HorizontalAlignment.Stretch,
                VerticalContentAlignment = VerticalAlignment.Center,
                Foreground = UiPolicy.Brush(UiPolicy.Current.MenuText),
                Background = Brushes.Transparent,
                IsEnabled = item.IsEnabled
            };
            button.Template = RowTemplate();
            System.Windows.Automation.AutomationProperties.SetName(button, item.Header?.ToString()?.Replace("_", "") ?? (header as TextBlock)?.Text ?? "Menu option");
            button.Click += (_, _) =>
            {
                if (item.HasItems)
                {
                    _childMenu?.Close();
                    var child = _childMenu = new DropDownMenu(button, submenu: true, onLeafClick: Close, parentSurface: (FrameworkElement)_popup.Child);
                    foreach (var childItem in item.Items) child.Items.Add(childItem);
                    _popup.StaysOpen = true;
                    child.IsOpen = true;
                    return;
                }
                if (item.IsCheckable) item.IsChecked = !item.IsChecked;
                if (item.Command is RoutedCommand routed && routed.CanExecute(item.CommandParameter, item.CommandTarget)) routed.Execute(item.CommandParameter, item.CommandTarget);
                else if (item.Command is ICommand command && command.CanExecute(item.CommandParameter)) command.Execute(item.CommandParameter);
                item.RaiseEvent(new RoutedEventArgs(MenuItem.ClickEvent, item));
                _popup.IsOpen = false;
                _childMenu?.Close();
                _onLeafClick?.Invoke();
            };
            button.MouseEnter += (_, _) =>
            {
                if (!item.IsEnabled || !_popup.IsOpen) return;
                if (!item.HasItems) { _childMenu?.Close(); return; }
                _childMenu?.Close();
                var child = _childMenu = new DropDownMenu(button, submenu: true, onLeafClick: Close, parentSurface: (FrameworkElement)_popup.Child);
                foreach (var childItem in item.Items) child.Items.Add(childItem);
                _popup.StaysOpen = true;
                child.IsOpen = true;
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
        var disabled = new Trigger { Property = UIElement.IsEnabledProperty, Value = false };
        disabled.Setters.Add(new Setter(Border.BackgroundProperty, Brushes.Transparent, "Row")); template.Triggers.Add(disabled);
        return template;
    }
}
