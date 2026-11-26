using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Shapes;
namespace Notarium.UI;

// Shared vector icons: fixed 24-unit canvas, common stroke and theme accent.
public sealed class ModuleIcon : Viewbox
{
    public ModuleIcon(string moduleId)
    {
        Width = Height = 20;
        Stretch = Stretch.Uniform;
        IsHitTestVisible = false;
        var geometry = moduleId switch
        {
            "notebook" => "M6,3 H19 V21 H6 Z M3,6 H8 M3,10 H8 M3,14 H8 M3,18 H8 M11,8 H16 M11,12 H16",
            _ => "M4,4 H20 V20 H4 Z"
        };
        var canvas = new Canvas { Width = 24, Height = 24 };
        canvas.Children.Add(new Path
        {
            Data = Geometry.Parse(geometry),
            Stroke = UiPolicy.Current.AccentBrush,
            StrokeThickness = 1.7,
            StrokeStartLineCap = PenLineCap.Round,
            StrokeEndLineCap = PenLineCap.Round,
            StrokeLineJoin = PenLineJoin.Round
        });
        Child = canvas;
        System.Windows.Automation.AutomationProperties.SetName(this, moduleId);
    }
}
