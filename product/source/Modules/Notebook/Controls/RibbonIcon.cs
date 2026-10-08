using System.Windows;
using System.Windows.Media;
using System.Windows.Shapes;
using Notarium.UI;

namespace Notatnik;

// One vector family: uniform 32-unit canvas, stroke and framing at all sizes.
internal static class RibbonIcon
{
    public static FrameworkElement Create(string name, double size = 28)
    {
        var geometry = name switch
        {
            "margins" => "M6,2 H26 V30 H6 Z M10,7 H22 V25 H10 Z M10,12 H22 M10,17 H22 M10,22 H22",
            "orientation" => "M3,3 H17 V23 H3 Z M14,12 H30 V29 H14 Z M22,3 V9 M19,6 L22,9 25,6",
            "size" => "M8,5 H24 V27 H8 Z M3,5 V27 M1,8 L3,5 5,8 M1,24 L3,27 5,24 M8,31 H24 M11,29 L8,31 11,33 M21,29 L24,31 21,33",
            "width" => "M4,6 H28 V26 H4 Z M7,16 H25 M10,13 L7,16 10,19 M22,13 L25,16 22,19",
            "page" => "M7,2 H21 L27,8 V30 H7 Z M21,2 V8 H27 M11,14 H23 M11,19 H23 M11,24 H20",
            "color" => "M6,2 H21 L27,8 V30 H6 Z M21,2 V8 H27 M11,14 H23 M11,19 H20 M10,26 H24",
            "indentLeft" => "M13,5 H29 M13,11 H29 M13,17 H29 M13,23 H29 M2,9 L8,14 2,19 Z",
            "indentRight" => "M2,5 H18 M2,11 H18 M2,17 H18 M2,23 H18 M29,9 L23,14 29,19 Z",
            "spacing" => "M12,6 H29 M12,14 H29 M12,22 H29 M5,3 V28 M2,6 L5,3 8,6 M2,25 L5,28 8,25",
            "hyphen" => "M3,6 H29 M3,14 H20 M24,14 H29 M3,22 H16 M20,19 L26,25 M26,19 L20,25",
            "link" => "M13,10 L16,7 C22,1 31,10 25,16 L21,20 M19,22 L16,25 C10,31 1,22 7,16 L11,12 M11,21 L21,11",
            "image" => "M3,5 H29 V27 H3 Z M3,24 L11,16 17,22 23,14 29,20 M19,10 A2,2 0 1 0 23,10 A2,2 0 1 0 19,10",
            "table" => "M3,4 H29 V28 H3 Z M3,12 H29 M3,20 H29 M12,4 V28 M21,4 V28",
            "container" => "M3,4 H29 V28 H3 Z M3,10 H29 M8,16 H24 M8,22 H19",
            "code" => "M11,8 L3,16 11,24 M21,8 L29,16 21,24 M19,3 L13,29",
            "cell" => "M3,4 H29 V28 H3 Z M3,10 H29 M8,15 L15,19 8,23 Z M19,23 H25",
            "math" => "M26,4 H8 L19,16 8,28 H26",
            "comments" => "M3,4 H29 V23 H14 L7,29 V23 H3 Z M8,10 H24 M8,16 H21",
            "numbering" => "M7,2 H25 V30 H7 Z M10,23 H22 M16,9 V18 M13,11 L16,9 M13,18 H20",
            "footer" => "M7,2 H25 V30 H7 Z M10,23 H22 V27 H10 Z M11,8 H21 M11,13 H21",
            "snippets" => "M2,5 H22 V23 H2 Z M10,11 H30 V29 H10 Z M14,17 H26 M14,22 H24",
            "settings" => "M3,7 H29 M3,16 H29 M3,25 H29 M10,3 V11 M22,12 V20 M15,21 V29",
            "alignLeft" => "M3,4 V28 M8,7 H29 M8,13 H23 M8,19 H29 M8,25 H23",
            "alignCenter" => "M16,2 V30 M3,7 H29 M8,13 H24 M3,19 H29 M8,25 H24",
            "alignRight" => "M29,4 V28 M3,7 H24 M9,13 H24 M3,19 H24 M9,25 H24",
            "panel" => "M3,4 H29 V28 H3 Z M21,4 V28 M24,9 H27 M24,15 H27 M24,21 H27",
            "ai" => "M16,2 L19,12 29,16 19,20 16,30 13,20 3,16 13,12 Z M26,2 V8 M23,5 H29",
            "down" => "M7,12 L16,21 25,12",
            _ => "M6,4 H26 V28 H6 Z M10,10 H22 M10,16 H22 M10,22 H18"
        };
        var drawing = new DrawingImage(new GeometryDrawing(null,
            new Pen(UiPolicy.Current.AccentBrush, 1.6) { LineJoin = PenLineJoin.Round, StartLineCap = PenLineCap.Round, EndLineCap = PenLineCap.Round }, Geometry.Parse(geometry)));
        // A transparent bounding rectangle guarantees identical framing, not a
        // glyph-dependent stretch that makes short icons look bigger.
        var group = new DrawingGroup();
        group.Children.Add(new GeometryDrawing(Brushes.Transparent, null, new RectangleGeometry(new Rect(0, 0, 34, 34))));
        group.Children.Add(drawing.Drawing);
        return new System.Windows.Controls.Image { Source = new DrawingImage(group), Width = size, Height = size, Stretch = Stretch.Uniform, IsHitTestVisible = false };
    }
}
