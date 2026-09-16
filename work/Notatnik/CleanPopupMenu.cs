using System.Collections.ObjectModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;
using System.Windows.Media;

namespace Notatnik;

public sealed class CleanPopupMenu
{
    private readonly Popup _popup;
    private readonly StackPanel _itemsHost = new();
    private readonly double? _itemWidth;
    private bool _built;
    public Collection<object> Items { get; } = new();

    public CleanPopupMenu(UIElement? target, double? itemWidth = null)
    {
        _itemWidth = itemWidth;
        _popup = new Popup { PlacementTarget = target, Placement = PlacementMode.Bottom, StaysOpen = false, AllowsTransparency = true, PopupAnimation = PopupAnimation.None };
    }

    public bool IsOpen
    {
        get => _popup.IsOpen;
        set { if (value && !_built) { Build(); _built = true; } _popup.IsOpen = value; }
    }

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
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
            row.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
            var header = item.Header as UIElement ?? new TextBlock { Text = item.Header?.ToString() ?? string.Empty };
            // HeaderedItemsControl owns UIElement headers logically. Release that
            // ownership before attaching the same visual to the popup row.
            if (item.Header is UIElement) item.Header = null;
            row.Children.Add(header);
            if (!string.IsNullOrWhiteSpace(item.InputGestureText))
            {
                var shortcut = new TextBlock { Text = item.InputGestureText, Foreground = new SolidColorBrush(Color.FromRgb(155, 155, 155)), Margin = new Thickness(18, 0, 0, 0) };
                Grid.SetColumn(shortcut, 1);
                row.Children.Add(shortcut);
            }

            var button = new Button
            {
                Content = row,
                MinWidth = _itemWidth ?? 150,
                Width = _itemWidth ?? double.NaN,
                MinHeight = 31,
                Padding = new Thickness(12, 5, 12, 5),
                Margin = new Thickness(2, 1, 2, 1),
                HorizontalContentAlignment = HorizontalAlignment.Stretch,
                VerticalContentAlignment = VerticalAlignment.Center,
                Foreground = new SolidColorBrush(Color.FromRgb(241, 241, 241)),
                Background = item.IsChecked ? new SolidColorBrush(Color.FromRgb(48, 75, 102)) : Brushes.Transparent,
                IsEnabled = item.IsEnabled
            };
            button.Click += (_, _) =>
            {
                if (item.Command is RoutedCommand routed && routed.CanExecute(item.CommandParameter, item.CommandTarget)) routed.Execute(item.CommandParameter, item.CommandTarget);
                else if (item.Command is ICommand command && command.CanExecute(item.CommandParameter)) command.Execute(item.CommandParameter);
                item.RaiseEvent(new RoutedEventArgs(MenuItem.ClickEvent, item));
                _popup.IsOpen = false;
            };
            _itemsHost.Children.Add(button);
        }

        _popup.Child = new Border
        {
            Background = new SolidColorBrush(Color.FromRgb(37, 37, 37)),
            BorderBrush = new SolidColorBrush(Color.FromRgb(78, 78, 78)),
            BorderThickness = new Thickness(1),
            Padding = new Thickness(2),
            Child = new ScrollViewer { VerticalScrollBarVisibility = ScrollBarVisibility.Auto, HorizontalScrollBarVisibility = ScrollBarVisibility.Disabled, MaxHeight = 520, Content = _itemsHost }
        };
    }
}
