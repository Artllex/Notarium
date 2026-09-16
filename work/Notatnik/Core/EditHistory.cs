namespace Notatnik.Core;

public sealed record EditorSnapshot(string Content, int Start = 0, int Length = 0, int Cell = -1);

/// <summary>One bounded history for text, code and document structure. No UI dependencies.</summary>
public sealed class EditHistory
{
    private const int MaxEntries = 150;
    private const long MaxCharacters = 4_000_000;
    private readonly List<EditorSnapshot> _states = new();
    private int _position;
    private long _characters;
    public bool CanUndo => _position > 0;
    public bool CanRedo => _position + 1 < _states.Count;
    public EditorSnapshot Current => _states[_position];

    public void Reset(EditorSnapshot initial)
    {
        _states.Clear();
        _states.Add(initial);
        _position = 0;
        _characters = initial.Content.Length;
    }

    public bool Record(EditorSnapshot state)
    {
        if (_states.Count == 0) { Reset(state); return false; }
        if (state.Content == Current.Content) return false;
        while (_states.Count > _position + 1) RemoveAt(_states.Count - 1);
        _states.Add(state);
        _characters += state.Content.Length;
        _position++;
        while (_states.Count > 2 && (_states.Count > MaxEntries || _characters > MaxCharacters))
        {
            RemoveAt(0);
            _position--;
        }
        return true;
    }

    public void RememberSelection(EditorSnapshot state)
    {
        if (_states.Count > 0 && state.Content == Current.Content) _states[_position] = state;
    }

    public EditorSnapshot? Undo() => CanUndo ? _states[--_position] : null;
    public EditorSnapshot? Redo() => CanRedo ? _states[++_position] : null;

    private void RemoveAt(int index)
    {
        _characters -= _states[index].Content.Length;
        _states.RemoveAt(index);
    }
}
