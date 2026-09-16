using System.Text;
using System.Windows.Documents;

namespace Notatnik;

/// <summary>TextRange represents emoji visuals as spaces. Restore their Unicode in source text.</summary>
internal static class FlowText
{
    public static string Read(TextPointer start, TextPointer end)
    {
        var text = new StringBuilder(new TextRange(start, end).Text);
        var replacements = new List<(int Offset, int Length, string Text)>();
        for (var pointer = start; pointer is not null && pointer.CompareTo(end) < 0;
             pointer = pointer.GetNextContextPosition(LogicalDirection.Forward))
        {
            if (pointer.GetPointerContext(LogicalDirection.Forward) != TextPointerContext.ElementStart ||
                pointer.GetAdjacentElement(LogicalDirection.Forward) is not Emoji.Wpf.EmojiInline emoji ||
                emoji.ElementEnd.CompareTo(end) > 0) continue;
            replacements.Add((new TextRange(start, emoji.ElementStart).Text.Length,
                new TextRange(emoji.ElementStart, emoji.ElementEnd).Text.Length, emoji.Text));
        }
        foreach (var item in replacements.AsEnumerable().Reverse())
            text.Remove(item.Offset, item.Length).Insert(item.Offset, item.Text);
        return text.ToString();
    }
}
