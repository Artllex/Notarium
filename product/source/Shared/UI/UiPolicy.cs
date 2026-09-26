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
    public static UiPolicy Current { get; } = Load();
    private static UiPolicy Load()
    {
        using var stream = typeof(UiPolicy).Assembly.GetManifestResourceStream("Notarium.UI.Policy.json") ?? throw new InvalidOperationException("Missing UI policy");
        return JsonSerializer.Deserialize<UiPolicy>(stream, new JsonSerializerOptions { PropertyNameCaseInsensitive = true }) ?? throw new InvalidOperationException("Invalid UI policy");
    }
    public static Brush Brush(string hex) => (Brush)new BrushConverter().ConvertFromString(hex)!;
}
