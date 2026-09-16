using System.Windows.Documents;

namespace Notatnik;

/// <summary>Stable pointers into text runs for a single formatting pass.</summary>
internal sealed class TextPositionIndex
{
    private readonly Dictionary<int, TextPointer> _positions = new();
    private readonly FlowDocument _document;

    public TextPositionIndex(FlowDocument document, IEnumerable<int> offsets)
    {
        _document = document;
        var targets = new SortedSet<int>(offsets);
        var offset = 0;
        for (var pointer = document.ContentStart; pointer is not null;)
        {
            var context = pointer.GetPointerContext(LogicalDirection.Forward);
            var adjacent = pointer.GetAdjacentElement(LogicalDirection.Forward);
            if (context == TextPointerContext.ElementStart && adjacent is Emoji.Wpf.EmojiInline emoji)
            {
                foreach (var target in targets.GetViewBetween(offset, offset + emoji.Text.Length))
                    _positions.TryAdd(target, target == offset + emoji.Text.Length ? emoji.ElementEnd : emoji.ElementStart);
                offset += emoji.Text.Length;
                pointer = emoji.ElementEnd;
                continue;
            }
            if (context == TextPointerContext.Text)
            {
                var text = pointer.GetTextInRun(LogicalDirection.Forward);
                // Only span boundaries, materialized before styling changes symbol offsets.
                foreach (var target in targets.GetViewBetween(offset, offset + text.Length))
                    _positions.TryAdd(target, pointer.GetPositionAtOffset(target - offset)!);
                offset += text.Length;
            }
            else if (context == TextPointerContext.EmbeddedElement)
            {
                var next = pointer.GetNextContextPosition(LogicalDirection.Forward)!;
                offset += new TextRange(pointer, next).Text.Length;
            }
            else if (context == TextPointerContext.ElementEnd && adjacent is Paragraph or BlockUIContainer or LineBreak)
            {
                offset += 2;
            }
            pointer = pointer.GetNextContextPosition(LogicalDirection.Forward);
        }
    }

    public TextPointer At(int offset)
    {
        if (_positions.TryGetValue(offset, out var position)) return position.GetInsertionPosition(LogicalDirection.Forward);
        return _document.ContentEnd.GetInsertionPosition(LogicalDirection.Backward);
    }
}
