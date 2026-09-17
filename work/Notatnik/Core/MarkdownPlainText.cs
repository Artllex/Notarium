using System.Net;
using System.Text.RegularExpressions;

namespace Notatnik.Core;

public static class MarkdownPlainText
{
    private static readonly Regex Comments = new(@"<!--.*?-->", RegexOptions.Singleline | RegexOptions.Compiled);
    private static readonly Regex Images = new(@"!\[([^\]]*)\]\([^)]*\)", RegexOptions.Singleline | RegexOptions.Compiled);
    private static readonly Regex Links = new(@"\[([^\]]+)\]\([^)]*\)", RegexOptions.Singleline | RegexOptions.Compiled);
    private static readonly Regex Tags = new(@"</?[A-Za-z][^>\r\n]*(?:>|$)", RegexOptions.Compiled);
    private static readonly Regex LinePrefix = new(
        @"(?m)^[ \t]*(?:#{1,6}[ \t]+|>[ \t]?|(?:[-+*]|\d+[.)])[ \t]+(?:\[[ xX]\][ \t]+)?)",
        RegexOptions.Compiled);
    private static readonly Regex Fences = new(@"(?m)^[ \t]*(?:`{3,}|~{3,})[^\r\n]*$", RegexOptions.Compiled);
    private static readonly Regex Decoration = new(@"(?<!\\)(?:\*\*|__|~~|(?<!\*)\*(?!\*)|(?<!_)_(?!_)|`+)", RegexOptions.Compiled);
    private static readonly Regex ExtraSpaces = new(@"[ \t]{2,}", RegexOptions.Compiled);
    private static readonly Regex BlankLines = new(@"(?:\r?\n[ \t]*){2,}", RegexOptions.Compiled);

    public static string Extract(string markdown)
    {
        if (string.IsNullOrEmpty(markdown)) return string.Empty;

        var text = Comments.Replace(markdown, string.Empty);
        text = Images.Replace(text, match =>
            string.IsNullOrWhiteSpace(match.Groups[1].Value) ? "[Obraz]" : match.Groups[1].Value);
        text = Links.Replace(text, "$1");
        text = Tags.Replace(text, string.Empty);
        text = Fences.Replace(text, string.Empty);
        text = LinePrefix.Replace(text, string.Empty);
        text = Decoration.Replace(text, string.Empty);
        text = WebUtility.HtmlDecode(text);
        text = text.Replace(@"\#", "#").Replace(@"\<", "<").Replace(@"\>", ">");
        text = ExtraSpaces.Replace(text, " ");
        text = BlankLines.Replace(text, Environment.NewLine);
        return text.Trim();
    }
}
