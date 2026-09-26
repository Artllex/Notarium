using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;

namespace Notatnik;

public sealed class CodeCellControl : Border
{
    private readonly TextBox _editor;
    public event EventHandler? ContentChanged;
    public event EventHandler? DeleteRequested;
    public event EventHandler? MoveUpRequested;
    public event EventHandler? MoveDownRequested;

    public CodeCellControl(string code = "")
    {
        Margin = new Thickness(0, 8, 0, 8);
        BorderThickness = new Thickness(1);
        BorderBrush = new SolidColorBrush(Color.FromRgb(103, 155, 220));
        Background = new SolidColorBrush(Color.FromRgb(37, 37, 38));
        CornerRadius = new CornerRadius(7);

        var root = new Grid();
        root.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(46) });
        root.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(1, GridUnitType.Star) });
        var run = MakeButton("▶", "Uruchom komórkę", 17);
        run.Margin = new Thickness(7, 10, 5, 0);
        run.VerticalAlignment = VerticalAlignment.Top;
        run.Click += (_, _) => MessageBox.Show("Wykonywanie kodu Python zostanie dodane w kolejnym etapie.", "Komórka Python", MessageBoxButton.OK, MessageBoxImage.Information);
        root.Children.Add(run);

        var content = new Grid();
        content.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        content.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        Grid.SetColumn(content, 1);
        var toolbar = new StackPanel { Orientation = Orientation.Horizontal, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 3, 4, 1) };
        var up = MakeButton("↑", "Przenieś komórkę w górę", 14);
        var down = MakeButton("↓", "Przenieś komórkę w dół", 14);
        var delete = MakeButton("🗑", "Usuń komórkę", 14);
        up.Click += (_, _) => MoveUpRequested?.Invoke(this, EventArgs.Empty);
        down.Click += (_, _) => MoveDownRequested?.Invoke(this, EventArgs.Empty);
        delete.Click += (_, _) => DeleteRequested?.Invoke(this, EventArgs.Empty);
        toolbar.Children.Add(up); toolbar.Children.Add(down); toolbar.Children.Add(delete);
        content.Children.Add(toolbar);

        _editor = new TextBox
        {
            Text = code,
            IsUndoEnabled = false,
            AcceptsReturn = true,
            AcceptsTab = true,
            MinHeight = 66,
            Padding = new Thickness(12, 6, 12, 12),
            Background = Brushes.Transparent,
            Foreground = new SolidColorBrush(Color.FromRgb(241, 241, 241)),
            CaretBrush = Brushes.White,
            BorderThickness = new Thickness(0),
            FontFamily = new FontFamily("Consolas"),
            FontSize = 15,
            TextWrapping = TextWrapping.NoWrap,
            HorizontalScrollBarVisibility = ScrollBarVisibility.Auto,
            VerticalScrollBarVisibility = ScrollBarVisibility.Auto
        };
        _editor.TextChanged += (_, _) => ContentChanged?.Invoke(this, EventArgs.Empty);
        Grid.SetRow(_editor, 1); content.Children.Add(_editor); root.Children.Add(content); Child = root;
    }

    public string Code => _editor.Text;
    public int SelectionStart => _editor.SelectionStart;
    public int SelectionLength => _editor.SelectionLength;
    public void RestoreSelection(int start, int length)
    {
        _editor.Focus();
        _editor.Select(Math.Clamp(start, 0, Code.Length), Math.Clamp(length, 0, Code.Length - Math.Clamp(start, 0, Code.Length)));
    }
    public void FocusCode() { _editor.Focus(); _editor.CaretIndex = _editor.Text.Length; }

    private static Button MakeButton(string text, string tooltip, double fontSize) => new()
    {
        Content = text,
        ToolTip = tooltip,
        Width = 31,
        Height = 29,
        Padding = new Thickness(0),
        FontSize = fontSize,
        Foreground = new SolidColorBrush(Color.FromRgb(190, 190, 190)),
        Background = Brushes.Transparent,
        BorderThickness = new Thickness(0),
        Cursor = Cursors.Hand
    };
}
