using System.Text.RegularExpressions;

namespace Notatnik.Core;

public sealed record DocumentPart(string Text, bool IsCode = false);

/// <summary>Legacy Markdown storage adapter. Independent of the editor and Windows.</summary>
public static class DocumentCodec
{
    private static readonly Regex Cells = new(
        @"(?m)^<!-- cell:python -->[ \t]*\r?\n(?<fence>`{3,})python[ \t]*\r?\n(?<code>[\s\S]*?)\r?\n\k<fence>[ \t]*(?=\r?$)",
        RegexOptions.Compiled);

    public static IReadOnlyList<DocumentPart> Decode(string source)
    {
        var parts = new List<DocumentPart>();
        var position = 0;
        foreach (Match match in Cells.Matches(source))
        {
            if (match.Index > position)
            {
                var text = source[position..match.Index];
                // Remove only the separator introduced by Encode, never user whitespace.
                if (text.EndsWith("\r\n")) text = text[..^2];
                else if (text.EndsWith('\n')) text = text[..^1];
                parts.Add(new DocumentPart(text));
            }
            parts.Add(new DocumentPart(match.Groups["code"].Value, true));
            position = match.Index + match.Length;
            if (source.AsSpan(position).StartsWith("\r\n")) position += 2;
            else if (position < source.Length && source[position] == '\n') position++;
        }
        if (position < source.Length || parts.Count == 0)
            parts.Add(new DocumentPart(source[position..]));
        else if (source.EndsWith('\n'))
            parts.Add(new DocumentPart(string.Empty));
        return parts;
    }

    public static string Encode(IEnumerable<DocumentPart> parts) => string.Join("\r\n", parts.Select(part =>
    {
        if (!part.IsCode) return part.Text;
        var longest = Regex.Matches(part.Text, "`+").Cast<Match>().Select(m => m.Length).DefaultIfEmpty(0).Max();
        var fence = new string('`', Math.Max(3, longest + 1));
        return $"<!-- cell:python -->\r\n{fence}python\r\n{part.Text}\r\n{fence}";
    }));
}
