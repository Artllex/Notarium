using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;

namespace Notarium.UI;

// A full-area text action without visual button chrome or hover transitions.
public sealed class PlainTextButton : Button
{
    public PlainTextButton()
    {
        Height = 28;
        VerticalAlignment = VerticalAlignment.Center;
        HorizontalContentAlignment = HorizontalAlignment.Left;
        VerticalContentAlignment = VerticalAlignment.Center;
        Cursor = Cursors.Hand;
        FocusVisualStyle = null;
        var surface = new FrameworkElementFactory(typeof(Border));
        surface.SetValue(Border.BackgroundProperty, Brushes.Transparent);
        var content = new FrameworkElementFactory(typeof(ContentPresenter));
        content.SetValue(ContentPresenter.HorizontalAlignmentProperty, HorizontalAlignment.Left);
        content.SetValue(ContentPresenter.VerticalAlignmentProperty, VerticalAlignment.Center);
        surface.AppendChild(content);
        Template = new ControlTemplate(typeof(Button)) { VisualTree = surface };
    }
}
