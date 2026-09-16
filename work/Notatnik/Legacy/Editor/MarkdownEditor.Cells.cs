using System.Text.RegularExpressions;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Documents;
using System.Windows.Media;
using System.Windows.Threading;
using System.Windows.Input;
using System.Diagnostics;
using Notatnik.Core;

namespace Notatnik;

public sealed partial class MarkdownEditor
{
    private string SerializeDocument() => DocumentCodec.Encode(Document.Blocks.Select(block =>
        block is BlockUIContainer { Child: CodeCellControl cell }
            ? new DocumentPart(cell.Code, true)
            : new DocumentPart(FlowText.Read(block.ContentStart, block.ContentEnd))));

    private void LoadDocument(string source)
    {
        foreach (var part in DocumentCodec.Decode(source))
        {
            if (part.IsCode)
                Document.Blocks.Add(new BlockUIContainer(CreateCell(part.Text)) { Margin = new Thickness(0) });
            else AddTextBlock(part.Text);
        }
    }

    private void AddTextBlock(string value)
    {
        var paragraph = new Paragraph(new Run(value)) { Margin = new Thickness(0) };
        Document.Blocks.Add(paragraph);
    }

    private CodeCellControl CreateCell(string code)
    {
        var cell = new CodeCellControl(code);
        cell.ContentChanged += (_, _) => CommitContentChange();
        cell.DeleteRequested += (_, _) => RemoveCell(cell);
        cell.MoveUpRequested += (_, _) => MoveCell(cell, -1);
        cell.MoveDownRequested += (_, _) => MoveCell(cell, 1);
        return cell;
    }

    private void RemoveCell(CodeCellControl cell) => Edit(() =>
    {
        var container = Document.Blocks.OfType<BlockUIContainer>().FirstOrDefault(block => ReferenceEquals(block.Child, cell));
        if (container is null) return;
        Document.Blocks.Remove(container);
        if (Document.Blocks.Count == 0) AddTextBlock(string.Empty);
        Focus();
    });

    private void MoveCell(CodeCellControl cell, int direction) => Edit(() =>
    {
        var blocks = Document.Blocks.ToList();
        var index = blocks.FindIndex(block => block is BlockUIContainer container && ReferenceEquals(container.Child, cell));
        var target = index + direction;
        if (index < 0 || target < 0 || target >= blocks.Count) return;
        var block = blocks[index];
        Document.Blocks.Remove(block);
        if (direction < 0) Document.Blocks.InsertBefore(blocks[target], block);
        else Document.Blocks.InsertAfter(blocks[target], block);
        cell.FocusCode();
    });
}
