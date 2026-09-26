using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;

namespace Notatnik;

public static class InlineTitleEditor
{
    public static readonly DependencyProperty DarkProperty = DependencyProperty.RegisterAttached(
        "Dark", typeof(bool), typeof(InlineTitleEditor), new PropertyMetadata(false, Apply));
    public static bool GetDark(DependencyObject target) => (bool)target.GetValue(DarkProperty);
    public static void SetDark(DependencyObject target, bool value) => target.SetValue(DarkProperty, value);

    private static void Apply(DependencyObject target, DependencyPropertyChangedEventArgs args)
    {
        if (target is not Emoji.Wpf.TextBox owner || args.NewValue is not true) return;
        // The internal control receives this style as it is created, before first paint.
        var style = new Style(typeof(Emoji.Wpf.RichTextBox));
        style.Setters.Add(new Setter(Control.BackgroundProperty, Brushes.Transparent));
        style.Setters.Add(new Setter(Control.BorderBrushProperty, Brushes.Transparent));
        style.Setters.Add(new Setter(Control.BorderThicknessProperty, new Thickness(0)));
        style.Setters.Add(new Setter(Control.PaddingProperty, new Thickness(3, 0, 0, 0)));
        style.Setters.Add(new Setter(TextBoxBase.CaretBrushProperty, Brushes.White));
        style.Setters.Add(new Setter(TextBoxBase.SelectionBrushProperty, new SolidColorBrush(Color.FromRgb(49, 84, 122))));
        style.Setters.Add(new Setter(TextBoxBase.SelectionOpacityProperty, 0.4));
        owner.Resources[typeof(Emoji.Wpf.RichTextBox)] = style;
    }
}
