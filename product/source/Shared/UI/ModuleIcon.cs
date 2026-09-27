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
            "calendar" => "M3,5 H21 V21 H3 Z M3,10 H21 M7,3 V7 M17,3 V7 M7,14 H9 M15,14 H17 M7,18 H9 M15,18 H17",
            "collections" => "M3,3 H16 V6 M3,3 V16 H6 M7,7 H20 V20 H7 Z M11,11 H16 M11,15 H16",
            "prompting" => "M3,4 H21 V17 H10 L5,21 V17 H3 Z M7,8 H17 M7,12 H14",
            "dev" => "M8,6 L2,12 L8,18 M16,6 L22,12 L16,18 M14,3 L10,21",
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
