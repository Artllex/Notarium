using System.Text.Json;
using System.Windows.Media;
namespace Notarium.UI;

public sealed class UiPolicy
{
    public string MenuBackground { get; set; } = "";
    public string MenuBorder { get; set; } = "";
    public string MenuHover { get; set; } = "";
    public string MenuSelected { get; set; } = "";
    public string MenuText { get; set; } = "";
    public double ItemMinHeight { get; set; }
    public double MenuMaxHeight { get; set; }
    public string Surface { get; set; } = "";
    public string Panel { get; set; } = "";
    public string Accent { get; set; } = "";
    public string FontFamily { get; set; } = "";
    public double FontSize { get; set; }
    public double MenuPadding { get; set; }
    public double RowPaddingX { get; set; }
    public double RowPaddingY { get; set; }
    public double RowMarginX { get; set; }
    public double RowRadius { get; set; }
    public double MenuRadius { get; set; }
    public double DisabledOpacity { get; set; }
    public System.Windows.Media.Brush SurfaceBrush => Brush(Surface);
    public System.Windows.Media.Brush PanelBrush => Brush(Panel);
    public System.Windows.Media.Brush TextBrush => Brush(MenuText);
    public System.Windows.Media.Brush AccentBrush => Brush(Accent);
    public static UiPolicy Current { get; } = Load();
    private static UiPolicy Load()
    {
        using var stream = typeof(UiPolicy).Assembly.GetManifestResourceStream("Notarium.UI.Policy.json") ?? throw new InvalidOperationException("Missing UI policy");
        return JsonSerializer.Deserialize<UiPolicy>(stream, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? throw new InvalidOperationException("Invalid UI policy");
    }
    public static Brush Brush(string hex) => (Brush)new BrushConverter().ConvertFromString(hex)!;
}
