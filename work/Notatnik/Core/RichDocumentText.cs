using System.Text;
using System.Text.Json;

namespace Notatnik.Core;

public static class RichDocumentText
{
    public static string Extract(string json)
    {
        using var document = JsonDocument.Parse(json);
        var result = new StringBuilder();
        Visit(document.RootElement.GetProperty("doc"), result);
        return result.ToString().TrimEnd('\n');
    }

    private static void Visit(JsonElement node, StringBuilder result)
    {
        if (node.TryGetProperty("text", out var text)) result.Append(text.GetString());
        if (node.TryGetProperty("content", out var children))
            foreach (var child in children.EnumerateArray()) Visit(child, result);
        var type = node.GetProperty("type").GetString();
        if (node.TryGetProperty("attrs", out var attrs))
        {
            if (type is "inlineMath" or "blockMath" && attrs.TryGetProperty("latex", out var latex)) result.Append(latex.GetString());
            if (type is "image") result.Append("[Obraz]");
        }
        if (type is "paragraph" or "heading" or "codeCell" or "codeBlock" or "hardBreak" or "blockMath" or "image") result.Append('\n');
    }
}
